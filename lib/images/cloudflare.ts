import 'server-only'
import type { ImageProvider, StillFailure, StillResult } from './types'

/**
 * Cloudflare Workers AI (FLUX schnell).
 *
 * Second provider, used when the keyless one is rate limited or down. Free
 * tier, no card required, but it needs an account id and API token -- so it
 * reports unconfigured and is skipped entirely when those are absent.
 */
export const cloudflare: ImageProvider = {
  id: 'cloudflare',
  configured: () =>
    Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN),

  async fetchStill(req, signal): Promise<StillResult | StillFailure> {
    const account = process.env.CLOUDFLARE_ACCOUNT_ID
    const token = process.env.CLOUDFLARE_API_TOKEN
    if (!account || !token) return 'unconfigured'

    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
      {
        method: 'POST',
        signal,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: req.prompt, seed: req.seed, steps: 4 }),
      },
    )
    if (res.status === 429) return 'rate_limited'
    if (!res.ok) return 'unavailable'

    // This model returns base64 JPEG in a JSON envelope rather than raw bytes.
    const body = (await res.json()) as { result?: { image?: string } }
    const b64 = body?.result?.image
    if (!b64) return 'unavailable'

    return {
      bytes: Uint8Array.from(Buffer.from(b64, 'base64')),
      contentType: 'image/jpeg',
      provider: 'cloudflare',
    }
  },
}
