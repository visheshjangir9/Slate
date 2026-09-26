import type { NextRequest } from 'next/server'
import { createHash } from 'node:crypto'
import { ZodError } from 'zod'
import { stillQuerySchema } from '@/lib/generation/schema'
import { fail, fromZod } from '@/lib/api/respond'
import { blobStore } from '@/lib/store'
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
 * Three further things happen here, each for a measured reason:
 *   - results are cached, because the upstream is slow and rate limits by IP
 *   - the frame is over-fetched and cropped, because the upstream stamps a
 *     watermark that was otherwise baked into shipped clips
 *   - providers fall through, because the keyless one goes down under load
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  let q: ReturnType<typeof stillQuerySchema.parse>
  try {
    q = stillQuerySchema.parse({
      prompt: url.searchParams.get('prompt'),
      width: url.searchParams.get('width'),
      height: url.searchParams.get('height'),
      seed: url.searchParams.get('seed') ?? 0,
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
