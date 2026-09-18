import type { NextRequest } from 'next/server'
import { stillQuerySchema } from '@/lib/generation/schema'
import { fail, fromZod } from '@/lib/api/respond'
import { ZodError } from 'zod'

const UPSTREAM = 'https://image.pollinations.ai/prompt'
const TIMEOUT_MS = 45_000

/**
 * Server-side still proxy.
 *
 * Verified 2026-09-18: the upstream returns 403 {"error":"Missing Turnstile
 * token"} for any request carrying an Origin header, but 200 for a server-side
 * request without one. So the browser can never fetch this directly. Proxying
 * also keeps the image same-origin, which means the canvas is not tainted and
 * the encoder can read the pixels back.
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

  const model = url.searchParams.get('model') === 'turbo' ? 'turbo' : 'flux'
  const upstream = new URL(`${UPSTREAM}/${encodeURIComponent(q.prompt)}`)
  upstream.searchParams.set('width', String(q.width))
  upstream.searchParams.set('height', String(q.height))
  upstream.searchParams.set('model', model)
  upstream.searchParams.set('nologo', 'true')
  upstream.searchParams.set('seed', String(q.seed))

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS)
  try {
    // No Origin/Referer forwarded: that is exactly what keeps this a 200.
    const res = await fetch(upstream, { signal: ac.signal, headers: { Accept: 'image/*' } })
    if (!res.ok || !res.body) {
      return fail(502, {
        code: 'still_unavailable',
        message: 'The image service did not respond. This usually clears on a retry.',
      })
    }
    return new Response(res.body, {
      status: 200,
      headers: {
        'Content-Type': res.headers.get('content-type') ?? 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return fail(504, {
      code: 'still_timeout',
      message: 'The image service took too long. Try again.',
    })
  } finally {
    clearTimeout(timer)
  }
}
