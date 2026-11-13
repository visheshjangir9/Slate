import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { AuthRequiredError } from '@/lib/api/respond'
import { blobStore } from '@/lib/store'
import { mp4Bytes } from '@/tests/fixtures'
import { isCrossSiteWrite } from '@/lib/security/origin'
import { API_BUDGETS, apiBudgetFor } from '@/lib/security/apiLimits'
import { resetRateLimits } from '@/lib/security/rateLimit'
import { sniffVideo } from '@/lib/security/fileType'

/**
 * The request-level protections, exercised through the real proxy and route
 * handlers. Only the session and the paid image providers are mocked, so no
 * request ever leaves the test process.
 */
let signedIn: string | null = null
vi.mock('@/lib/api/session', () => ({
  resolveOwnerId: async () => {
    if (!signedIn) throw new AuthRequiredError()
    return `user:${signedIn}`
  },
}))
type StillArgs = { prompt: string; seed: number }
const fetchStill = vi.fn<(r: StillArgs) => Promise<{ result: { bytes: Uint8Array; contentType: string; provider: string } }>>(async () => ({
  result: { bytes: new Uint8Array([1, 2, 3, 4]), contentType: 'image/jpeg', provider: 'mock' },
}))
vi.mock('@/lib/images', () => ({ fetchStill: (r: StillArgs) => fetchStill(r) }))

const { proxy } = await import('@/proxy')
const gens = await import('@/app/api/generations/route')
const one = await import('@/app/api/generations/[id]/route')
const { POST: artifact } = await import('@/app/api/generations/[id]/artifact/route')
const { GET: still } = await import('@/app/api/still/route')
const nextConfig = (await import('../../../next.config')).default

const HOST = 'slate.example'
const req = (path: string, init: { method?: string; headers?: Record<string, string>; body?: BodyInit } = {}) =>
  new NextRequest(`https://${HOST}${path}`, { method: init.method ?? 'GET', headers: { host: HOST, ...init.headers }, body: init.body })
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const motion = { prompt: 'a lighthouse at dusk', model: 'slate-cinematic-1', motion: 'dolly_in', durationS: 6, aspectRatio: '16:9', resolution: '720p', bitrate: 'standard', workflow: 'motion' }

async function startedJob(user: string) {
  signedIn = user
  const created = await gens.POST(req('/api/generations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(motion) }))
  const id = (await created.json()).generation.id as string
  await one.PATCH(req(`/api/generations/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'start' }) }), ctx(id))
  return id
}
let n = 0
const user = () => `sec-${++n}`

beforeEach(() => {
  signedIn = null
  resetRateLimits()
  fetchStill.mockClear()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('CSRF: state-changing API calls must come from Slate', () => {
  it('decides from Origin and Sec-Fetch-Site', () => {
    const w = (o: Partial<Parameters<typeof isCrossSiteWrite>[0]>) =>
      isCrossSiteWrite({ method: 'POST', origin: null, secFetchSite: null, host: HOST, ...o })
    expect(w({ origin: `https://${HOST}`, secFetchSite: 'same-origin' })).toBe(false)
    expect(w({ origin: 'https://evil.example' })).toBe(true)
    expect(w({ secFetchSite: 'cross-site' })).toBe(true)
    expect(w({ secFetchSite: 'same-site', origin: `https://shop.${HOST}` })).toBe(true)
    expect(w({ origin: 'null' })).toBe(true)
    // No browser headers at all: a script or server, which carries no victim cookies.
    expect(w({})).toBe(false)
    // Reads are never blocked.
    expect(w({ method: 'GET', origin: 'https://evil.example' })).toBe(false)
  })

  it('the proxy refuses a cross-site POST with 403 and logs it', async () => {
    const res = proxy(req('/api/generations', { method: 'POST', headers: { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' } }))
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('cross_origin')
    expect(console.warn).toHaveBeenCalledWith('[slate:security]', expect.stringContaining('cross_origin_blocked'))
  })

  it('the proxy lets the site\'s own POST and any page view through', () => {
    const own = proxy(req('/api/generations', { method: 'POST', headers: { origin: `https://${HOST}`, 'sec-fetch-site': 'same-origin' } }))
    expect(own.status).toBe(200)
    expect(own.headers.get('x-middleware-next')).toBe('1')
    expect(proxy(req('/pricing', { headers: { 'sec-fetch-site': 'cross-site' } })).status).toBe(200)
  })
})

describe('rate limits on every API route', () => {
  it('maps each route to a budget, tightest where money or storage is spent', () => {
    expect(apiBudgetFor('POST', '/api/generations')).toBe('generate')
    expect(apiBudgetFor('POST', '/api/generations/abc/retry')).toBe('generate')
    expect(apiBudgetFor('POST', '/api/generations/abc/artifact')).toBe('upload')
    expect(apiBudgetFor('POST', '/api/uploads/reference')).toBe('upload')
    expect(apiBudgetFor('GET', '/api/still')).toBe('still')
    expect(apiBudgetFor('POST', '/api/billing/verify')).toBe('billing')
    expect(apiBudgetFor('POST', '/api/byok/test')).toBe('byok')
    expect(apiBudgetFor('PATCH', '/api/generations/abc')).toBe('write')
    expect(apiBudgetFor('GET', '/api/generations')).toBe('read')
    expect(apiBudgetFor('GET', '/studio')).toBeNull()
  })

  it('the 21st generation request in a minute from one IP gets 429 with Retry-After', () => {
    const hit = (ip: string) => proxy(req('/api/generations', { method: 'POST', headers: { 'x-forwarded-for': ip } }))
    for (let i = 0; i < API_BUDGETS.generate.limit; i++) expect(hit('203.0.113.7').status).toBe(200)
    const blocked = hit('203.0.113.7')
    expect(blocked.status).toBe(429)
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0)
    expect(console.warn).toHaveBeenCalledWith('[slate:security]', expect.stringContaining('rate_limited'))
    // Another visitor is unaffected.
    expect(hit('198.51.100.2').status).toBe(200)
  })

  it('payments are capped at 10 attempts a minute', () => {
    const hit = () => proxy(req('/api/billing/verify', { method: 'POST', headers: { 'x-forwarded-for': '203.0.113.9' } }))
    for (let i = 0; i < 10; i++) hit()
    expect(hit().status).toBe(429)
  })
})

describe('content security policy', () => {
  it('every response carries a CSP that blocks foreign scripts, plugins and framing', async () => {
    const rules = await nextConfig.headers!()
    const all = rules.find((r) => r.source === '/:path*')!.headers
    const csp = all.find((h) => h.key === 'Content-Security-Policy')!.value
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toMatch(/script-src 'self' 'unsafe-inline' https:\/\/checkout\.razorpay\.com/)
    expect(csp).not.toMatch(/script-src[^;]*\s\*[\s;]/)
    expect(all.map((h) => h.key)).toEqual(expect.arrayContaining(['X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy']))
  })
})

describe('upload types and sizes come from the bytes', () => {
  it('recognises MP4 and WebM and nothing else', () => {
    expect(sniffVideo(mp4Bytes())).toBe('video/mp4')
    expect(sniffVideo(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe('video/webm')
    expect(sniffVideo(new TextEncoder().encode('<html><script>alert(1)</script></html>'))).toBeNull()
  })

  it('an HTML page labelled video/mp4 is refused; a real MP4 is stored as one', async () => {
    const id = await startedJob(user())
    const send = (file: File) => {
      const f = new FormData()
      f.append('video', file)
      return artifact(req(`/api/generations/${id}/artifact`, { method: 'POST', body: f }), ctx(id))
    }
    const html = new File(['<html><script>alert(document.cookie)</script></html>'.padEnd(64, ' ')], 'x.mp4', { type: 'video/mp4' })
    const bad = await send(html)
    expect(bad.status).toBe(400)
    expect(console.warn).toHaveBeenCalledWith('[slate:security]', expect.stringContaining('upload_rejected'))

    const good = await send(new File([mp4Bytes() as BlobPart], 'x.mp4', { type: 'video/mp4' }))
    expect(good.status).toBe(200)
    expect((await blobStore().get(`${id}.mp4`))?.contentType).toBe('video/mp4')
  })
})

describe('the still endpoint cannot be used to generate for free', () => {
  it('refuses a signed-out caller', async () => {
    const res = await still(req('/api/still?prompt=a%20free%20image%20please&width=640&height=360'))
    expect(res.status).toBe(401)
    expect(fetchStill).not.toHaveBeenCalled()
  })

  it('refuses a signed-in caller without a running job of their own', async () => {
    const owner = user()
    const id = await startedJob(owner)
    signedIn = user()
    expect((await still(req('/api/still?width=640&height=360'))).status).toBe(404)
    expect((await still(req(`/api/still?gen=${id}&width=640&height=360`))).status).toBe(404)
    expect(fetchStill).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalledWith('[slate:security]', expect.stringContaining('still_denied'))
  })

  it('a job that has not started (or has finished) gets no frame', async () => {
    signedIn = user()
    const created = await gens.POST(req('/api/generations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(motion) }))
    const id = (await created.json()).generation.id
    expect((await still(req(`/api/still?gen=${id}&width=640&height=360`))).status).toBe(409)
    expect(fetchStill).not.toHaveBeenCalled()
  })

  it("draws the job's own prompt and seed, whatever the URL says", async () => {
    const id = await startedJob(user())
    const res = await still(req(`/api/still?gen=${id}&prompt=something%20else%20entirely&seed=7&width=640&height=360`))
    expect(res.status).toBe(200)
    expect(fetchStill).toHaveBeenCalledTimes(1)
    expect(fetchStill.mock.calls[0][0].prompt).toBe(motion.prompt)
    expect(fetchStill.mock.calls[0][0].seed).not.toBe(7)
  })
})
