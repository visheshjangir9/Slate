'use client'

import { useEffect, useSyncExternalStore } from 'react'
import type { BillingStatus, Kind } from '@/lib/billing/plans'
import { ApiError } from './api'
import { useAuth } from './auth'

/**
 * Client view of the account's plan, plus the upgrade panel's open state.
 * Both are tiny external stores so the Studio, the top bar and the pricing
 * page all see one truth without a provider around the app.
 */
type Snapshot = { status: BillingStatus | null; paywall: Kind | 'plans' | null }

let snap: Snapshot = { status: null, paywall: null }
const listeners = new Set<() => void>()
const set = (next: Partial<Snapshot>) => { snap = { ...snap, ...next }; listeners.forEach((l) => l()) }
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
const SERVER: Snapshot = { status: null, paywall: null }

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(body?.error ?? { code: 'network', message: `Request failed (${res.status})` })
  return body as T
}

let loading: Promise<void> | null = null
/** Fetch the plan again (after a generation, a delete or a payment). Failures leave the last known plan in place. */
export function refreshBilling(): Promise<void> {
  loading ??= fetch('/api/billing/status', { cache: 'no-store' })
    .then(json<BillingStatus>)
    .then((status) => set({ status }))
    .catch(() => { /* signed out, or billing unreachable: nothing to show */ })
    .finally(() => { loading = null })
  return loading
}

export const paywall = {
  /** Open the upgrade panel, saying which allowance ran out (or just showing the plan). */
  open: (kind: Kind | 'plans') => set({ paywall: kind }),
  close: () => set({ paywall: null }),
}

export function useBilling() {
  const auth = useAuth()
  const s = useSyncExternalStore(subscribe, () => snap, () => SERVER)
  const signedIn = auth.status === 'user'
  useEffect(() => { if (signedIn) void refreshBilling() }, [signedIn])
  return { status: signedIn ? s.status : null, paywall: s.paywall, auth }
}

/** If an API error is the plan's allowance running out, open the upgrade panel and say so. */
export function openPaywallFor(err: unknown): boolean {
  if (!(err instanceof ApiError) || err.code !== 'quota_exceeded') return false
  const kind = err.fields?.kind
  paywall.open(kind === 'image' || kind === 'video' || kind === 'motion' ? kind : 'plans')
  return true
}

/* ---------------- Razorpay Checkout ---------------- */

interface RazorpayResult { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
interface RazorpayOptions {
  key: string; order_id: string; amount: number; currency: string; name: string; description: string
  prefill?: { email?: string }; theme?: { color: string }
  handler: (r: RazorpayResult) => void
  modal?: { ondismiss?: () => void }
}
declare global {
  interface Window { Razorpay?: new (o: RazorpayOptions) => { open: () => void } }
}

const CHECKOUT_JS = 'https://checkout.razorpay.com/v1/checkout.js'
let script: Promise<void> | null = null
const loadCheckout = () =>
  (script ??= new Promise<void>((resolve, reject) => {
    if (window.Razorpay) return resolve()
    const el = document.createElement('script')
    el.src = CHECKOUT_JS
    el.onload = () => resolve()
    el.onerror = () => { script = null; reject(new ApiError({ code: 'checkout_unavailable', message: 'The payment window could not load. Check your connection and try again.' })) }
    document.head.appendChild(el)
  }))

/**
 * Buy one Pro pass. Resolves 'paid' once the server has verified the payment
 * and switched the account to Pro, or 'dismissed' if the window was closed.
 * The price is set by the server; nothing here can change it.
 */
export async function buyProPass(): Promise<'paid' | 'dismissed'> {
  const order = await fetch('/api/billing/checkout', { method: 'POST' })
    .then(json<{ orderId: string; amount: number; currency: string; keyId: string; email: string; days: number }>)
  await loadCheckout()
  return new Promise((resolve, reject) => {
    new window.Razorpay!({
      key: order.keyId, order_id: order.orderId, amount: order.amount, currency: order.currency,
      name: 'Slate', description: `Slate Pro · ${order.days} days`,
      prefill: { email: order.email }, theme: { color: '#09090a' },
      handler: (r) => {
        fetch('/api/billing/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r) })
          .then(json<BillingStatus>)
          .then((status) => { set({ status }); resolve('paid') })
          .catch(reject)
      },
      modal: { ondismiss: () => resolve('dismissed') },
    }).open()
  })
}
