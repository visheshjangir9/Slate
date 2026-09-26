import type { NextRequest } from 'next/server'
import { reduce } from '@/lib/generation/state'
import { blobStore, generationStore } from '@/lib/store'
import { resolveOwnerId } from '@/lib/api/session'
import { badRequest, conflict, fail as failResponse, notFound, ok, serverError } from '@/lib/api/respond'
import type { Generation } from '@/lib/generation/types'
import { isByokProviderTag, parseByokModelId } from '@/lib/byok/catalog'
import { byokBodySchema } from '@/lib/byok/schema'
import { BYOK_ERRORS, ByokError, type ByokErrorCode } from '@/lib/byok/errors'
import { downloadVideo, videoStatus } from '@/lib/byok/service'
import { inspectMp4 } from '@/lib/byok/mp4'

type Ctx = { params: Promise<{ id: string }> }

/** Downloading and storing a finished video can take a while. */
export const maxDuration = 300

/** A status read that failed for a passing reason: keep following the job. */
const TRANSIENT = new Set<ByokErrorCode>(['byok_rate_limited', 'byok_unreachable', 'byok_timeout'])

/**
 * Follow an asynchronous video render on the user's own provider.
 *
 * The client calls this every few seconds with the key in the body; nothing
 * is kept between calls except the provider's job handle on the row. Each
 * call reads the provider's job once:
 *   pending    heartbeat (and real progress, only if the provider reports it)
 *   failed     the job fails with a fixed, provider-aware message
 *   completed  download → validate as MP4 → store → completed
 * A finished job is returned without contacting the provider at all.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const store = generationStore()

  let row: Generation | null
  try {
    const ownerId = await resolveOwnerId()
    row = await store.get(id)
    if (!row || row.deviceId !== ownerId) return notFound('That generation does not exist')
  } catch (e) {
    return serverError(e, 'poll_failed')
  }

  const target = isByokProviderTag(row.provider) ? parseByokModelId(row.model) : null
  if (!target || target.op !== 'video') return badRequest('This generation is not a provider video job')

  // Terminal or not yet submitted: nothing to ask the provider.
  if (row.status === 'completed' || row.status === 'failed') return ok({ generation: row, done: true })
  if (row.status !== 'generating' || !row.providerJob) return ok({ generation: row })

  const body = byokBodySchema.safeParse(await req.json().catch(() => null))
  if (!body.success || body.data.credential.providerId !== target.providerId) {
    // The row is left alone: the client stops, and the job sweeps as stale.
    return failResponse(400, { code: 'byok_key_missing', message: BYOK_ERRORS.byok_key_missing })
  }
  const cred = body.data.credential
  const handle = row.providerJob

  // Another poll (another tab) is already collecting this video.
  if (row.stage === 'upload' && row.heartbeatAt && Date.now() - Date.parse(row.heartbeatAt) < 120_000) {
    return ok({ generation: row })
  }

  let collecting = false
  try {
    const st = await videoStatus(cred, target, handle, body.data.settings)
    if (st.state === 'pending') {
      const patch: Partial<Generation> = { heartbeatAt: new Date().toISOString() }
      if (st.progress !== undefined) patch.progress = st.progress
      return ok({ generation: await store.patch(id, patch) })
    }
    if (st.state === 'failed') {
      await fail(id, st.code)
      return ok({ generation: await store.get(id), done: true })
    }

    // Completed at the provider: claim the download, then collect the real file.
    collecting = true
    await store.patch(id, { stage: 'upload', heartbeatAt: new Date().toISOString() })
    const bytes = await downloadVideo(cred, target, handle, req.signal)
    const info = inspectMp4(bytes)
    if (!info) throw new ByokError('byok_bad_video')
    const outputUrl = await blobStore().put(`${id}.mp4`, bytes, 'video/mp4')

    const current = await store.get(id)
    if (!current) return notFound('That generation disappeared')
    const done = reduce(current, { type: 'complete', outputUrl, posterUrl: row.referenceUrl ?? null, fileBytes: bytes.byteLength })
    if (!done.ok) return conflict(done.error.code, done.error.message)
    const seconds = Math.round(info.durationS)
    const updated = await store.patch(id, {
      ...done.patch,
      // The duration actually delivered, when the schema can hold it.
      ...(seconds >= 4 && seconds <= 30 ? { durationS: seconds } : {}),
      providerJob: null,
    })
    return ok({ generation: updated, done: true })
  } catch (e) {
    const err = e instanceof ByokError ? e : new ByokError('byok_failed')
    if (!collecting && TRANSIENT.has(err.code)) {
      // The provider was briefly unavailable; the job itself is fine.
      return ok({ generation: await store.patch(id, { heartbeatAt: new Date().toISOString() }) })
    }
    try { await fail(id, err.code) } catch { /* already terminal */ }
    return ok({ generation: await store.get(id), done: true })
  }
}

async function fail(id: string, code: ByokErrorCode): Promise<void> {
  const store = generationStore()
  const row = await store.get(id)
  if (!row) return
  const r = reduce(row, { type: 'fail', code, message: BYOK_ERRORS[code] })
  if (r.ok) await store.patch(id, { ...r.patch, providerJob: null })
}
