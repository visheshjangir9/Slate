import type { NextRequest } from 'next/server'
import { reduce } from '@/lib/generation/state'
import { blobStore, generationStore } from '@/lib/store'
import { resolveOwnerId } from '@/lib/api/session'
import { conflict, notFound, ok, serverError } from '@/lib/api/respond'
import { fetchStill } from '@/lib/images'
import { dimensionsFor } from '@/lib/engine'
import { LtxvError, generateLtxv } from '@/lib/video/ltxv'
import { ImageGenError, generateGptImage } from '@/lib/images/gptImage'
import type { Generation } from '@/lib/generation/types'
import { isByokProviderTag, parseByokModelId } from '@/lib/byok/catalog'
import { byokBodySchema } from '@/lib/byok/schema'
import { BYOK_ERRORS, ByokError } from '@/lib/byok/errors'
import { generateImage as generateByokImage, submitVideo } from '@/lib/byok/service'
import { loadFirstFrame } from '@/lib/byok/frames'

type Ctx = { params: Promise<{ id: string }> }

/**
 * LTX is synchronous and a 4s clip takes ~26s, plus image generation ahead of
 * it, so this needs the longest window the platform allows.
 */
export const maxDuration = 300

/**
 * Server-side render for provider-backed generations.
 *
 * The whole pipeline runs here rather than in the browser: request, artifact
 * download, validation and storage. Nothing depends on a tab staying open, and
 * the row is only marked completed once OUR Supabase URL holds real video.
 *
 * Stages are written to the row as they happen, so the client's existing status
 * poll shows honest progress without anything being fabricated.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const store = generationStore()

  // Ownership is settled before the pipeline's try: its catch marks the job
  // failed, and that must only ever happen to the caller's own job.
  let row: Generation | null
  try {
    const ownerId = await resolveOwnerId()
    row = await store.get(id)
    if (!row || row.deviceId !== ownerId) return notFound('That generation does not exist')
  } catch (e) {
    return serverError(e, 'render_failed')
  }

  if (isByokProviderTag(row.provider)) return renderByok(req, row)

  try {
    const started = reduce(row, { type: 'start' })
    if (!started.ok) return conflict(started.error.code, started.error.message)
    await store.patch(id, started.patch)

    if (row.provider === 'gpt-image') return await renderImage(row)

    const blobs = blobStore()
    const dims = dimensionsFor(row.aspectRatio, row.resolution)

    // 1. Source frame. A user-supplied reference wins; otherwise generate one.
    let imageUri = row.referenceUrl ?? null
    let posterUrl = row.referenceUrl ?? null

    if (!imageUri) {
      const still = await fetchStill({
        prompt: row.prompt, width: dims.width, height: dims.height, seed: row.seed,
        // LTX re-renders motion from this frame, so speed matters more than
        // detail here and the whole job must fit one serverless invocation.
        quality: 'low',
      })
      if ('failure' in still) {
        await fail(id, still.failure === 'rate_limited' ? 'still_rate_limited' : 'still_unavailable',
          'The image model did not return a frame. Try again.')
        return ok({ generation: await store.get(id) })
      }
      const ext = still.result.contentType.includes('png') ? 'png' : 'jpg'
      imageUri = await blobs.put(`${id}-source.${ext}`, still.result.bytes, still.result.contentType)
      posterUrl = imageUri
    }

    // 2. Video. Stage is persisted first so a polling client sees the change.
    await store.patch(id, { stage: 'render', progress: 35, heartbeatAt: new Date().toISOString() })
    const video = await generateLtxv({
      prompt: row.prompt,
      durationS: row.durationS,
      aspectRatio: row.aspectRatio,
      resolution: row.resolution,
      imageUri,
    })

    // 3. Persist the artifact under our own URL before claiming success.
    await store.patch(id, { stage: 'upload', progress: 85, heartbeatAt: new Date().toISOString() })
    const outputUrl = await blobs.put(`${id}.mp4`, video.bytes, 'video/mp4')

    const current = await store.get(id)
    if (!current) return notFound('That generation disappeared')
    const done = reduce(current, {
      type: 'complete', outputUrl, posterUrl, fileBytes: video.bytes.byteLength,
    })
    if (!done.ok) return conflict(done.error.code, done.error.message)

    const updated = await store.patch(id, {
      ...done.patch,
      durationS: video.durationS,
    })
    return ok({ generation: updated })
  } catch (e) {
    const code = e instanceof LtxvError ? e.code : 'render_failed'
    const message =
      e instanceof LtxvError ? e.message : 'The render could not be completed.'
    try { await fail(id, code, message) } catch { /* already terminal */ }
    if (!(e instanceof LtxvError)) return serverError(e, 'render_failed')
    return ok({ generation: await generationStore().get(id) })
  }
}

/**
 * GPT Image: generate, crop to the exact frame, store, then complete. The row
 * only reaches `completed` once our own storage holds the JPEG.
 */
async function renderImage(row: Generation) {
  const store = generationStore()
  const id = row.id
  const ac = new AbortController()
  // gpt-image-1 at High quality can take close to a minute; leave headroom
  // inside the function's own limit so we fail honestly rather than get killed.
  const timer = setTimeout(() => ac.abort(), 240_000)
  try {
    await store.patch(id, { stage: 'image', progress: 10, heartbeatAt: new Date().toISOString() })
    const img = await generateGptImage({
      prompt: row.prompt,
      aspectRatio: row.aspectRatio,
      quality: row.bitrate,
      signal: ac.signal,
    })

    await store.patch(id, { stage: 'upload', progress: 85, heartbeatAt: new Date().toISOString() })
    const url = await blobStore().put(`${id}.jpg`, img.bytes, 'image/jpeg')

    const current = await store.get(id)
    if (!current) return notFound('That generation disappeared')
    const done = reduce(current, { type: 'complete', outputUrl: url, posterUrl: url, fileBytes: img.bytes.byteLength })
    if (!done.ok) return conflict(done.error.code, done.error.message)
    return ok({ generation: await store.patch(id, done.patch) })
  } catch (e) {
    const err = e instanceof ImageGenError ? e : new ImageGenError('image_failed', 'The image could not be completed.')
    try { await fail(id, err.code, err.message) } catch { /* already terminal */ }
    return ok({ generation: await store.get(id) })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * A generation on the user's own provider.
 *
 * The key arrives in this request's body, after the session and ownership
 * checks above, and is used for this request only. It is not stored, logged
 * or returned: the row only ever gets the provider tag, the provider's job
 * handle (an identifier, useless without the key), the output and, on
 * failure, a fixed error message.
 *
 *   image  generated and stored within this request
 *   video  submitted once; the provider renders asynchronously and the
 *          client follows it through POST /api/generations/:id/poll, sending
 *          the key with each poll (serverless memory is never relied on)
 */
async function renderByok(req: NextRequest, row: Generation) {
  const store = generationStore()
  const id = row.id
  const body = byokBodySchema.safeParse(await req.json().catch(() => null))
  const target = parseByokModelId(row.model)
  if (!body.success || !target || body.data.credential.providerId !== target.providerId) {
    // No usable key in this session (e.g. the page was reloaded): fail
    // honestly rather than leave the job queued. Nothing reaches a provider.
    try { await fail(id, 'byok_key_missing', BYOK_ERRORS.byok_key_missing) } catch { /* already terminal */ }
    return ok({ generation: await store.get(id) })
  }

  const started = reduce(row, { type: 'start' })
  if (!started.ok) return conflict(started.error.code, started.error.message)
  await store.patch(id, started.patch)

  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(280_000)])
  try {
    if (target.op === 'video') {
      await store.patch(id, { stage: 'image', progress: 0, heartbeatAt: new Date().toISOString() })
      const firstFrame = row.referenceUrl ? await loadFirstFrame(row.referenceUrl) : undefined
      const handle = await submitVideo(body.data.credential, target, {
        prompt: row.prompt, aspectRatio: row.aspectRatio, durationS: row.durationS, firstFrame,
      }, body.data.settings, signal)
      // Submitted once. From here the client polls; the key is not kept.
      const updated = await store.patch(id, { providerJob: handle, stage: 'render', heartbeatAt: new Date().toISOString() })
      return ok({ generation: updated, pending: true })
    }

    await store.patch(id, { stage: 'image', progress: 10, heartbeatAt: new Date().toISOString() })
    const art = await generateByokImage(body.data.credential, target, {
      prompt: row.prompt, aspectRatio: row.aspectRatio, quality: row.bitrate,
    }, body.data.settings, signal)

    await store.patch(id, { stage: 'upload', progress: 85, heartbeatAt: new Date().toISOString() })
    const url = await blobStore().put(`${id}.${art.ext}`, art.bytes, art.mime)

    const current = await store.get(id)
    if (!current) return notFound('That generation disappeared')
    const done = reduce(current, { type: 'complete', outputUrl: url, posterUrl: url, fileBytes: art.bytes.byteLength })
    if (!done.ok) return conflict(done.error.code, done.error.message)
    return ok({ generation: await store.patch(id, done.patch) })
  } catch (e) {
    // Only normalised errors reach the row; anything else becomes a generic
    // failure. The raw error is dropped, never logged.
    const err = e instanceof ByokError ? e : new ByokError('byok_failed')
    try { await fail(id, err.code, err.message) } catch { /* already terminal */ }
    return ok({ generation: await store.get(id) })
  }
}

async function fail(id: string, code: string, message: string): Promise<void> {
  const store = generationStore()
  const row = await store.get(id)
  if (!row) return
  const r = reduce(row, { type: 'fail', code, message })
  if (r.ok) await store.patch(id, r.patch)
}
