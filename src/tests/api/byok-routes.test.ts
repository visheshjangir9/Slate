import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { AuthRequiredError } from '@/lib/api/respond'
import { blobStore, generationStore } from '@/lib/store'
import { FAKE_GOOGLE_KEY, FAKE_OPENAI_KEY, b64, bytesResponse, captureConsole, jpegBytes, json, mp4Bytes, pngBytes } from '@/tests/fixtures'

/**
 * The session is the one thing mocked: who is signed in. Everything after it
 * (validation, ownership, the adapter, storage) is the real code, against the
 * in-memory store and a stubbed provider. A forged or expired token reaches
 * the routes as "no user" (Supabase getClaims rejects the signature), which
 * is exactly the signed-out case below.
 */
let signedIn: string | null = null
vi.mock('@/lib/api/session', () => ({
  resolveOwnerId: async () => {
    if (!signedIn) throw new AuthRequiredError()
    return `user:${signedIn}`
  },
}))

const { POST: testKey } = await import('@/app/api/byok/test/route')
const { POST: create } = await import('@/app/api/generations/route')
const { POST: render } = await import('@/app/api/generations/[id]/render/route')
const { POST: poll } = await import('@/app/api/generations/[id]/poll/route')
const { POST: retry } = await import('@/app/api/generations/[id]/retry/route')

const IMAGE = 'byok:google:image:gemini-2.5-flash-image'
const VIDEO = 'byok:google:video:veo-3.1-generate-preview'
const OP = 'models/veo-3.1-generate-preview/operations/op123'
const VIDEO_URI = 'https://generativelanguage.googleapis.com/v1beta/files/v1:download?alt=media'
const credential = { providerId: 'google', apiKey: FAKE_GOOGLE_KEY }
const req = (url: string, body?: unknown) =>
  new NextRequest(`http://localhost${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const base = { prompt: 'a red door in a white wall', motion: 'static', resolution: '1080p', bitrate: 'standard' }

const opDone = () => json({ name: OP, done: true, response: { generateVideoResponse: { generatedSamples: [{ video: { uri: VIDEO_URI } }] } } })

let provider: ReturnType<typeof vi.fn>
let logs: ReturnType<typeof captureConsole>

beforeEach(() => {
  signedIn = null
  provider = vi.fn(async () => json({ candidates: [{ content: { parts: [{ inlineData: { data: b64(pngBytes(1024, 1024)) } }] } }] }))
  vi.stubGlobal('fetch', provider)
  logs = captureConsole()
})
afterEach(() => {
  logs.restore()
  vi.unstubAllGlobals()
  // No response, stored row or log line may ever contain the key.
  expect(logs.text()).not.toContain(FAKE_GOOGLE_KEY)
})

async function newImageJob(user: string) {
  signedIn = user
  const res = await create(req('/api/generations', { ...base, model: IMAGE, durationS: 4, aspectRatio: '1:1', workflow: 'image' }))
  expect(res.status).toBe(201)
  return (await res.json()).generation as { id: string; provider: string; model: string }
}

async function newVideoJob(user: string, extra: Record<string, unknown> = {}) {
  signedIn = user
  const res = await create(req('/api/generations', { ...base, model: VIDEO, durationS: 6, aspectRatio: '16:9', workflow: 'video', ...extra }))
  expect(res.status).toBe(201)
  return (await res.json()).generation as { id: string; provider: string; model: string; durationS: number }
}

const stored = async (id: string) => (await generationStore().get(id))!
const getBlob = (key: string) => (blobStore() as unknown as { get: (k: string) => Promise<{ bytes: Uint8Array; contentType: string } | null> }).get(key)

describe('POST /api/byok/test', () => {
  it('rejects a signed-out request before the key reaches any provider', async () => {
    const res = await testKey(req('/api/byok/test', { credential }))
    expect(res.status).toBe(401)
    expect(provider).not.toHaveBeenCalled()
    expect(await res.text()).not.toContain(FAKE_GOOGLE_KEY)
  })

  it('signed in: one listing call, models with capabilities and runs, never the key', async () => {
    signedIn = 'a'
    provider.mockResolvedValueOnce(json({ models: [
      { name: 'models/gemini-2.5-flash-image', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/veo-3.1-generate-preview', supportedGenerationMethods: ['predictLongRunning'] },
      { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] },
    ] }))
    const res = await testKey(req('/api/byok/test', { credential }))
    const text = await res.text()
    const body = JSON.parse(text)
    expect(body.connected).toBe(true)
    expect(body.models.map((m: { id: string }) => m.id)).toEqual(['gemini-2.5-flash-image', 'veo-3.1-generate-preview', 'gemini-2.5-pro'])
    expect(body.models[1].runs.video.durations).toEqual([4, 6, 8])
    expect(body.models[2].runs).toEqual({})
    expect(text).not.toContain(FAKE_GOOGLE_KEY)
    expect(provider).toHaveBeenCalledTimes(1)
    const [url, init] = provider.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/\/v1beta\/models\?/)
    expect(init.method ?? 'GET').toBe('GET')
  })

  it('reports a rejected key as an authentication failure, with a fixed message', async () => {
    signedIn = 'a'
    provider.mockResolvedValueOnce(json({ error: { status: 'INVALID_ARGUMENT', message: `bad key ${FAKE_GOOGLE_KEY}`, details: [{ reason: 'API_KEY_INVALID' }] } }, 400))
    const res = await testKey(req('/api/byok/test', { credential }))
    const text = await res.text()
    expect(JSON.parse(text)).toEqual({ connected: false, error: { code: 'byok_auth_failed', message: 'The provider rejected this key.' } })
    expect(text).not.toContain(FAKE_GOOGLE_KEY)
  })

  it('refuses unknown and unsupported providers and malformed keys without echoing them', async () => {
    signedIn = 'a'
    for (const bad of [
      { providerId: 'acme', apiKey: FAKE_GOOGLE_KEY }, { providerId: 'ollama', apiKey: FAKE_GOOGLE_KEY },
      { providerId: 'openai-compatible', apiKey: FAKE_GOOGLE_KEY },
      { providerId: 'google', apiKey: `${FAKE_GOOGLE_KEY}\r\nX-Injected: 1` }, { providerId: 'google', apiKey: 'short' },
    ]) {
      const res = await testKey(req('/api/byok/test', { credential: bad }))
      expect(res.status).toBe(400)
      expect(await res.text()).not.toContain(FAKE_GOOGLE_KEY)
    }
    expect(provider).not.toHaveBeenCalled()
  })
})

describe('creating a user-key generation', () => {
  it('stores metadata only: provider tag and model, no credential anywhere', async () => {
    const job = await newImageJob('a')
    expect(job.provider).toBe('byok:google')
    expect(job.model).toBe(IMAGE)
    expect(JSON.stringify(await stored(job.id))).not.toMatch(/AIza|apiKey|credential/)
  })

  it('refuses the wrong workflow, provider mismatches and capability mismatches', async () => {
    signedIn = 'a'
    const img = { ...base, durationS: 4, aspectRatio: '1:1' }
    const vid = { ...base, durationS: 8, aspectRatio: '16:9' }
    expect((await create(req('/api/generations', { ...img, model: IMAGE, workflow: 'video' }))).status).toBe(400)
    expect((await create(req('/api/generations', { ...vid, model: VIDEO, workflow: 'image' }))).status).toBe(400)
    expect((await create(req('/api/generations', { ...vid, model: VIDEO, workflow: 'motion' }))).status).toBe(400)
    for (const model of [
      'byok:openai:video:gpt-image-1', 'byok:google:image:veo-3.1-generate-preview', 'byok:google:image:gemini-2.5-pro',
      'byok:openai:image:gemini-2.5-flash-image', 'byok:google:image:gpt-image-1', 'byok:anthropic:image:claude-opus-4-1', 'byok:acme:image:thing',
    ]) {
      expect((await create(req('/api/generations', { ...img, model, workflow: 'image' }))).status, model).toBe(400)
    }
  })

  it('refuses video settings the model does not document', async () => {
    signedIn = 'a'
    const v = { ...base, model: VIDEO, workflow: 'video' }
    expect((await create(req('/api/generations', { ...v, durationS: 5, aspectRatio: '16:9' }))).status).toBe(400)
    expect((await create(req('/api/generations', { ...v, durationS: 8, aspectRatio: '1:1' }))).status).toBe(400)
    expect((await create(req('/api/generations', { ...base, model: 'byok:openai:video:sora-2', workflow: 'video', durationS: 6, aspectRatio: '16:9' }))).status).toBe(400)
  })

  it('a first frame must be the user’s own upload, and only for models that take one', async () => {
    signedIn = 'a'
    const v = { ...base, model: VIDEO, workflow: 'video', durationS: 8, aspectRatio: '16:9' }
    expect((await create(req('/api/generations', { ...v, referenceUrl: 'https://evil.example/frame.jpg' }))).status).toBe(400)
    expect((await create(req('/api/generations', { ...v, referenceUrl: 'http://169.254.169.254/latest' }))).status).toBe(400)
    expect((await create(req('/api/generations', { ...base, model: 'byok:openai:video:sora-2', workflow: 'video', durationS: 8, aspectRatio: '16:9', referenceUrl: 'http://localhost/api/blob/f.jpg' }))).status).toBe(400)
    expect((await create(req('/api/generations', { ...v, referenceUrl: 'http://localhost/api/blob/f.jpg' }))).status).toBe(201)
    expect((await create(req('/api/generations', { ...v, referenceUrl: 'http://localhost/api/blob/..%2F..%2Fetc' }))).status).toBe(400)
  })

  it('refuses signed-out creation', async () => {
    const res = await create(req('/api/generations', { ...base, model: IMAGE, durationS: 4, aspectRatio: '1:1' }))
    expect(res.status).toBe(401)
  })
})

describe('rendering an image with the user key', () => {
  it('signed out: 401, the key is never used, the job is untouched', async () => {
    const job = await newImageJob('a')
    signedIn = null
    const res = await render(req(`/api/generations/${job.id}/render`, { credential }), ctx(job.id))
    expect(res.status).toBe(401)
    expect(provider).not.toHaveBeenCalled()
    expect((await stored(job.id)).status).toBe('queued')
  })

  it("another user's session: 404, their key is never used on someone else's job", async () => {
    const job = await newImageJob('a')
    signedIn = 'b'
    const res = await render(req(`/api/generations/${job.id}/render`, { credential }), ctx(job.id))
    expect(res.status).toBe(404)
    expect(provider).not.toHaveBeenCalled()
    expect((await stored(job.id)).status).toBe('queued')
  })

  it('without an active key (e.g. after a reload) the job fails honestly; nothing is called, nothing falls back', async () => {
    const job = await newImageJob('a')
    const { generation } = await (await render(req(`/api/generations/${job.id}/render`), ctx(job.id))).json()
    expect(generation.status).toBe('failed')
    expect(generation.errorCode).toBe('byok_key_missing')
    expect(generation.provider).toBe('byok:google')
    expect(provider).not.toHaveBeenCalled()
  })

  it('a key for a different provider is not used', async () => {
    const job = await newImageJob('a')
    const res = await render(req(`/api/generations/${job.id}/render`, { credential: { providerId: 'openai', apiKey: FAKE_OPENAI_KEY } }), ctx(job.id))
    expect((await res.json()).generation.errorCode).toBe('byok_key_missing')
    expect(provider).not.toHaveBeenCalled()
  })

  it('success: one provider call, artifact stored, row completed, key in no response, row or log', async () => {
    const job = await newImageJob('a')
    const res = await render(req(`/api/generations/${job.id}/render`, { credential }), ctx(job.id))
    const text = await res.text()
    const { generation } = JSON.parse(text)
    expect(generation.status).toBe('completed')
    expect(generation.outputUrl).toMatch(/\.png$/)
    expect(provider).toHaveBeenCalledTimes(1)
    expect(text).not.toContain(FAKE_GOOGLE_KEY)
    const row = JSON.stringify(await stored(job.id))
    expect(row).not.toContain(FAKE_GOOGLE_KEY)
    expect(row).not.toMatch(/apiKey|credential/)
    const blob = await getBlob(`${job.id}.png`)
    expect(blob?.contentType).toBe('image/png')
    expect(blob?.bytes.byteLength).toBe(generation.fileBytes)
  })

  it('a second render of the same job is refused: no duplicate provider call', async () => {
    const job = await newImageJob('a')
    await render(req(`/api/generations/${job.id}/render`, { credential }), ctx(job.id))
    const again = await render(req(`/api/generations/${job.id}/render`, { credential }), ctx(job.id))
    expect(again.status).toBe(409)
    expect(provider).toHaveBeenCalledTimes(1)
  })

  it('a billable request is never retried, even on a rate limit', async () => {
    const job = await newImageJob('a')
    provider.mockImplementation(async () => json({ error: { status: 'RESOURCE_EXHAUSTED' } }, 429))
    const { generation } = await (await render(req(`/api/generations/${job.id}/render`, { credential, settings: { timeoutS: 30, maxRetries: 2 } }), ctx(job.id))).json()
    expect(generation.status).toBe('failed')
    expect(generation.errorCode).toBe('byok_rate_limited')
    expect(provider).toHaveBeenCalledTimes(1)
  })

  it('retry keeps the user-key provider and runs on the server, still storing no key', async () => {
    const job = await newImageJob('a')
    const body = await (await retry(req(`/api/generations/${job.id}/retry`), ctx(job.id))).json()
    expect(body.execution).toBe('server')
    expect(body.generation.provider).toBe('byok:google')
    expect(body.generation.model).toBe(IMAGE)
    expect(body.generation.retryOf).toBe(job.id)
  })
})

describe('provider video: submit, poll, collect', () => {
  it('render submits one async job and stores only the provider’s job handle', async () => {
    const job = await newVideoJob('a')
    provider.mockResolvedValueOnce(json({ name: OP }))
    const res = await render(req(`/api/generations/${job.id}/render`, { credential }), ctx(job.id))
    const text = await res.text()
    const body = JSON.parse(text)
    expect(body.pending).toBe(true)
    expect(body.generation.status).toBe('generating')
    expect(body.generation.stage).toBe('render')
    expect(provider).toHaveBeenCalledTimes(1)
    expect((provider.mock.calls[0] as [string])[0]).toMatch(/:predictLongRunning$/)
    const row = await stored(job.id)
    expect(row.providerJob).toBe(OP)
    expect(JSON.stringify(row)).not.toContain(FAKE_GOOGLE_KEY)
    expect(text).not.toContain(FAKE_GOOGLE_KEY)
  })

  it('sends the uploaded first frame from Slate’s own storage', async () => {
    const frame = jpegBytes(64, 36)
    const url = await blobStore().put('ref-frame.jpg', frame, 'image/jpeg')
    const job = await newVideoJob('a', { referenceUrl: `http://localhost${url}`, durationS: 8 })
    provider.mockResolvedValueOnce(json({ name: OP }))
    await render(req(`/api/generations/${job.id}/render`, { credential }), ctx(job.id))
    const sent = JSON.parse(String((provider.mock.calls[0] as [string, RequestInit])[1].body))
    expect(sent.instances[0].image.inlineData).toEqual({ mimeType: 'image/jpeg', data: b64(frame) })
  })

  async function submitted() {
    const job = await newVideoJob('a')
    provider.mockResolvedValueOnce(json({ name: OP }))
    await render(req(`/api/generations/${job.id}/render`, { credential }), ctx(job.id))
    provider.mockClear()
    return job
  }

  it('pending: a heartbeat, and no invented progress', async () => {
    const job = await submitted()
    const before = await stored(job.id)
    provider.mockResolvedValueOnce(json({ name: OP, done: false }))
    const { generation } = await (await poll(req(`/api/generations/${job.id}/poll`, { credential }), ctx(job.id))).json()
    expect(generation.status).toBe('generating')
    expect(generation.progress).toBe(before.progress)
    expect(provider).toHaveBeenCalledTimes(1)
  })

  it('completed: downloads, validates the MP4, stores the exact bytes, then completes with the real duration', async () => {
    const job = await submitted()
    const mp4 = mp4Bytes({ durationS: 6 })
    provider
      .mockResolvedValueOnce(opDone()) // status
      .mockResolvedValueOnce(opDone()) // download: re-read the operation
      .mockResolvedValueOnce(bytesResponse(mp4))
    const res = await poll(req(`/api/generations/${job.id}/poll`, { credential }), ctx(job.id))
    const text = await res.text()
    const { generation, done } = JSON.parse(text)
    expect(done).toBe(true)
    expect(generation.status).toBe('completed')
    expect(generation.outputUrl).toBe(`/api/blob/${job.id}.mp4`)
    expect(generation.durationS).toBe(6)
    expect(generation.providerJob).toBeNull()
    const blob = await getBlob(`${job.id}.mp4`)
    expect(blob?.contentType).toBe('video/mp4')
    expect(Buffer.from(blob!.bytes).equals(Buffer.from(mp4))).toBe(true)
    expect(text).not.toContain(FAKE_GOOGLE_KEY)
    expect(JSON.stringify(await stored(job.id))).not.toContain(FAKE_GOOGLE_KEY)
  })

  it('a download that is not a playable MP4 fails the job; nothing is stored', async () => {
    const job = await submitted()
    provider
      .mockResolvedValueOnce(opDone())
      .mockResolvedValueOnce(opDone())
      .mockResolvedValueOnce(new Response('<!doctype html><title>error</title>'.repeat(4), { headers: { 'Content-Type': 'text/html' } }))
    const { generation } = await (await poll(req(`/api/generations/${job.id}/poll`, { credential }), ctx(job.id))).json()
    expect(generation.status).toBe('failed')
    expect(generation.errorCode).toBe('byok_bad_video')
    expect(await getBlob(`${job.id}.mp4`)).toBeNull()
  })

  it('a failed provider job fails the row with a fixed message', async () => {
    const job = await submitted()
    provider.mockResolvedValueOnce(json({ name: OP, done: true, error: { code: 13, message: `internal ${FAKE_GOOGLE_KEY}` } }))
    const { generation } = await (await poll(req(`/api/generations/${job.id}/poll`, { credential }), ctx(job.id))).json()
    expect(generation.status).toBe('failed')
    expect(generation.errorCode).toBe('byok_job_failed')
    expect(generation.errorMessage).toBe('The provider could not complete this video.')
  })

  it('a finished job is returned without contacting the provider', async () => {
    const job = await submitted()
    provider.mockResolvedValueOnce(opDone()).mockResolvedValueOnce(opDone()).mockResolvedValueOnce(bytesResponse(mp4Bytes()))
    await poll(req(`/api/generations/${job.id}/poll`, { credential }), ctx(job.id))
    provider.mockClear()
    const { done } = await (await poll(req(`/api/generations/${job.id}/poll`, { credential }), ctx(job.id))).json()
    expect(done).toBe(true)
    expect(provider).not.toHaveBeenCalled()
  })

  it('a passing provider outage keeps following the job instead of failing it', async () => {
    const job = await submitted()
    provider.mockResolvedValueOnce(json({}, 503)).mockResolvedValueOnce(json({}, 503))
    const { generation } = await (await poll(req(`/api/generations/${job.id}/poll`, { credential }), ctx(job.id))).json()
    expect(generation.status).toBe('generating')
  })

  it('without the key (signed out, reloaded) the poll is refused and the provider never contacted', async () => {
    const job = await submitted()
    const res = await poll(req(`/api/generations/${job.id}/poll`), ctx(job.id))
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('byok_key_missing')
    expect(provider).not.toHaveBeenCalled()
    expect((await stored(job.id)).status).toBe('generating')
  })

  it('signed out or another user: the poll never reaches the provider', async () => {
    const job = await submitted()
    signedIn = null
    expect((await poll(req(`/api/generations/${job.id}/poll`, { credential }), ctx(job.id))).status).toBe(401)
    signedIn = 'b'
    expect((await poll(req(`/api/generations/${job.id}/poll`, { credential }), ctx(job.id))).status).toBe(404)
    expect(provider).not.toHaveBeenCalled()
  })

  it('an image job, or a Slate job, cannot be polled at a provider', async () => {
    const job = await newImageJob('a')
    expect((await poll(req(`/api/generations/${job.id}/poll`, { credential }), ctx(job.id))).status).toBe(400)
    expect(provider).not.toHaveBeenCalled()
  })
})
