import type { NextRequest } from 'next/server'
import { reduce } from '@/lib/generation/state'
import { blobStore, generationStore } from '@/lib/store'
import { resolveDeviceId } from '@/lib/api/session'
import { conflict, notFound, ok, serverError } from '@/lib/api/respond'
import { fetchStill } from '@/lib/images'
import { dimensionsFor } from '@/lib/engine'
import { LtxvError, generateLtxv } from '@/lib/video/ltxv'

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
export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const store = generationStore()

  try {
    const deviceId = await resolveDeviceId()
    const row = await store.get(id)
    if (!row || row.deviceId !== deviceId) return notFound('That generation does not exist')

    const started = reduce(row, { type: 'start' })
    if (!started.ok) return conflict(started.error.code, started.error.message)
    await store.patch(id, started.patch)

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

async function fail(id: string, code: string, message: string): Promise<void> {
  const store = generationStore()
  const row = await store.get(id)
  if (!row) return
  const r = reduce(row, { type: 'fail', code, message })
  if (r.ok) await store.patch(id, r.patch)
}
