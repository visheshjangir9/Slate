import 'server-only'
import type { ImageProvider, StillFailure, StillResult } from './types'
import { GPT_IMAGE_MODEL, logImageUpstream } from './gptImage'

/**
 * OpenAI image generation (the model in GPT_IMAGE_MODEL).
 *
 * Primary image provider. Unlike the keyless service it replaces, this one is
 * rate-limit stable, watermark-free and returns the size we ask for -- so no
 * over-fetch-and-crop is needed on this path.
 */
const ENDPOINT = 'https://api.openai.com/v1/images/generations'

/** The model's recommended sizes; pick the closest by aspect. */
function nearestSize(width: number, height: number): '1024x1024' | '1536x1024' | '1024x1536' {
  const ratio = width / height
  if (ratio > 1.2) return '1536x1024'
  if (ratio < 0.83) return '1024x1536'
  return '1024x1024'
}

export const openaiImages: ImageProvider = {
  id: 'openai',
  configured: () => {
    const k = process.env.OPENAI_API_KEY
    // A placeholder key is worse than none: it fails at generation time rather
    // than being skipped, so treat obviously-fake values as unconfigured.
    return Boolean(k && k.startsWith('sk-') && k.length > 24 && !/x{4,}/i.test(k))
  },

  async fetchStill(req, signal): Promise<StillResult | StillFailure> {
    const key = process.env.OPENAI_API_KEY
    if (!key) return 'unconfigured'

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GPT_IMAGE_MODEL,
        prompt: req.prompt,
        size: nearestSize(req.width, req.height),
        quality: req.quality ?? 'medium',
        n: 1,
      }),
    })

    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { error?: { code?: string; type?: string } } | null
      logImageUpstream('still', res.status, err?.error)
      return res.status === 429 ? 'rate_limited' : 'unavailable'
    }

    const body = (await res.json()) as { data?: { b64_json?: string; url?: string }[] }
    const first = body?.data?.[0]
    if (!first) return 'unavailable'

    if (first.b64_json) {
      return {
        bytes: Uint8Array.from(Buffer.from(first.b64_json, 'base64')),
        contentType: 'image/png',
        provider: 'openai',
      }
    }
    if (first.url) {
      const img = await fetch(first.url, { signal })
      if (!img.ok) return 'unavailable'
      return {
        bytes: new Uint8Array(await img.arrayBuffer()),
        contentType: img.headers.get('content-type') ?? 'image/png',
        provider: 'openai',
      }
    }
    return 'unavailable'
  },
}
