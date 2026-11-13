import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { AuthRequiredError } from '@/lib/api/respond'
import { generationStore } from '@/lib/store'
import { accountStore, parseAccount } from '@/lib/billing/account'
import { PLANS, PRO_AMOUNT_PAISE, PRO_PASS, kindOf } from '@/lib/billing/plans'
import { signatureIsValid } from '@/lib/billing/razorpay'
import { billingStatus } from '@/lib/billing/usage'

/**
 * Plans and payments through the real route handlers. Storage is in memory,
 * only the session is mocked, and Razorpay is a stubbed fetch with a made-up
 * secret: no account, key or network is involved.
 */
let signedIn: string | null = null
vi.mock('@/lib/api/session', () => ({
  resolveOwnerId: async () => {
    if (!signedIn) throw new AuthRequiredError()
    return `user:${signedIn}`
  },
}))
vi.mock('@/lib/auth/server', async (orig) => ({
  ...(await orig<typeof import('@/lib/auth/server')>()),
  currentUser: async () => (signedIn ? { id: signedIn, email: `${signedIn}@slate.test` } : null),
}))

const gens = await import('@/app/api/generations/route')
const one = await import('@/app/api/generations/[id]/route')
const { POST: retry } = await import('@/app/api/generations/[id]/retry/route')
const { GET: status } = await import('@/app/api/billing/status/route')
const { POST: checkout } = await import('@/app/api/billing/checkout/route')
const { POST: verify } = await import('@/app/api/billing/verify/route')

const req = (p: string, method: string, body?: unknown) =>
  new NextRequest(`http://localhost${p}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const base = { prompt: 'a lighthouse at dusk', motion: 'dolly_in', durationS: 6, aspectRatio: '16:9', resolution: '720p', bitrate: 'standard' }
const MOVE = { ...base, model: 'slate-cinematic-1', workflow: 'motion' }

let n = 0
const user = () => `u${++n}-${Date.now()}`
const post = async (body: Record<string, unknown>) => {
  const res = await gens.POST(req('/api/generations', 'POST', body))
  return { status: res.status, body: await res.json() }
}
/** Seed a finished generation straight into the store, as if it had been made. */
const made = (owner: string, provider: string, over: Record<string, unknown> = {}) =>
  generationStore().create({
    deviceId: `user:${owner}`, prompt: 'seeded', model: provider, motion: 'static', durationS: 6, aspectRatio: '16:9',
    resolution: '720p', bitrate: 'standard', referenceUrl: null, seed: 1, status: 'completed', stage: null, progress: 100,
    outputUrl: null, posterUrl: null, fileBytes: null, errorCode: null, errorMessage: null, provider, adjustments: [],
    retryOf: null, workflow: null, ...over,
  })

beforeEach(() => { signedIn = null })

describe('the plan table', () => {
  it('Free is one image, no video and fifteen camera moves; Pro lifts all three', () => {
    expect(PLANS.free.limits).toEqual({ image: 1, video: 0, motion: 15 })
    expect(PLANS.pro.limits.motion).toBeNull()
    expect(PLANS.pro.limits.image!).toBeGreaterThan(1)
    expect(PLANS.pro.limits.video!).toBeGreaterThan(0)
    expect(PRO_AMOUNT_PAISE).toBe(PRO_PASS.amountInr * 100)
  })

  it('counts by the engine that runs the job, never by what the client calls it', () => {
    expect(kindOf({ provider: 'gpt-image' })).toBe('image')
    expect(kindOf({ provider: 'cinematic' })).toBe('motion')
    expect(kindOf({ provider: 'ltxv' })).toBe('video')
  })
})

describe('signed-out visitors', () => {
  it('cannot generate, and have no billing status', async () => {
    expect((await post(MOVE)).status).toBe(401)
    expect((await status()).status).toBe(401)
    expect((await checkout()).status).toBe(401)
  })
})

describe('the Free plan', () => {
  it('allows fifteen camera moves, then asks for Pro on the sixteenth', async () => {
    signedIn = user()
    for (let i = 0; i < 15; i++) expect((await post(MOVE)).status).toBe(201)
    const over = await post(MOVE)
    expect(over.status).toBe(402)
    expect(over.body.error).toMatchObject({ code: 'quota_exceeded', fields: { kind: 'motion', plan: 'free', limit: '15', used: '15' } })
    const s = await (await status()).json()
    expect(s).toMatchObject({ plan: 'free', used: { motion: 15, image: 0, video: 0 }, until: null })
  })

  it('counts one image, and no video at all', async () => {
    const u = user()
    await made(u, 'gpt-image')
    const s = await billingStatus(`user:${u}`)
    expect(s.used.image).toBe(1)
    expect(s.limits.image! - s.used.image).toBe(0)
    expect(s.limits.video).toBe(0)
  })

  it('a client cannot dodge the count by claiming another workflow', async () => {
    signedIn = user()
    for (let i = 0; i < 15; i++) await made(signedIn, 'cinematic')
    expect((await post({ ...MOVE, workflow: 'image' })).status).toBe(402)
  })

  it('a failed generation is never counted, so it can be tried again', async () => {
    signedIn = user()
    for (let i = 0; i < 14; i++) await made(signedIn, 'cinematic')
    const failed = await made(signedIn, 'cinematic', { status: 'failed' })
    expect((await billingStatus(`user:${signedIn}`)).used.motion).toBe(14)
    expect((await retry(req(`/api/generations/${failed.id}/retry`, 'POST'), ctx(failed.id))).status).toBe(201)
    expect((await post(MOVE)).status).toBe(402)
  })

  it('deleting a result does not hand its allowance back', async () => {
    signedIn = user()
    const rows = []
    for (let i = 0; i < 15; i++) rows.push(await made(signedIn, 'cinematic'))
    expect((await one.DELETE(req(`/api/generations/${rows[0].id}`, 'DELETE'), ctx(rows[0].id))).status).toBe(200)
    expect((await billingStatus(`user:${signedIn}`)).used.motion).toBe(15)
    expect((await post(MOVE)).status).toBe(402)
  })

  it('work on the person\'s own provider key is never counted', async () => {
    const u = user()
    await made(u, 'byok:google')
    await made(u, 'byok:openai')
    expect((await billingStatus(`user:${u}`)).used).toEqual({ image: 0, video: 0, motion: 0 })
  })
})

describe('the Pro pass', () => {
  it('lifts the limits while it runs, counts only work made during it, and lapses on its own', async () => {
    signedIn = user()
    for (let i = 0; i < 15; i++) await made(signedIn, 'cinematic')
    expect((await post(MOVE)).status).toBe(402)

    // One millisecond on, so the seeded work is unambiguously from before the pass.
    const now = Date.now() + 1
    await accountStore().setPro(signedIn, { since: new Date(now).toISOString(), until: new Date(now + 86_400_000).toISOString(), paymentId: 'pay_x' })
    const s = await billingStatus(`user:${signedIn}`)
    expect(s.plan).toBe('pro')
    expect(s.used).toEqual({ image: 0, video: 0, motion: 0 })
    expect((await post(MOVE)).status).toBe(201)

    const later = await billingStatus(`user:${signedIn}`, new Date(now + 2 * 86_400_000))
    expect(later.plan).toBe('free')
    expect(later.used.motion).toBe(16)
  })

  it('reads stored account data defensively', () => {
    expect(parseAccount(undefined)).toEqual({ pro: null, deleted: [], payments: [] })
    expect(parseAccount({ pro: { since: 1 }, deleted: [{ k: 'nope', t: 'x' }, { k: 'image', t: '2026-01-01' }, null] }))
      .toEqual({ pro: null, deleted: [{ k: 'image', t: '2026-01-01' }], payments: [] })
  })
})

describe('Razorpay checkout', () => {
  const SECRET = 'unit-test-secret-not-a-real-key'
  const sign = (order: string, payment: string) => createHmac('sha256', SECRET).update(`${order}|${payment}`).digest('hex')
  const orders = new Map<string, { id: string; amount: number; currency: string; status: string; notes: Record<string, string> }>()

  beforeEach(() => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_unit'
    process.env.RAZORPAY_KEY_SECRET = SECRET
    orders.clear()
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      if (!url.startsWith('https://api.razorpay.com/v1/orders')) throw new Error(`unexpected request to ${url}`)
      expect(String((init?.headers as Record<string, string>).Authorization)).toMatch(/^Basic /)
      if (init?.method === 'POST') {
        const b = JSON.parse(String(init.body))
        const order = { id: `order_${orders.size + 1}abc`, amount: b.amount, currency: b.currency, status: 'created', notes: b.notes }
        orders.set(order.id, order)
        return new Response(JSON.stringify(order), { status: 200 })
      }
      const order = orders.get(url.split('/').pop()!)
      return new Response(JSON.stringify(order ?? {}), { status: order ? 200 : 404 })
    }))
  })
  afterEach(() => {
    delete process.env.RAZORPAY_KEY_ID
    delete process.env.RAZORPAY_KEY_SECRET
    vi.unstubAllGlobals()
  })

  it('is plainly unavailable until the keys are set', async () => {
    delete process.env.RAZORPAY_KEY_SECRET
    signedIn = user()
    const res = await checkout()
    expect(res.status).toBe(503)
    expect((await res.json()).error.code).toBe('payments_unconfigured')
    expect((await (await status()).json()).payments).toBe(false)
  })

  it('opens an order at the server\'s price, for this account, and never returns the secret', async () => {
    signedIn = user()
    const res = await checkout()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toMatchObject({ amount: PRO_AMOUNT_PAISE, currency: 'INR', keyId: 'rzp_test_unit', days: PRO_PASS.days })
    expect(orders.get(body.orderId)!.notes.user_id).toBe(signedIn)
    expect(JSON.stringify(body)).not.toContain(SECRET)
  })

  it('a verified payment opens a 30-day pass, once', async () => {
    signedIn = user()
    const { orderId } = await (await checkout()).json()
    const payload = { razorpay_order_id: orderId, razorpay_payment_id: 'pay_abc123', razorpay_signature: sign(orderId, 'pay_abc123') }

    const first = await verify(req('/api/billing/verify', 'POST', payload))
    const s = await first.json()
    expect(first.status).toBe(200)
    expect(s.plan).toBe('pro')
    const days = (new Date(s.until).getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(29.9)
    expect(days).toBeLessThanOrEqual(30)

    // The same payment arriving again must not add another thirty days.
    const again = await (await verify(req('/api/billing/verify', 'POST', payload))).json()
    expect(again.until).toBe(s.until)
  })

  it('two real payments cannot be replayed in turn for extra months', async () => {
    signedIn = user()
    const pay = async (paymentId: string) => {
      const { orderId } = await (await checkout()).json()
      return { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: sign(orderId, paymentId) }
    }
    const a = await pay('pay_first1')
    const b = await pay('pay_second')
    await verify(req('/api/billing/verify', 'POST', a))
    const afterTwo = await (await verify(req('/api/billing/verify', 'POST', b))).json()
    // A, B, A, B: only the first time each payment is seen counts.
    for (const p of [a, b, a, b]) {
      const s = await (await verify(req('/api/billing/verify', 'POST', p))).json()
      expect(s.until).toBe(afterTwo.until)
    }
    const days = (new Date(afterTwo.until).getTime() - Date.now()) / 86_400_000
    expect(days).toBeLessThanOrEqual(60)
  })

  it('refuses a forged signature, and a payment made for someone else', async () => {
    signedIn = user()
    const { orderId } = await (await checkout()).json()
    const forged = await verify(req('/api/billing/verify', 'POST',
      { razorpay_order_id: orderId, razorpay_payment_id: 'pay_abc123', razorpay_signature: 'a'.repeat(64) }))
    expect(forged.status).toBe(400)
    expect((await forged.json()).error.code).toBe('payment_unverified')

    const payer = signedIn
    signedIn = user()
    const stolen = await verify(req('/api/billing/verify', 'POST',
      { razorpay_order_id: orderId, razorpay_payment_id: 'pay_abc123', razorpay_signature: sign(orderId, 'pay_abc123') }))
    expect(stolen.status).toBe(400)
    expect((await stolen.json()).error.code).toBe('payment_mismatch')
    expect((await billingStatus(`user:${signedIn}`)).plan).toBe('free')
    expect((await billingStatus(`user:${payer}`)).plan).toBe('free')
  })

  it('checks the signature in constant time against the documented format', () => {
    expect(signatureIsValid('order_1', 'pay_1', sign('order_1', 'pay_1'), SECRET)).toBe(true)
    expect(signatureIsValid('order_1', 'pay_2', sign('order_1', 'pay_1'), SECRET)).toBe(false)
    expect(signatureIsValid('order_1', 'pay_1', 'short', SECRET)).toBe(false)
  })
})
