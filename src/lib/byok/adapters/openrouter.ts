import 'server-only'
import type { AspectRatio } from '@/lib/engine/types'
import { ASPECT_RATIOS } from '@/lib/engine/types'
import type { Capability, DiscoveredModel, ModelRuns } from '../catalog'
import { ByokError } from '../errors'
import { errorForStatus, providerFetch, readCapped } from '../http'
import { inspectImage } from '../media'
import type { ByokAdapter, VideoStatus } from './types'

/**
 * OpenRouter (a gateway), with the user's key. Contract from OpenRouter's
 * published OpenAPI specification (openrouter.ai/openapi.json).
 *
 *   base URL     https://openrouter.ai/api/v1
 *   auth         Authorization: Bearer <key>
 *   validation   GET /key (401 on an invalid key)
 *   discovery    GET /models (architecture.input_modalities / output_modalities),
 *                GET /videos/models (supported_aspect_ratios, supported_durations,
 *                supported_frame_images), GET /images/models (supported_parameters)
 *   image        POST /images { model, prompt, aspect_ratio? } → data[].b64_json, media_type
 *   video        POST /videos { model, prompt, aspect_ratio?, duration?, frame_images? }
 *                → 202 { id, polling_url, status }
 *   polling      GET /videos/{id} → status: pending | in_progress | completed |
 *                failed | cancelled | expired
 *   download     GET /videos/{id}/content?index=0 → video/mp4
 *   cancel       not offered in this build
 *
 * Every model the user's key can reach is listed, not a Slate-chosen subset;
 * what Slate can run for each comes from OpenRouter's own model metadata.
 */
const BASE = 'https://openrouter.ai/api/v1'
const auth = (key: string) => ({ Authorization: `Bearer ${key}` })
const OURS = new Set<string>(ASPECT_RATIOS)
const JOB_ID = /^[A-Za-z0-9_-]{4,120}$/

async function orError(res: Response): Promise<ByokError> {
  if (res.status === 402) return new ByokError('byok_no_credit')
  if (res.status === 404) return new ByokError('byok_model_unavailable')
  if (res.status === 400 || res.status === 413) return new ByokError('byok_unsupported')
  return errorForStatus(res.status)
}

async function getJson<T>(url: string, key: string, policy: Parameters<ByokAdapter['listModels']>[1]): Promise<T> {
  const res = await providerFetch(url, { headers: auth(key) }, policy)
  if (!res.ok) throw await orError(res)
  return (await res.json().catch(() => ({}))) as T
}

interface OrModel { id?: string; name?: string; architecture?: { input_modalities?: string[]; output_modalities?: string[] } }
interface OrVideoModel { id?: string; name?: string; supported_aspect_ratios?: string[] | null; supported_durations?: number[] | null; supported_frame_images?: string[] | null }
interface OrImageModel { id?: string; name?: string; architecture?: { input_modalities?: string[] }; supported_parameters?: Record<string, unknown> | null }

const ratios = (list: string[] | null | undefined): AspectRatio[] => (list ?? []).filter((r): r is AspectRatio => OURS.has(r))

export const openrouterAdapter: ByokAdapter = {
  id: 'openrouter',

  async listModels(cred, policy) {
    // 1. The key itself: a clean authentication answer before anything else.
    await getJson(`${BASE}/key`, cred.apiKey, policy)

    // 2. Everything the gateway offers, with its modalities.
    const all = new Map<string, DiscoveredModel>()
    let url: string | null = `${BASE}/models`
    for (let page = 0; url && page < 6; page++) {
      const body: { data?: OrModel[]; links?: { next?: string | null } } = await getJson(url, cred.apiKey, policy)
      for (const m of body.data ?? []) {
        if (!m.id) continue
        const inM = m.architecture?.input_modalities ?? []
        const outM = m.architecture?.output_modalities ?? []
        const caps = new Set<Capability>()
        if (outM.includes('text')) caps.add('textToText')
        if (inM.includes('image') && outM.includes('text')) caps.add('imageUnderstanding')
        if (outM.includes('image')) caps.add(inM.includes('image') ? 'imageToImage' : 'textToImage')
        if (outM.includes('image')) caps.add('textToImage')
        if (outM.includes('audio')) caps.add('textToSpeech')
        all.set(m.id, { id: m.id, label: m.name || m.id, capabilities: [...caps], runs: {} })
      }
      const next: string | null | undefined = body.links?.next
      url = next ? new URL(next, 'https://openrouter.ai').toString() : null
      if (url && !url.startsWith(BASE)) url = null
    }

    // 3. What its dedicated image and video APIs can actually run. The key is
    // already proven good; a listing that fails means nothing is runnable
    // there, never that the connection failed.
    const orNothing = (e: unknown) => {
      if (e instanceof ByokError && (e.code === 'byok_auth_failed' || e.code === 'byok_timeout')) throw e
      return {}
    }
    const [videos, images] = await Promise.all([
      getJson<{ data?: OrVideoModel[] }>(`${BASE}/videos/models`, cred.apiKey, policy).catch(orNothing) as Promise<{ data?: OrVideoModel[] }>,
      getJson<{ data?: OrImageModel[] }>(`${BASE}/images/models`, cred.apiKey, policy).catch(orNothing) as Promise<{ data?: OrImageModel[] }>,
    ])
    for (const v of videos.data ?? []) {
      if (!v.id) continue
      const aspects = ratios(v.supported_aspect_ratios)
      const durations = (v.supported_durations ?? []).filter((d) => Number.isInteger(d) && d >= 4 && d <= 30)
      const firstFrame = (v.supported_frame_images ?? []).includes('first_frame')
      const caps: Capability[] = ['textToVideo', ...(firstFrame ? ['imageToVideo' as const] : [])]
      const runs: ModelRuns = aspects.length && durations.length
        ? { video: { aspectRatios: aspects, durations, imageToVideo: firstFrame, progress: false } }
        : {}
      const cur = all.get(v.id)
      all.set(v.id, { id: v.id, label: v.name || cur?.label || v.id, capabilities: [...new Set([...(cur?.capabilities ?? []), ...caps])], runs: { ...cur?.runs, ...runs } })
    }
    for (const im of images.data ?? []) {
      if (!im.id) continue
      const takesRatio = Boolean(im.supported_parameters && 'aspect_ratio' in im.supported_parameters)
      const cur = all.get(im.id)
      const caps: Capability[] = ['textToImage', ...((im.architecture?.input_modalities ?? []).includes('image') ? ['imageToImage' as const] : [])]
      all.set(im.id, {
        id: im.id, label: im.name || cur?.label || im.id,
        capabilities: [...new Set([...(cur?.capabilities ?? []), ...caps])],
        runs: { ...cur?.runs, image: { aspectRatios: takesRatio ? ['21:9', '16:9', '4:3', '1:1', '4:5', '9:16'] : [], quality: false, output: 'Model default' } },
      })
    }
    return [...all.values()].filter((m) => m.capabilities.length)
  },

  async generateImage(cred, job, policy) {
    const res = await providerFetch(`${BASE}/images`, {
      method: 'POST',
      headers: { ...auth(cred.apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: job.model, prompt: job.prompt, aspect_ratio: job.aspectRatio }),
    }, { ...policy, maxRetries: 0 })
    if (!res.ok) throw await orError(res)
    const body = (await res.json().catch(() => null)) as { data?: { b64_json?: string }[] } | null
    const b64 = body?.data?.[0]?.b64_json
    if (!b64) throw new ByokError('byok_bad_output')
    const bytes = Uint8Array.from(Buffer.from(b64, 'base64'))
    const info = inspectImage(bytes)
    if (!info) throw new ByokError('byok_bad_output')
    return { bytes, ...info }
  },

  video: {
    validHandle: (h) => JOB_ID.test(h),

    async submit(cred, job, policy) {
      const res = await providerFetch(`${BASE}/videos`, {
        method: 'POST',
        headers: { ...auth(cred.apiKey), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: job.model, prompt: job.prompt, aspect_ratio: job.aspectRatio, duration: job.durationS,
          ...(job.firstFrame ? { frame_images: [{ type: 'image_url', image_url: { url: job.firstFrame.url }, frame_type: 'first_frame' }] } : {}),
        }),
      }, { ...policy, maxRetries: 0 }) // billable: never repeated
      if (!res.ok) throw await orError(res)
      const body = (await res.json().catch(() => null)) as { id?: string; status?: string } | null
      if (!body?.id || !JOB_ID.test(body.id)) throw new ByokError('byok_failed')
      if (body.status === 'failed') throw new ByokError('byok_job_failed')
      return body.id
    },

    async status(cred, handle, policy): Promise<VideoStatus> {
      if (!JOB_ID.test(handle)) throw new ByokError('byok_unsupported')
      const res = await providerFetch(`${BASE}/videos/${encodeURIComponent(handle)}`, { headers: auth(cred.apiKey) }, policy)
      if (res.status === 404) return { state: 'failed', code: 'byok_job_expired' }
      if (!res.ok) throw await orError(res)
      const v = (await res.json().catch(() => null)) as { status?: string } | null
      switch (v?.status) {
        case 'completed': return { state: 'completed' }
        case 'failed': case 'cancelled': return { state: 'failed', code: 'byok_job_failed' }
        case 'expired': return { state: 'failed', code: 'byok_job_expired' }
        default: return { state: 'pending' } // OpenRouter reports no percentage; none is invented
      }
    },

    async download(cred, handle, policy) {
      if (!JOB_ID.test(handle)) throw new ByokError('byok_unsupported')
      const res = await providerFetch(`${BASE}/videos/${encodeURIComponent(handle)}/content?index=0`, { headers: auth(cred.apiKey) }, policy)
      if (res.status === 404 || res.status === 410) throw new ByokError('byok_job_expired')
      if (res.status === 409) throw new ByokError('byok_job_failed')
      if (!res.ok) throw await orError(res)
      return readCapped(res)
    },
  },
}
