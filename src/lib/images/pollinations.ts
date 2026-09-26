import 'server-only'
import type { ImageProvider, StillFailure, StillResult } from './types'

const UPSTREAM = 'https://image.pollinations.ai/prompt'

/**
 * Default image provider. Keyless, which is why it is first -- but it rate
 * limits by IP and degrades under load, so it is not trusted alone.
 */
export const pollinations: ImageProvider = {
  id: 'pollinations',
  configured: () => true,
  async fetchStill(req, signal): Promise<StillResult | StillFailure> {
    const url = new URL(`${UPSTREAM}/${encodeURIComponent(req.prompt)}`)
    url.searchParams.set('width', String(req.width))
    url.searchParams.set('height', String(req.height))
    url.searchParams.set('model', 'flux')
    url.searchParams.set('nologo', 'true')
    url.searchParams.set('seed', String(req.seed))

    // No Origin/Referer forwarded: that is what keeps this a 200 rather than a
    // 403 "Missing Turnstile token".
    const res = await fetch(url, { signal, headers: { Accept: 'image/*' } })
    if (res.ok) {
      return {
        bytes: new Uint8Array(await res.arrayBuffer()),
        contentType: res.headers.get('content-type') ?? 'image/jpeg',
        provider: 'pollinations',
      }
    }
    if (res.status === 429) return 'rate_limited'
    return 'unavailable'
  },
}
