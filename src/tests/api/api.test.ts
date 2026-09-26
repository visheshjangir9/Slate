import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { AuthRequiredError } from '@/lib/api/respond'
import { generationStore } from '@/lib/store'
import { mp4Bytes, pngBytes } from '@/tests/fixtures'

/**
 * Slate's own generation API end to end: auth, ownership, validation, the
 * lifecycle state machine through real route handlers, artifact upload,
 * retry, delete, stale sweep and reference uploads. Only the session is
 * mocked; storage is the in-memory adapter.
 */
let signedIn: string | null = null
vi.mock('@/lib/api/session', () => ({
  resolveOwnerId: async () => {
    if (!signedIn) throw new AuthRequiredError()
    return `user:${signedIn}`
  },
}))

const gens = await import('@/app/api/generations/route')
const one = await import('@/app/api/generations/[id]/route')
const { POST: artifact } = await import('@/app/api/generations/[id]/artifact/route')
const { POST: retry } = await import('@/app/api/generations/[id]/retry/route')
const { POST: upload } = await import('@/app/api/uploads/reference/route')
const { GET: models } = await import('@/app/api/models/route')

const url = (p: string) => `http://localhost${p}`
const json = (p: string, method: string, body?: unknown) =>
  new NextRequest(url(p), { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
const form = (p: string, fields: Record<string, File>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.append(k, v)
  return new NextRequest(url(p), { method: 'POST', body: f })
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const motion = { prompt: 'a lighthouse at dusk', model: 'slate-cinematic-1', motion: 'dolly_in', durationS: 6, aspectRatio: '16:9', resolution: '720p', bitrate: 'standard', workflow: 'motion' }

async function create(user: string, body: Record<string, unknown> = motion) {
  signedIn = user
  const res = await gens.POST(json('/api/generations', 'POST', body))
  return { status: res.status, body: await res.json() }
}
const patch = (id: string, body: unknown) => one.PATCH(json(`/api/generations/${id}`, 'PATCH', body), ctx(id))

beforeEach(() => { signedIn = null })

describe('auth and ownership', () => {
  it('every generation route refuses a signed-out request', async () => {
    const id = (await create('a')).body.generation.id
    signedIn = null
    expect((await gens.GET(json('/api/generations', 'GET'))).status).toBe(401)
    expect((await gens.POST(json('/api/generations', 'POST', motion))).status).toBe(401)
    expect((await one.GET(json(`/api/generations/${id}`, 'GET'), ctx(id))).status).toBe(401)
    expect((await patch(id, { event: 'start' })).status).toBe(401)
    expect((await one.DELETE(json(`/api/generations/${id}`, 'DELETE'), ctx(id))).status).toBe(401)
  })

  it("another user can neither see, change, retry nor delete someone else's generation", async () => {
    const id = (await create('a')).body.generation.id
    signedIn = 'b'
    expect((await one.GET(json(`/api/generations/${id}`, 'GET'), ctx(id))).status).toBe(404)
    expect((await patch(id, { event: 'start' })).status).toBe(404)
    expect((await retry(json(`/api/generations/${id}/retry`, 'POST'), ctx(id))).status).toBe(404)
    expect((await one.DELETE(json(`/api/generations/${id}`, 'DELETE'), ctx(id))).status).toBe(404)
    const list = await (await gens.GET(json('/api/generations', 'GET'))).json()
    expect(list.generations.some((g: { id: string }) => g.id === id)).toBe(false)
    expect((await generationStore().get(id))!.status).toBe('queued')
  })
})

describe('validation', () => {
  it('rejects bad input with field errors, and never swaps an unconfigured model', async () => {
    expect((await create('a', { ...motion, prompt: 'x' })).status).toBe(400)
    expect((await create('a', { ...motion, model: 'made-up' })).status).toBe(400)
    expect((await create('a', { ...motion, durationS: 999 })).status).toBe(400)
    expect((await create('a', { ...motion, aspectRatio: '7:3' })).status).toBe(400)
    // No OPENAI_API_KEY in tests: GPT Image is refused by name, never replaced by another model.
    const img = await create('a', { ...motion, model: 'gpt-image-1', workflow: 'image' })
    expect(img.status).toBe(400)
    expect(img.body.error.fields.model).toMatch(/not configured/)
  })

  it('the catalogue reports availability honestly', async () => {
    const body = await (await models()).json()
    const byId = Object.fromEntries(body.models.map((m: { id: string; available: boolean }) => [m.id, m.available]))
    expect(byId['slate-cinematic-1']).toBe(true)
    expect(byId['gpt-image-1']).toBe(false)
  })
})

describe('generation lifecycle (Camera Motion, rendered in the browser)', () => {
  it('queued → generating → progress → artifact → completed, with the file stored', async () => {
    const c = await create('a')
    expect(c.status).toBe(201)
    expect(c.body.execution).toBe('client')
    const id = c.body.generation.id
    expect((await (await patch(id, { event: 'start' })).json()).generation.status).toBe('generating')
    const p = await (await patch(id, { event: 'progress', stage: 'encode', progress: 60 })).json()
    expect(p.generation).toMatchObject({ stage: 'encode', progress: 60 })
    const video = new File([mp4Bytes().slice().buffer], 'slate.mp4', { type: 'video/mp4' })
    const poster = new File([pngBytes(16, 9).slice().buffer], 'poster.png', { type: 'image/png' })
    const done = await (await artifact(form(`/api/generations/${id}/artifact`, { video, poster }), ctx(id))).json()
    expect(done.generation).toMatchObject({ status: 'completed', progress: 100 })
    expect(done.generation.outputUrl).toMatch(new RegExp(`${id}\\.mp4`))
    expect(done.generation.fileBytes).toBe(video.size)
  })

  it('refuses illegal transitions', async () => {
    const id = (await create('a')).body.generation.id
    expect((await patch(id, { event: 'progress', stage: 'encode', progress: 10 })).status).toBe(409)
    await patch(id, { event: 'start' })
    expect((await patch(id, { event: 'start' })).status).toBe(409)
    await patch(id, { event: 'fail', code: 'cancelled', message: 'Cancelled.' })
    expect((await patch(id, { event: 'progress', stage: 'encode', progress: 50 })).status).toBe(409)
    expect((await patch(id, { event: 'bogus' })).status).toBe(400)
  })

  it('rejects an artifact that is not a video, or for a job that is not running', async () => {
    const id = (await create('a')).body.generation.id
    const bad = new File(['<html></html>'], 'x.mp4', { type: 'text/html' })
    expect((await artifact(form(`/api/generations/${id}/artifact`, { video: bad }), ctx(id))).status).toBe(400)
    const empty = new File([], 'x.mp4', { type: 'video/mp4' })
    await patch(id, { event: 'start' })
    expect((await artifact(form(`/api/generations/${id}/artifact`, { video: empty }), ctx(id))).status).toBe(400)
  })

  it('retry creates a new job linked to the original; delete removes it', async () => {
    const id = (await create('a')).body.generation.id
    await patch(id, { event: 'start' })
    await patch(id, { event: 'fail', code: 'encode_failed', message: 'x' })
    const r = await (await retry(json(`/api/generations/${id}/retry`, 'POST'), ctx(id))).json()
    expect(r.generation).toMatchObject({ retryOf: id, status: 'queued', prompt: motion.prompt })
    expect((await one.DELETE(json(`/api/generations/${id}`, 'DELETE'), ctx(id))).status).toBe(200)
    expect((await one.GET(json(`/api/generations/${id}`, 'GET'), ctx(id))).status).toBe(404)
  })

  it('a job abandoned mid-render is swept to failed instead of spinning forever', async () => {
    const id = (await create('a')).body.generation.id
    await patch(id, { event: 'start' })
    await generationStore().patch(id, { heartbeatAt: new Date(Date.now() - 10 * 60_000).toISOString() })
    const g = await (await one.GET(json(`/api/generations/${id}`, 'GET'), ctx(id))).json()
    expect(g.generation.status).toBe('failed')
  })

  it('lists newest first and pages with a cursor', async () => {
    signedIn = 'pager'
    for (let i = 0; i < 3; i++) await create('pager', { ...motion, prompt: `clip number ${i}` })
    const p1 = await (await gens.GET(json('/api/generations?limit=2', 'GET'))).json()
    expect(p1.generations).toHaveLength(2)
    expect(p1.nextCursor).toBeTruthy()
    const p2 = await (await gens.GET(json(`/api/generations?limit=2&cursor=${encodeURIComponent(p1.nextCursor)}`, 'GET'))).json()
    expect(p2.generations.length).toBeGreaterThanOrEqual(1)
    expect(p2.generations[0].id).not.toBe(p1.generations[0].id)
  })
})

describe('reference uploads', () => {
  it('accepts a real image and refuses anything else, including a mislabelled file', async () => {
    signedIn = 'a'
    const ok = await upload(form('/api/uploads/reference', { image: new File([pngBytes(64, 64).slice().buffer], 'a.png', { type: 'image/png' }) }))
    expect(ok.status).toBe(201)
    expect((await ok.json()).url).toMatch(/\/api\/blob\//)
    const gif = await upload(form('/api/uploads/reference', { image: new File(['GIF89a'], 'a.gif', { type: 'image/gif' }) }))
    expect(gif.status).toBe(400)
    const fake = await upload(form('/api/uploads/reference', { image: new File(['<script>alert(1)</script>'.repeat(4)], 'a.png', { type: 'image/png' }) }))
    expect(fake.status).toBe(400)
    signedIn = null
    const anon = await upload(form('/api/uploads/reference', { image: new File([pngBytes(8, 8).slice().buffer], 'a.png', { type: 'image/png' }) }))
    expect(anon.status).toBe(401)
  })
})
