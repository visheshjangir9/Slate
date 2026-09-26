import 'server-only'
import { byokProvider, type Capability, type DiscoveredModel } from '../catalog'
import { ByokError } from '../errors'
import { downloadArtifact, errorForStatus, providerFetch } from '../http'
import { inspectImage } from '../media'
import type { ByokAdapter, VideoStatus } from './types'

/**
 * Google Gemini API (ai.google.dev), with the user's key.
 *
 *   base URL     https://generativelanguage.googleapis.com/v1beta
 *   auth         x-goog-api-key header (never in a URL)
 *   discovery    GET /models (paged, pageSize ≤ 1000): supportedGenerationMethods
 *   image        POST /models/{model}:generateContent, responseModalities IMAGE,
 *                imageConfig.aspectRatio; image in candidates[].content.parts[].inlineData
 *   video (Veo)  POST /models/{model}:predictLongRunning
 *                  { instances: [{ prompt, image?: { inlineData: { mimeType, data } } }],
 *                    parameters: { aspectRatio, durationSeconds } }
 *                → { name } (operation)
 *   polling      GET /{operation name} → { done, error?, response.generateVideoResponse
 *                  .generatedSamples[0].video.uri }
 *   download     GET {uri} with the key header, following the redirect
 *   cancel       not documented for Veo operations: not offered
 *   limits       videos kept by Google for 2 days; 11s–6min latency
 */
const BASE = 'https://generativelanguage.googleapis.com/v1beta'
const auth = (key: string) => ({ 'x-goog-api-key': key })

interface GoogleError { error?: { status?: string; details?: { reason?: string }[] } }

async function googleError(res: Response): Promise<ByokError> {
  // Machine-readable codes only; message text is discarded.
  const body = (await res.json().catch(() => null)) as GoogleError | null
  const reasons = body?.error?.details?.map((d) => d.reason) ?? []
  if (reasons.includes('API_KEY_INVALID') || body?.error?.status === 'UNAUTHENTICATED') return new ByokError('byok_auth_failed')
  if (body?.error?.status === 'RESOURCE_EXHAUSTED') return new ByokError(res.status === 429 ? 'byok_rate_limited' : 'byok_no_credit')
  if (res.status === 404 || body?.error?.status === 'NOT_FOUND') return new ByokError('byok_model_unavailable')
  if (res.status === 400) return new ByokError('byok_unsupported')
  return errorForStatus(res.status)
}

/** Capabilities from Google's own metadata: generation methods plus the documented families. */
function classify(id: string, methods: string[]): Capability[] {
  const caps = new Set<Capability>()
  if (methods.includes('predictLongRunning') && /^veo-/.test(id)) { caps.add('textToVideo'); caps.add('imageToVideo') }
  if (methods.includes('predict') && /^imagen-/.test(id)) caps.add('textToImage')
  if (methods.includes('generateContent')) {
    if (/tts/.test(id)) caps.add('textToSpeech')
    else if (/image/.test(id)) { caps.add('textToImage'); caps.add('imageToImage') }
    else caps.add('textToText')
  }
  return [...caps]
}

const OPERATION = /^models\/[a-z0-9.-]+\/operations\/[a-zA-Z0-9_-]+$/

export const googleAdapter: ByokAdapter = {
  id: 'google',

  async listModels(cred, policy) {
    const out: DiscoveredModel[] = []
    const runsFor = byokProvider('google')!.staticRuns!
    let pageToken = ''
    for (let page = 0; page < 3; page++) {
      const url = `${BASE}/models?pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`
      const res = await providerFetch(url, { headers: auth(cred.apiKey) }, policy)
      if (!res.ok) throw await googleError(res)
      const body = (await res.json().catch(() => null)) as {
        models?: { name?: string; displayName?: string; supportedGenerationMethods?: string[] }[]
        nextPageToken?: string
      } | null
      for (const m of body?.models ?? []) {
        const id = (m.name ?? '').replace(/^models\//, '')
        const capabilities = classify(id, m.supportedGenerationMethods ?? [])
        if (!id || !capabilities.length) continue
        // Only what the adapter implements for this model is runnable.
        const staticRuns = runsFor(id) ?? {}
        const runs = {
          ...(staticRuns.image && m.supportedGenerationMethods?.includes('generateContent') ? { image: staticRuns.image } : {}),
          ...(staticRuns.video && m.supportedGenerationMethods?.includes('predictLongRunning') ? { video: staticRuns.video } : {}),
        }
        out.push({ id, label: m.displayName || id, capabilities, runs })
      }
      pageToken = body?.nextPageToken ?? ''
      if (!pageToken) break
    }
    return out
  },

  async generateImage(cred, job, policy) {
    const res = await providerFetch(`${BASE}/models/${encodeURIComponent(job.model)}:generateContent`, {
      method: 'POST',
      headers: { ...auth(cred.apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: job.prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: job.aspectRatio } },
      }),
    }, { ...policy, maxRetries: 0 })
    if (!res.ok) throw await googleError(res)
    const body = (await res.json().catch(() => null)) as {
      promptFeedback?: { blockReason?: string }
      candidates?: { finishReason?: string; content?: { parts?: { inlineData?: { data?: string }; inline_data?: { data?: string } }[] } }[]
    } | null
    if (body?.promptFeedback?.blockReason) throw new ByokError('byok_blocked')
    const cand = body?.candidates?.[0]
    if (cand?.finishReason && /SAFETY|PROHIBITED|BLOCK/i.test(cand.finishReason)) throw new ByokError('byok_blocked')
    const part = cand?.content?.parts?.find((p) => p.inlineData?.data || p.inline_data?.data)
    const b64 = part?.inlineData?.data ?? part?.inline_data?.data
    if (!b64) throw new ByokError('byok_bad_output')
    const bytes = Uint8Array.from(Buffer.from(b64, 'base64'))
    const info = inspectImage(bytes)
    if (!info) throw new ByokError('byok_bad_output')
    return { bytes, ...info }
  },

  video: {
    validHandle: (h) => OPERATION.test(h),

    async submit(cred, job, policy) {
      const instance: Record<string, unknown> = { prompt: job.prompt }
      if (job.firstFrame) instance.image = { inlineData: { mimeType: job.firstFrame.mime, data: Buffer.from(job.firstFrame.bytes).toString('base64') } }
      const res = await providerFetch(`${BASE}/models/${encodeURIComponent(job.model)}:predictLongRunning`, {
        method: 'POST',
        headers: { ...auth(cred.apiKey), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [instance],
          parameters: { aspectRatio: job.aspectRatio, durationSeconds: String(job.durationS) },
        }),
      }, { ...policy, maxRetries: 0 }) // billable: never repeated
      if (!res.ok) throw await googleError(res)
      const body = (await res.json().catch(() => null)) as { name?: string } | null
      if (!body?.name || !OPERATION.test(body.name)) throw new ByokError('byok_failed')
      return body.name
    },

    async status(cred, handle, policy): Promise<VideoStatus> {
      if (!OPERATION.test(handle)) throw new ByokError('byok_unsupported')
      const res = await providerFetch(`${BASE}/${handle}`, { headers: auth(cred.apiKey) }, policy)
      if (res.status === 404) return { state: 'failed', code: 'byok_job_expired' }
      if (!res.ok) throw await googleError(res)
      const op = (await res.json().catch(() => null)) as {
        done?: boolean
        error?: { code?: number }
        response?: { generateVideoResponse?: { raiMediaFilteredCount?: number; generatedSamples?: { video?: { uri?: string } }[] } }
      } | null
      if (!op?.done) return { state: 'pending' } // Veo reports no progress; none is invented
      if (op.error) return { state: 'failed', code: op.error.code === 8 ? 'byok_no_credit' : op.error.code === 3 ? 'byok_unsupported' : 'byok_job_failed' }
      const r = op.response?.generateVideoResponse
      if (r?.raiMediaFilteredCount) return { state: 'failed', code: 'byok_blocked' }
      return r?.generatedSamples?.[0]?.video?.uri ? { state: 'completed' } : { state: 'failed', code: 'byok_job_failed' }
    },

    async download(cred, handle, policy) {
      if (!OPERATION.test(handle)) throw new ByokError('byok_unsupported')
      const res = await providerFetch(`${BASE}/${handle}`, { headers: auth(cred.apiKey) }, policy)
      if (!res.ok) throw await googleError(res)
      const op = (await res.json().catch(() => null)) as { response?: { generateVideoResponse?: { generatedSamples?: { video?: { uri?: string } }[] } } } | null
      const uri = op?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri
      if (!uri) throw new ByokError('byok_job_failed')
      // The URI must be Google's own; the key goes only there.
      return downloadArtifact(uri, auth(cred.apiKey), policy)
    },
  },
}
