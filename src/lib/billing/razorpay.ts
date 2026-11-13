import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { PRO_AMOUNT_PAISE, PRO_PASS } from './plans'

/**
 * Razorpay, for the Pro pass. Orders API over fetch; no SDK.
 *
 * Needs two environment variables, read here and nowhere else:
 *   RAZORPAY_KEY_ID      the public key id; it is also sent to the browser for Checkout
 *   RAZORPAY_KEY_SECRET  the secret; it signs requests and verifies payments, and never leaves the server
 * Until both are set, checkout is simply unavailable and the app says so.
 */
const API = 'https://api.razorpay.com/v1'

export const razorpayConfigured = (): boolean =>
  Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)

function keys() {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  // Names only. The values are never interpolated into anything.
  if (!keyId || !keySecret) throw new Error('Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET')
  return { keyId, keySecret }
}

export interface RazorpayOrder {
  id: string
  amount: number
  currency: string
  status: string
  notes: Record<string, string>
}

async function call(path: string, init?: { method: string; body: unknown }): Promise<RazorpayOrder> {
  const { keyId, keySecret } = keys()
  const res = await fetch(`${API}${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
      ...(init ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  })
  // The response body can describe the request; only the status is safe to surface.
  if (!res.ok) throw new Error(`razorpay ${init?.method ?? 'GET'} ${path.split('/')[1]} failed: ${res.status}`)
  const order = (await res.json()) as Partial<RazorpayOrder>
  return {
    id: String(order.id), amount: Number(order.amount), currency: String(order.currency),
    status: String(order.status), notes: (order.notes ?? {}) as Record<string, string>,
  }
}

/** One order for one Pro pass, tagged with the account it is for. */
export function createProOrder(userId: string): Promise<RazorpayOrder> {
  return call('/orders', {
    method: 'POST',
    body: {
      amount: PRO_AMOUNT_PAISE,
      currency: PRO_PASS.currency,
      receipt: `pro_${userId.slice(0, 8)}_${Date.now()}`,
      notes: { user_id: userId, plan: 'pro' },
    },
  })
}

export const fetchOrder = (orderId: string): Promise<RazorpayOrder> => call(`/orders/${encodeURIComponent(orderId)}`)

export const publicKeyId = (): string => keys().keyId

/**
 * Razorpay signs a successful payment as HMAC-SHA256("<order_id>|<payment_id>")
 * with the key secret. Compared in constant time.
 */
export function signatureIsValid(orderId: string, paymentId: string, signature: string, secret = keys().keySecret): boolean {
  const expected = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex')
  const a = Buffer.from(expected), b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}
