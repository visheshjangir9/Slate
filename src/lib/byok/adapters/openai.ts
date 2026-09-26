import 'server-only'
import { byokProvider, type Capability, type DiscoveredModel } from '../catalog'
import { ByokError } from '../errors'
import { errorForStatus, providerFetch, readCapped } from '../http'
import { inspectImage } from '../media'
import { centerCropJpeg } from '@/lib/images/centerCrop'
import { gptNativeSize, imageOutputDims, IMAGE_QUALITY } from '@/lib/images/dims'
import type { ByokAdapter, VideoStatus } from './types'

/**
 * OpenAI API, with the user's key. Separate from Slate's own GPT Image path
 * (lib/images/gptImage.ts), which uses the server's key: the two never share
 * a credential.
 *
 *   base URL     https://api.openai.com/v1
 *   auth         Authorization: Bearer <key>
 *   discovery    GET /models (ids only; OpenAI publishes no capability
 *                metadata, so capabilities follow its documented families)
 *   image        POST /images/generations (gpt-image-*), b64_json
 *   video (Sora) POST /videos { model, prompt, seconds: "4"|"8"|"12", size }
 *                → video object { id, status: queued|in_progress|completed|failed,
 *                  progress, error }
 *   polling      GET /videos/{id} (progress is real provider progress)
 *   download     GET /videos/{id}/content → MP4
 *   cancel       not offered in this build
 */
const BASE = 'https://api.openai.com/v1'
const auth = (key: string) => ({ Authorization: `Bearer ${key}` })

async function openaiError(res: Response): Promise<ByokError> {
  const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null
  const code = body?.error?.code ?? ''
  if (code === 'insufficient_quota' || code === 'billing_hard_limit_reached') return new ByokError('byok_no_credit')
  if (code === 'moderation_blocked' || code === 'content_policy_violation') return new ByokError('byok_blocked')
  if (code === 'model_not_found') return new ByokError('byok_model_unavailable')
  // 403 here is usually a model the organisation cannot use yet, not a bad key.
  if (res.status === 403) return new ByokError('byok_model_unavailable')
  if (res.status === 400) return new ByokError('byok_unsupported')
  return errorForStatus(res.status)
}

/** OpenAI's documented model families. Anything unrecognised gets no capability. */
function classify(id: string): Capability[] {
  if (/^gpt-image-|^dall-e-/.test(id)) return ['textToImage']
  if (/^sora-/.test(id)) return ['textToVideo', 'imageToVideo']
  if (/^whisper-|transcribe/.test(id)) return ['speechToText']
  if (/^tts-|-tts/.test(id)) return ['textToSpeech']
  if (/embedding|moderation|realtime|audio|search/.test(id)) return []
  if (/^(gpt-|o\d|chatgpt-)/.test(id)) return ['textToText']
  return []
}

const VIDEO_ID = /^[A-Za-z0-9_-]{4,120}$/
const SIZE: Record<string, string> = { '16:9': '1280x720', '9:16': '720x1280' }

export const openaiAdapter: ByokAdapter = {
  id: 'openai',

  async listModels(cred, policy) {
    const res = await providerFetch(`${BASE}/models`, { headers: auth(cred.apiKey) }, policy)
    if (!res.ok) throw await openaiError(res)
    const body = (await res.json().catch(() => null)) as { data?: { id?: string }[] } | null
    const runsFor = byokProvider('openai')!.staticRuns!
    return (body?.data ?? [])
      .map((m) => m.id ?? '')
      .filter(Boolean)
      .sort()
      .flatMap((id) => {
        const capabilities = classify(id)
        return capabilities.length ? [{ id, label: id, capabilities, runs: runsFor(id) ?? {} } satisfies DiscoveredModel] : []
      })
  },

  async generateImage(cred, job, policy) {
    const native = gptNativeSize(job.aspectRatio)
    const res = await providerFetch(`${BASE}/images/generations`, {
      method: 'POST',
      headers: { ...auth(cred.apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: job.model, prompt: job.prompt, size: `${native.width}x${native.height}`,
        quality: IMAGE_QUALITY[job.quality], output_format: 'jpeg', output_compression: 95, n: 1,
      }),
    }, { ...policy, maxRetries: 0 })
    if (!res.ok) throw await openaiError(res)
    const body = (await res.json().catch(() => null)) as { data?: { b64_json?: string }[] } | null
    const b64 = body?.data?.[0]?.b64_json
    if (!b64) throw new ByokError('byok_bad_output')
    const raw = Uint8Array.from(Buffer.from(b64, 'base64'))
    if (!inspectImage(raw)) throw new ByokError('byok_bad_output')
    // Same framing as Slate's own GPT Image: native size, centre-cropped to the ratio.
    const out = imageOutputDims(job.aspectRatio)
    const bytes = centerCropJpeg(raw, out.width, out.height)
    if (!bytes) throw new ByokError('byok_bad_output')
    return { bytes, mime: 'image/jpeg', ext: 'jpg', width: out.width, height: out.height }
  },

  video: {
    validHandle: (h) => VIDEO_ID.test(h),

    async submit(cred, job, policy) {
      const size = SIZE[job.aspectRatio]
      if (!size) throw new ByokError('byok_unsupported')
      const res = await providerFetch(`${BASE}/videos`, {
        method: 'POST',
        headers: { ...auth(cred.apiKey), 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: job.model, prompt: job.prompt, seconds: String(job.durationS), size }),
      }, { ...policy, maxRetries: 0 }) // billable: never repeated
      if (!res.ok) throw await openaiError(res)
      const body = (await res.json().catch(() => null)) as { id?: string; status?: string } | null
      if (!body?.id || !VIDEO_ID.test(body.id)) throw new ByokError('byok_failed')
      if (body.status === 'failed') throw new ByokError('byok_job_failed')
      return body.id
    },

    async status(cred, handle, policy): Promise<VideoStatus> {
      if (!VIDEO_ID.test(handle)) throw new ByokError('byok_unsupported')
      const res = await providerFetch(`${BASE}/videos/${encodeURIComponent(handle)}`, { headers: auth(cred.apiKey) }, policy)
      if (res.status === 404) return { state: 'failed', code: 'byok_job_expired' }
      if (!res.ok) throw await openaiError(res)
      const v = (await res.json().catch(() => null)) as { status?: string; progress?: number } | null
      if (v?.status === 'completed') return { state: 'completed' }
      if (v?.status === 'failed') return { state: 'failed', code: 'byok_job_failed' }
      // Real provider progress, only when OpenAI reports it.
      const p = typeof v?.progress === 'number' && v.progress >= 0 && v.progress <= 100 ? Math.round(v.progress) : undefined
      return { state: 'pending', progress: p }
    },

    async download(cred, handle, policy) {
      if (!VIDEO_ID.test(handle)) throw new ByokError('byok_unsupported')
      const res = await providerFetch(`${BASE}/videos/${encodeURIComponent(handle)}/content`, { headers: auth(cred.apiKey) }, policy)
      if (res.status === 404 || res.status === 410) throw new ByokError('byok_job_expired')
      if (!res.ok) throw await openaiError(res)
      return readCapped(res)
    },
  },
}
