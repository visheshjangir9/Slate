import type { NextRequest } from 'next/server'
import { createHash } from 'node:crypto'
import { ZodError } from 'zod'
import { stillQuerySchema } from '@/lib/generation/schema'
import { fail, fromZod, serverError } from '@/lib/api/respond'
import { blobStore, generationStore } from '@/lib/store'
import { resolveOwnerId } from '@/lib/api/session'
import { securityEvent } from '@/lib/security/audit'
import { clientIp } from '@/lib/security/rateLimit'
import { cropWatermark, overfetchHeight } from '@/lib/api/crop'
import { fetchStill } from '@/lib/images'

/** Vercel Node functions default to a short cap; the upstreams need the room. */
export const maxDuration = 60

/**
 * Server-side still proxy.
 *
 * Exists because the keyless upstream returns 403 "Missing Turnstile token"
 * for any request carrying an Origin header, but 200 for a server-side request
 * without one. So the browser can never fetch it directly. Proxying also keeps
 * the image same-origin, which means a canvas reading it back is not tainted.
 *
 * It spends money (the first provider is a paid image API), so it is not an
 * open endpoint: the caller must be signed in and name a camera-motion job
 * they own that is running right now. That job already passed the plan check
 * when it was created, and the frame is drawn from the job's own prompt and
 * seed, so a still can never be fetched outside a counted generation.
 *
 * Three further things happen here, each for a measured reason:
 *   - results are cached, because the upstream is slow and rate limits by IP
 *   - the frame is over-fetched and cropped, because the upstream stamps a
 *     watermark that was otherwise baked into shipped clips
 *   - providers fall through, because the keyless one goes down under load
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  let ownerId: string
  try {
    ownerId = await resolveOwnerId()
  } catch (e) {
    return serverError(e, 'still_failed')
  }

  const genId = url.searchParams.get('gen') ?? ''
  const job = genId ? await generationStore().get(genId).catch(() => null) : null
  if (!job || job.deviceId !== ownerId) {
    securityEvent('still_denied', { ip: clientIp(req), owner: ownerId, reason: genId ? 'not_owner' : 'no_job' })
    return fail(404, { code: 'not_found', message: 'That generation does not exist' })
  }
  if (job.provider !== 'cinematic' || job.status !== 'generating' || job.referenceUrl) {
    securityEvent('still_denied', { ip: clientIp(req), owner: ownerId, reason: 'job_not_drawing' })
    return fail(409, { code: 'still_not_needed', message: 'This generation is not waiting for a frame.' })
  }

  let q: ReturnType<typeof stillQuerySchema.parse>
  try {
    q = stillQuerySchema.parse({
      prompt: job.prompt,
      width: url.searchParams.get('width'),
      height: url.searchParams.get('height'),
      seed: job.seed,
    })
  } catch (e) {
    if (e instanceof ZodError) return fromZod(e)
    throw e
  }

  const cacheKey =
    'still-' +
    createHash('sha256')
      .update(`${q.prompt}|${q.width}|${q.height}|${q.seed}|v2`)
      .digest('hex')
      .slice(0, 32) +
    '.jpg'

  const blobs = blobStore()
  try {
    const hit = await blobs.get(cacheKey)
    if (hit) {
      return new Response(hit.bytes as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': hit.contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Slate-Cache': 'hit',
        },
      })
    }
  } catch {
    // A cache read failure must never fail the request.
  }

  const out = await fetchStill({
    prompt: q.prompt,
    width: q.width,
    // Extra height so the watermarked strip can be cut off below.
    height: overfetchHeight(q.height),
    seed: q.seed,
  })

  if ('failure' in out) {
    return out.failure === 'rate_limited'
      ? fail(429, {
          code: 'still_rate_limited',
          message: 'The image service is rate limiting us. Wait a moment, then try again.',
        })
      : fail(502, {
          code: 'still_unavailable',
          message: 'The image service did not respond. This usually clears on a retry.',
        })
  }

  const cropped = cropWatermark(out.result.bytes, q.width, q.height)
  const bytes = cropped?.bytes ?? out.result.bytes
  const contentType = cropped ? cropped.contentType : out.result.contentType

  if (bytes.byteLength === 0) {
    return fail(502, {
      code: 'still_unavailable',
      message: 'The image service returned an empty frame. Try again.',
    })
  }

  try { await blobs.put(cacheKey, bytes, contentType) } catch { /* best effort */ }

  return new Response(bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Slate-Cache': 'miss',
      'X-Slate-Provider': out.result.provider,
    },
  })
}
