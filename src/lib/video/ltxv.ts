import 'server-only'
import type { AspectRatio, Resolution } from '@/lib/engine/types'

const BASE = 'https://api.ltx.io/v1'
export const LTXV_MODEL = 'ltx-2-5-pro'

/**
 * LTX-2 (Lightricks).
 *
 * Verified against the live API: POST /v1/text-to-video and /v1/image-to-video
 * with Bearer auth return the MP4 bytes SYNCHRONOUSLY -- there is no async job
 * endpoint (probed /v1/jobs, /v1/text-to-video/async, /v1/generations: all 404).
 * A 4s 1280x720 clip took 25.9s, which is why durations are capped: the whole
 * call has to finish inside one serverless invocation.
 */
export const LTXV_DURATIONS = [4, 6, 8] as const

export const ltxvConfigured = (): boolean => Boolean(process.env.LTXV_API_KEY)

/** LTX takes an explicit WxH. Map our aspect+tier to the nearest it accepts. */
export function ltxvResolution(aspect: AspectRatio, res: Resolution): string {
  const short = res === '1080p' ? 1080 : res === '720p' ? 720 : 480
  const ratios: Record<AspectRatio, number> = {
    '21:9': 21 / 9, '16:9': 16 / 9, '4:3': 4 / 3, '1:1': 1, '4:5': 4 / 5, '9:16': 9 / 16,
  }
  const r = ratios[aspect]
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2)
  return r >= 1 ? `${even(short * r)}x${even(short)}` : `${even(short)}x${even(short / r)}`
}

export const nearestLtxvDuration = (seconds: number): number =>
  LTXV_DURATIONS.reduce((best, d) =>
    Math.abs(d - seconds) < Math.abs(best - seconds) ? d : best, LTXV_DURATIONS[0])

export interface LtxvRequest {
  prompt: string
  durationS: number
  aspectRatio: AspectRatio
  resolution: Resolution
  /** When present, LTX animates this frame instead of inventing one. */
  imageUri?: string | null
}

export interface LtxvResult {
  bytes: Uint8Array
  contentType: string
  endpoint: 'text-to-video' | 'image-to-video'
  durationS: number
  resolution: string
}

export class LtxvError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export async function generateLtxv(req: LtxvRequest, signal?: AbortSignal): Promise<LtxvResult> {
  const key = process.env.LTXV_API_KEY
  if (!key) throw new LtxvError('provider_unconfigured', 'LTX is not configured.')

  const endpoint = req.imageUri ? 'image-to-video' : 'text-to-video'
  const duration = nearestLtxvDuration(req.durationS)
  const resolution = ltxvResolution(req.aspectRatio, req.resolution)

  const body: Record<string, unknown> = {
    prompt: req.prompt,
    model: LTXV_MODEL,
    duration,
    resolution,
  }
  if (req.imageUri) body.image_uri = req.imageUri

  const res = await fetch(`${BASE}/${endpoint}`, {
    method: 'POST',
    signal,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    let detail = ''
    try {
      const j = (await res.json()) as { error?: { message?: string } }
      detail = j?.error?.message ?? ''
    } catch { /* non-JSON error body */ }
    if (/insufficient funds/i.test(detail)) {
      throw new LtxvError('provider_no_credit', detail)
    }
    if (res.status === 429) throw new LtxvError('provider_rate_limited', 'LTX is rate limiting requests.')
    if (res.status === 401 || res.status === 403) {
      throw new LtxvError('provider_unauthorized', 'LTX rejected the credentials.')
    }
    throw new LtxvError('provider_failed', detail || `LTX returned ${res.status}.`)
  }

  const contentType = res.headers.get('content-type') ?? ''
  const bytes = new Uint8Array(await res.arrayBuffer())
  // Never trust the header alone: an HTML error page must not become a "video".
  const isMp4 = bytes.byteLength > 1024 && Buffer.from(bytes.subarray(4, 8)).toString('latin1') === 'ftyp'
  if (!isMp4) throw new LtxvError('artifact_not_video', 'LTX did not return a playable video.')

  return { bytes, contentType: contentType || 'video/mp4', endpoint, durationS: duration, resolution }
}
