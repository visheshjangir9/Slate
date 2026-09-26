import { afterEach, describe, expect, it, vi } from 'vitest'
import { googleAdapter } from '@/lib/byok/adapters/google'
import { openaiAdapter } from '@/lib/byok/adapters/openai'
import { anthropicAdapter, mistralAdapter } from '@/lib/byok/adapters/text'
import { ByokError } from '@/lib/byok/errors'
import { providerFetch } from '@/lib/byok/http'
import { inspectImage } from '@/lib/byok/media'
import { inspectMp4 } from '@/lib/byok/mp4'
import { downloadVideo, generateImage, submitVideo, testConnection, videoStatus } from '@/lib/byok/service'
import { DEFAULT_BYOK_SETTINGS, parseByokModelId } from '@/lib/byok/catalog'
import {
  FAKE_ANTHROPIC_KEY, FAKE_GOOGLE_KEY, FAKE_MISTRAL_KEY, FAKE_OPENAI_KEY, FAKE_OPENROUTER_KEY,
  b64, bytesResponse, json, jpegBytes, mp4Bytes, pngBytes,
} from '@/tests/fixtures'

const policy = { timeoutMs: 2000, maxRetries: 0, sleep: async () => {} }
const google = { providerId: 'google' as const, apiKey: FAKE_GOOGLE_KEY }
const openai = { providerId: 'openai' as const, apiKey: FAKE_OPENAI_KEY }
const openrouter = { providerId: 'openrouter' as const, apiKey: FAKE_OPENROUTER_KEY }
const anthropic = { providerId: 'anthropic' as const, apiKey: FAKE_ANTHROPIC_KEY }
const mistral = { providerId: 'mistral' as const, apiKey: FAKE_MISTRAL_KEY }

const OP = 'models/veo-3.1-generate-preview/operations/abc123'
const VEO = parseByokModelId('byok:google:video:veo-3.1-generate-preview')!
const NANO = parseByokModelId('byok:google:image:gemini-2.5-flash-image')!
const SORA = parseByokModelId('byok:openai:video:sora-2')!

function stubFetch(...responses: (Response | (() => Promise<Response>))[]) {
  const calls: { url: string; init: RequestInit }[] = []
  const fn = vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init })
    const next = responses.shift()
    if (!next) throw new Error(`unexpected extra request to ${url}`)
    return typeof next === 'function' ? next() : next
  })
  vi.stubGlobal('fetch', fn)
  return { fn, calls }
}

/** Whatever an adapter throws must be a fixed, key-free ByokError. */
async function caught(p: Promise<unknown>): Promise<ByokError> {
  try { await p } catch (e) { return e as ByokError }
  throw new Error('expected a rejection')
}

afterEach(() => { vi.unstubAllGlobals() })

describe('Google adapter: discovery', () => {
  it('reports capabilities from generation methods; only documented families can run', async () => {
    const { calls } = stubFetch(json({
      models: [
        { name: 'models/gemini-2.5-flash-image', displayName: 'Nano Banana', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/veo-3.1-generate-preview', displayName: 'Veo 3.1', supportedGenerationMethods: ['predictLongRunning'] },
        { name: 'models/veo-3.0-generate-001', supportedGenerationMethods: ['predictLongRunning'] },
        { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
      ],
    }))
    const models = await googleAdapter.listModels(google, policy)
    const by = Object.fromEntries(models.map((m) => [m.id, m]))
    expect(Object.keys(by)).toEqual(['gemini-2.5-flash-image', 'veo-3.1-generate-preview', 'veo-3.0-generate-001', 'gemini-2.5-pro'])

    expect(by['gemini-2.5-flash-image'].runs.image).toBeDefined()
    expect(by['gemini-2.5-flash-image'].runs.video).toBeUndefined()
    expect(by['veo-3.1-generate-preview'].capabilities).toEqual(expect.arrayContaining(['textToVideo', 'imageToVideo']))
    expect(by['veo-3.1-generate-preview'].runs.video).toMatchObject({ durations: [4, 6, 8], aspectRatios: ['16:9', '9:16'], imageToVideo: true, progress: false })
    expect(by['veo-3.0-generate-001'].runs.video?.durations).toEqual([8])
    // A text model: listed, with its capability, but runs nothing in Slate.
    expect(by['gemini-2.5-pro'].capabilities).toEqual(['textToText'])
    expect(by['gemini-2.5-pro'].runs).toEqual({})

    expect(calls[0].url).not.toContain(FAKE_GOOGLE_KEY)
    expect(new Headers(calls[0].init.headers).get('x-goog-api-key')).toBe(FAKE_GOOGLE_KEY)
  })

  it('maps an invalid key to an authentication failure without echoing anything', async () => {
    stubFetch(json({ error: { status: 'INVALID_ARGUMENT', message: `API key not valid: ${FAKE_GOOGLE_KEY}`, details: [{ reason: 'API_KEY_INVALID' }] } }, 400))
    const e = await caught(googleAdapter.listModels(google, policy))
    expect(e).toBeInstanceOf(ByokError)
    expect(e.code).toBe('byok_auth_failed')
    expect(e.message).toBe('The provider rejected this key.')
    expect(e.message).not.toContain(FAKE_GOOGLE_KEY)
  })
})

describe('Google adapter: image', () => {
  it('generates: sends the ratio, returns validated PNG bytes and dimensions', async () => {
    const png = pngBytes(1344, 768)
    const { calls } = stubFetch(json({ candidates: [{ content: { parts: [{ text: 'here' }, { inlineData: { mimeType: 'image/png', data: b64(png) } }] } }] }))
    const art = await googleAdapter.generateImage!(google, { model: 'gemini-2.5-flash-image', prompt: 'a red door', aspectRatio: '16:9', quality: 'standard' }, policy)
    expect(art).toMatchObject({ mime: 'image/png', ext: 'png', width: 1344, height: 768 })
    expect(calls[0].url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent')
    const body = JSON.parse(String(calls[0].init.body))
    expect(body.generationConfig).toEqual({ responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9' } })
    expect(String(calls[0].init.body)).not.toContain(FAKE_GOOGLE_KEY)
  })

  it('refuses output that is not an image, and reports safety blocks', async () => {
    const job = { model: 'gemini-2.5-flash-image', prompt: 'x', aspectRatio: '1:1' as const, quality: 'standard' as const }
    stubFetch(json({ candidates: [{ content: { parts: [{ inlineData: { data: b64(new TextEncoder().encode('<html>nope</html>'.repeat(4))) } }] } }] }))
    expect((await caught(googleAdapter.generateImage!(google, job, policy))).code).toBe('byok_bad_output')
    stubFetch(json({ promptFeedback: { blockReason: 'SAFETY' } }))
    expect((await caught(googleAdapter.generateImage!(google, job, policy))).code).toBe('byok_blocked')
  })
})

describe('Google adapter: Veo video', () => {
  it('submits once to predictLongRunning with the documented body and returns the operation name', async () => {
    const { calls } = stubFetch(json({ name: OP }))
    const handle = await submitVideo(google, VEO, { prompt: 'waves at dusk', aspectRatio: '9:16', durationS: 6 }, DEFAULT_BYOK_SETTINGS)
    expect(handle).toBe(OP)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning')
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      instances: [{ prompt: 'waves at dusk' }],
      parameters: { aspectRatio: '9:16', durationSeconds: '6' },
    })
  })

  it('sends a first frame as inline image data', async () => {
    const { calls } = stubFetch(json({ name: OP }))
    const frame = jpegBytes(64, 36)
    await submitVideo(google, VEO, { prompt: 'x', aspectRatio: '16:9', durationS: 8, firstFrame: { bytes: frame, mime: 'image/jpeg', url: '/api/blob/f.jpg' } }, DEFAULT_BYOK_SETTINGS)
    const body = JSON.parse(String(calls[0].init.body))
    expect(body.instances[0].image).toEqual({ inlineData: { mimeType: 'image/jpeg', data: b64(frame) } })
  })

  it('never retries a billable submit, even on a rate limit', async () => {
    const { fn } = stubFetch(json({ error: { status: 'RESOURCE_EXHAUSTED' } }, 429), json({ name: OP }))
    const e = await caught(submitVideo(google, VEO, { prompt: 'x', aspectRatio: '16:9', durationS: 8 }, { timeoutS: 30, maxRetries: 2 }))
    expect(e.code).toBe('byok_rate_limited')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('refuses parameters the model does not document, before any request', async () => {
    const { fn } = stubFetch()
    expect((await caught(submitVideo(google, VEO, { prompt: 'x', aspectRatio: '1:1', durationS: 8 }, DEFAULT_BYOK_SETTINGS))).code).toBe('byok_unsupported')
    expect((await caught(submitVideo(google, VEO, { prompt: 'x', aspectRatio: '16:9', durationS: 5 }, DEFAULT_BYOK_SETTINGS))).code).toBe('byok_unsupported')
    const veo3 = parseByokModelId('byok:google:video:veo-3.0-generate-001')!
    expect((await caught(submitVideo(google, veo3, { prompt: 'x', aspectRatio: '16:9', durationS: 4 }, DEFAULT_BYOK_SETTINGS))).code).toBe('byok_unsupported')
    expect(fn).not.toHaveBeenCalled()
  })

  it('status: pending with no invented progress, completed, failed, blocked, expired', async () => {
    stubFetch(json({ name: OP, done: false }))
    expect(await videoStatus(google, VEO, OP, DEFAULT_BYOK_SETTINGS)).toEqual({ state: 'pending' })
    stubFetch(json({ name: OP, done: true, response: { generateVideoResponse: { generatedSamples: [{ video: { uri: 'https://generativelanguage.googleapis.com/v1beta/files/x:download?alt=media' } }] } } }))
    expect(await videoStatus(google, VEO, OP, DEFAULT_BYOK_SETTINGS)).toEqual({ state: 'completed' })
    stubFetch(json({ name: OP, done: true, error: { code: 13, message: 'internal' } }))
    expect(await videoStatus(google, VEO, OP, DEFAULT_BYOK_SETTINGS)).toEqual({ state: 'failed', code: 'byok_job_failed' })
    stubFetch(json({ name: OP, done: true, response: { generateVideoResponse: { raiMediaFilteredCount: 1 } } }))
    expect(await videoStatus(google, VEO, OP, DEFAULT_BYOK_SETTINGS)).toEqual({ state: 'failed', code: 'byok_blocked' })
    stubFetch(json({}, 404))
    expect(await videoStatus(google, VEO, OP, DEFAULT_BYOK_SETTINGS)).toEqual({ state: 'failed', code: 'byok_job_expired' })
  })

  it('refuses a job handle it could not have issued', async () => {
    const { fn } = stubFetch()
    for (const bad of ['../../v1/models', 'https://evil.example/x', 'models/veo/operations/a/../../b']) {
      expect((await caught(videoStatus(google, VEO, bad, DEFAULT_BYOK_SETTINGS))).code).toBe('byok_unsupported')
    }
    expect(fn).not.toHaveBeenCalled()
  })

  it('downloads the real file: key only to Google, redirect followed to Google storage without the key', async () => {
    const mp4 = mp4Bytes({ durationS: 6 })
    const uri = 'https://generativelanguage.googleapis.com/v1beta/files/abc:download?alt=media'
    const { calls } = stubFetch(
      json({ name: OP, done: true, response: { generateVideoResponse: { generatedSamples: [{ video: { uri } }] } } }),
      new Response(null, { status: 302, headers: { location: 'https://video-downloads.googleusercontent.com/abc' } }),
      bytesResponse(mp4),
    )
    const bytes = await downloadVideo(google, VEO, OP)
    expect(inspectMp4(bytes)).toMatchObject({ durationS: 6, width: 1280, height: 720 })
    expect(calls[1].url).toBe(uri)
    expect(new Headers(calls[1].init.headers).get('x-goog-api-key')).toBe(FAKE_GOOGLE_KEY)
    expect(calls[2].url).toBe('https://video-downloads.googleusercontent.com/abc')
    expect(new Headers(calls[2].init.headers).get('x-goog-api-key')).toBeNull()
  })

  it('never follows a download redirect to a host outside the provider’s storage', async () => {
    const uri = 'https://generativelanguage.googleapis.com/v1beta/files/abc:download?alt=media'
    stubFetch(
      json({ name: OP, done: true, response: { generateVideoResponse: { generatedSamples: [{ video: { uri } }] } } }),
      new Response(null, { status: 302, headers: { location: 'https://169.254.169.254/latest/meta-data' } }),
    )
    expect((await caught(downloadVideo(google, VEO, OP))).code).toBe('byok_bad_video')
  })
})

describe('OpenAI adapter', () => {
  it('discovers every documented family with its capability, and only GPT Image and Sora run', async () => {
    stubFetch(json({ data: [{ id: 'gpt-4o' }, { id: 'gpt-image-1' }, { id: 'dall-e-3' }, { id: 'sora-2' }, { id: 'whisper-1' }, { id: 'text-embedding-3-small' }] }))
    const models = await openaiAdapter.listModels(openai, policy)
    const by = Object.fromEntries(models.map((m) => [m.id, m]))
    expect(Object.keys(by).sort()).toEqual(['dall-e-3', 'gpt-4o', 'gpt-image-1', 'sora-2', 'whisper-1'])
    expect(by['gpt-image-1'].runs.image).toMatchObject({ quality: true })
    expect(by['sora-2'].runs.video).toMatchObject({ durations: [4, 8, 12], imageToVideo: false, progress: true })
    // A speech model is not an image or video model.
    expect(by['whisper-1'].capabilities).toEqual(['speechToText'])
    expect(by['whisper-1'].runs).toEqual({})
    expect(by['gpt-4o'].runs).toEqual({})
    expect(by['dall-e-3'].runs).toEqual({})
  })

  it('normalises auth, quota and moderation failures', async () => {
    stubFetch(json({ error: { message: `Incorrect API key provided: ${FAKE_OPENAI_KEY}` } }, 401))
    const auth = await caught(openaiAdapter.listModels(openai, policy))
    expect(auth.code).toBe('byok_auth_failed')
    expect(auth.message).not.toContain(FAKE_OPENAI_KEY)

    const job = { model: 'gpt-image-1', prompt: 'x', aspectRatio: '1:1' as const, quality: 'high' as const }
    stubFetch(json({ error: { code: 'insufficient_quota' } }, 429))
    expect((await caught(openaiAdapter.generateImage!(openai, job, policy))).code).toBe('byok_no_credit')
    stubFetch(json({ error: { code: 'moderation_blocked' } }, 400))
    expect((await caught(openaiAdapter.generateImage!(openai, job, policy))).code).toBe('byok_blocked')
  })

  it('generates an image: requests the native size, crops to the ratio, returns JPEG', async () => {
    const { calls } = stubFetch(json({ data: [{ b64_json: b64(jpegBytes(1536, 1024)) }] }))
    const art = await openaiAdapter.generateImage!(openai, { model: 'gpt-image-1', prompt: 'a red door', aspectRatio: '16:9', quality: 'high' }, policy)
    expect(art.mime).toBe('image/jpeg')
    const info = inspectImage(art.bytes)!
    expect(info.width / info.height).toBeCloseTo(16 / 9, 1)
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({ model: 'gpt-image-1', size: '1536x1024', n: 1 })
    expect(new Headers(calls[0].init.headers).get('authorization')).toBe(`Bearer ${FAKE_OPENAI_KEY}`)
  })

  it('Sora: submit, real progress while rendering, then the MP4 content', async () => {
    const { calls } = stubFetch(json({ id: 'video_123', status: 'queued' }))
    expect(await submitVideo(openai, SORA, { prompt: 'x', aspectRatio: '16:9', durationS: 8 }, DEFAULT_BYOK_SETTINGS)).toBe('video_123')
    expect(calls[0].url).toBe('https://api.openai.com/v1/videos')
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ model: 'sora-2', prompt: 'x', seconds: '8', size: '1280x720' })

    stubFetch(json({ id: 'video_123', status: 'in_progress', progress: 42 }))
    expect(await videoStatus(openai, SORA, 'video_123', DEFAULT_BYOK_SETTINGS)).toEqual({ state: 'pending', progress: 42 })
    stubFetch(json({ id: 'video_123', status: 'in_progress' }))
    expect(await videoStatus(openai, SORA, 'video_123', DEFAULT_BYOK_SETTINGS)).toEqual({ state: 'pending', progress: undefined })

    const mp4 = mp4Bytes({ durationS: 8 })
    const dl = stubFetch(bytesResponse(mp4))
    expect(inspectMp4(await downloadVideo(openai, SORA, 'video_123'))).toMatchObject({ durationS: 8 })
    expect(dl.calls[0].url).toBe('https://api.openai.com/v1/videos/video_123/content')
  })

  it('Sora does not take a first frame in Slate: refused, no fallback, no request', async () => {
    const { fn } = stubFetch()
    const e = await caught(submitVideo(openai, SORA, { prompt: 'x', aspectRatio: '16:9', durationS: 8, firstFrame: { bytes: jpegBytes(8, 8), mime: 'image/jpeg', url: '/api/blob/f.jpg' } }, DEFAULT_BYOK_SETTINGS))
    expect(e.code).toBe('byok_capability_unavailable')
    expect(fn).not.toHaveBeenCalled()
  })
})

describe('OpenRouter adapter', () => {
  const discovery = () => stubFetch(
    json({ data: { label: 'test' } }),
    json({ data: [
      { id: 'openai/gpt-4o', name: 'GPT-4o', architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] } },
      { id: 'google/gemini-2.5-flash-image', name: 'Nano Banana', architecture: { input_modalities: ['text', 'image'], output_modalities: ['text', 'image'] } },
    ], links: { next: null } }),
    json({ data: [{ id: 'google/veo-3.1', name: 'Veo 3.1', supported_aspect_ratios: ['16:9', '9:16', '3:2'], supported_durations: [4, 6, 8], supported_frame_images: ['first_frame', 'last_frame'] }] }),
    json({ data: [{ id: 'google/gemini-2.5-flash-image', supported_parameters: { aspect_ratio: {} } }] }),
  )

  it('validates the key, then discovers every model with capabilities from gateway metadata', async () => {
    const { calls } = discovery()
    const models = await testConnection(openrouter, DEFAULT_BYOK_SETTINGS)
    expect(calls.map((c) => c.url)).toEqual([
      'https://openrouter.ai/api/v1/key', 'https://openrouter.ai/api/v1/models',
      'https://openrouter.ai/api/v1/videos/models', 'https://openrouter.ai/api/v1/images/models',
    ])
    const by = Object.fromEntries(models.map((m) => [m.id, m]))
    expect(by['openai/gpt-4o'].capabilities).toEqual(['textToText', 'imageUnderstanding'])
    expect(by['openai/gpt-4o'].runs).toEqual({})
    expect(by['google/gemini-2.5-flash-image'].runs.image).toBeDefined()
    // Only ratios Slate has; only what the gateway reports.
    expect(by['google/veo-3.1'].runs.video).toEqual({ aspectRatios: ['16:9', '9:16'], durations: [4, 6, 8], imageToVideo: true, progress: false })
    for (const c of calls) expect(c.url).not.toContain(FAKE_OPENROUTER_KEY)
  })

  it('an invalid key fails at /key, before any listing', async () => {
    const { fn } = stubFetch(json({ error: { message: 'No auth credentials found' } }, 401))
    expect((await caught(testConnection(openrouter, DEFAULT_BYOK_SETTINGS))).code).toBe('byok_auth_failed')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('video: submit with a first frame, status without invented progress, MP4 content', async () => {
    const target = parseByokModelId('byok:openrouter:video:google/veo-3.1')!
    const { calls } = stubFetch(json({ id: 'job_abc', polling_url: 'https://openrouter.ai/api/v1/videos/job_abc', status: 'pending' }, 202))
    await submitVideo(openrouter, target, { prompt: 'x', aspectRatio: '16:9', durationS: 6, firstFrame: { bytes: jpegBytes(8, 8), mime: 'image/jpeg', url: 'https://example.supabase.co/storage/v1/object/public/outputs/f.jpg' } }, DEFAULT_BYOK_SETTINGS)
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      model: 'google/veo-3.1', prompt: 'x', aspect_ratio: '16:9', duration: 6,
      frame_images: [{ type: 'image_url', image_url: { url: 'https://example.supabase.co/storage/v1/object/public/outputs/f.jpg' }, frame_type: 'first_frame' }],
    })
    stubFetch(json({ id: 'job_abc', status: 'in_progress' }))
    expect(await videoStatus(openrouter, target, 'job_abc', DEFAULT_BYOK_SETTINGS)).toEqual({ state: 'pending' })
    stubFetch(json({ id: 'job_abc', status: 'expired' }))
    expect(await videoStatus(openrouter, target, 'job_abc', DEFAULT_BYOK_SETTINGS)).toEqual({ state: 'failed', code: 'byok_job_expired' })
    const dl = stubFetch(bytesResponse(mp4Bytes()))
    expect(inspectMp4(await downloadVideo(openrouter, target, 'job_abc'))).not.toBeNull()
    expect(dl.calls[0].url).toBe('https://openrouter.ai/api/v1/videos/job_abc/content?index=0')
  })
})

describe('Text providers: connect and discover, never generate', () => {
  it('Anthropic: published capabilities, no runnable models', async () => {
    const { calls } = stubFetch(json({ data: [
      { id: 'claude-opus-4-1', display_name: 'Claude Opus 4.1', capabilities: { image_input: { supported: true } } },
      { id: 'claude-haiku-4-5', capabilities: null },
    ], has_more: false }))
    const models = await testConnection(anthropic, DEFAULT_BYOK_SETTINGS)
    expect(models.map((m) => m.capabilities)).toEqual([['textToText', 'imageUnderstanding'], ['textToText']])
    expect(models.every((m) => !m.runs.image && !m.runs.video)).toBe(true)
    expect(new Headers(calls[0].init.headers).get('anthropic-version')).toBe('2023-06-01')
    expect(new Headers(calls[0].init.headers).get('x-api-key')).toBe(FAKE_ANTHROPIC_KEY)
    expect(anthropicAdapter.generateImage).toBeUndefined()
    expect(anthropicAdapter.video).toBeUndefined()
  })

  it('Mistral: archived models dropped, vision reported, nothing runnable', async () => {
    stubFetch(json({ data: [
      { id: 'mistral-large-latest', capabilities: { completion_chat: true, vision: true } },
      { id: 'old-model', archived: true, capabilities: { completion_chat: true } },
    ] }))
    const models = await testConnection(mistral, DEFAULT_BYOK_SETTINGS)
    expect(models).toEqual([{ id: 'mistral-large-latest', label: 'mistral-large-latest', capabilities: ['textToText', 'imageUnderstanding'], runs: {} }])
    expect(mistralAdapter.video).toBeUndefined()
  })

  it('an invalid key is an auth failure', async () => {
    stubFetch(json({}, 401))
    expect((await caught(testConnection(anthropic, DEFAULT_BYOK_SETTINGS))).code).toBe('byok_auth_failed')
    stubFetch(json({}, 401))
    expect((await caught(testConnection(mistral, DEFAULT_BYOK_SETTINGS))).code).toBe('byok_auth_failed')
  })
})

describe('service rules', () => {
  it('a key for one provider is never used for another provider’s model', async () => {
    const { fn } = stubFetch()
    expect((await caught(generateImage(openai, NANO, { prompt: 'x', aspectRatio: '1:1', quality: 'standard' }, DEFAULT_BYOK_SETTINGS))).code).toBe('byok_key_missing')
    expect((await caught(submitVideo(openai, VEO, { prompt: 'x', aspectRatio: '16:9', durationS: 8 }, DEFAULT_BYOK_SETTINGS))).code).toBe('byok_key_missing')
    expect(fn).not.toHaveBeenCalled()
  })

  it('an image model cannot be asked for video, or the reverse', async () => {
    const { fn } = stubFetch()
    expect((await caught(submitVideo(google, NANO, { prompt: 'x', aspectRatio: '16:9', durationS: 8 }, DEFAULT_BYOK_SETTINGS))).code).toBe('byok_capability_unavailable')
    expect((await caught(generateImage(google, VEO, { prompt: 'x', aspectRatio: '16:9', quality: 'standard' }, DEFAULT_BYOK_SETTINGS))).code).toBe('byok_capability_unavailable')
    expect(fn).not.toHaveBeenCalled()
  })

  it('a connection test is discovery only and never generates', async () => {
    const { calls } = stubFetch(json({ models: [] }))
    await testConnection(google, DEFAULT_BYOK_SETTINGS)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toContain('/v1beta/models?')
    expect(calls[0].init.method ?? 'GET').toBe('GET')
  })
})

describe('HTTP policy', () => {
  it('retries only rate limits and 5xx, and never more than the bound', async () => {
    const { fn } = stubFetch(json({}, 429), json({}, 503), json({ ok: true }))
    const res = await providerFetch('https://api.openai.com/v1/models', {}, { ...policy, maxRetries: 2 })
    expect(res.status).toBe(200)
    expect(fn).toHaveBeenCalledTimes(3)

    const capped = stubFetch(json({}, 429), json({}, 429), json({}, 429), json({}, 429))
    const last = await providerFetch('https://api.openai.com/v1/models', {}, { ...policy, maxRetries: 5 })
    expect(last.status).toBe(429)
    expect(capped.fn).toHaveBeenCalledTimes(3) // 1 + at most 2 retries, whatever is asked
  })

  it('never retries a rejected request', async () => {
    const { fn } = stubFetch(json({}, 400), json({}, 200))
    expect((await providerFetch('https://api.openai.com/v1/models', {}, { ...policy, maxRetries: 2 })).status).toBe(400)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('times out, and stops when the caller cancels', async () => {
    const hang = () => new Promise<Response>((_, reject) => {
      // Mirrors fetch: rejects when its signal aborts.
      const sig = (vi.mocked(fetch).mock.calls.at(-1)?.[1] as RequestInit).signal!
      sig.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    })
    stubFetch(hang)
    expect((await caught(providerFetch('https://api.openai.com/v1/models', {}, { ...policy, timeoutMs: 20 }))).code).toBe('byok_timeout')

    stubFetch(hang)
    const ac = new AbortController()
    setTimeout(() => ac.abort(), 10)
    expect((await caught(providerFetch('https://api.openai.com/v1/models', {}, { ...policy, timeoutMs: 5000, maxRetries: 2, signal: ac.signal }))).code).toBe('byok_timeout')
  })

  it('talks only to the fixed provider origins', async () => {
    const { fn } = stubFetch()
    for (const url of ['http://api.openai.com/v1/models', 'https://169.254.169.254/latest', 'https://localhost/x', 'https://evil.example/v1', 'http://localhost:11434/api/tags']) {
      expect((await caught(providerFetch(url, {}, policy))).code).toBe('byok_unsupported')
    }
    expect(fn).not.toHaveBeenCalled()
  })
})

describe('artifact validation', () => {
  it('accepts real PNG/JPEG headers and rejects everything else', () => {
    expect(inspectImage(pngBytes(1024, 1024))).toMatchObject({ mime: 'image/png', width: 1024, height: 1024 })
    expect(inspectImage(jpegBytes(64, 48))).toMatchObject({ mime: 'image/jpeg', width: 64, height: 48 })
    expect(inspectImage(new TextEncoder().encode('{"error":"nope"}'.repeat(4)))).toBeNull()
    expect(inspectImage(pngBytes(0, 10))).toBeNull()
    expect(inspectImage(new Uint8Array(8))).toBeNull()
  })

  it('accepts an MP4 with a video track; rejects HTML, JSON, audio-only and truncated files', () => {
    expect(inspectMp4(mp4Bytes({ durationS: 8, width: 1280, height: 720 }))).toEqual({ brand: 'isom', durationS: 8, width: 1280, height: 720 })
    expect(inspectMp4(new TextEncoder().encode('<!doctype html><html><body>error</body></html>'.repeat(3)))).toBeNull()
    expect(inspectMp4(new TextEncoder().encode(JSON.stringify({ error: { message: 'x'.repeat(80) } })))).toBeNull()
    expect(inspectMp4(mp4Bytes({ handler: 'soun' }))).toBeNull()
    expect(inspectMp4(mp4Bytes().subarray(0, 60))).toBeNull()
    expect(inspectMp4(mp4Bytes({ durationS: 0 }))).toBeNull()
  })
})
