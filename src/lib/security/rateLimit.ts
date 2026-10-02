import 'server-only'
import type { NextRequest } from 'next/server'

/**
 * Fixed-window rate limiting, in memory.
 *
 * Best effort by design: each server instance keeps its own counts, so a
 * spread-out attack across many instances gets more attempts than `limit`.
 * It still stops the common case (one client hammering sign-up or guessing
 * passwords) with no external service or API key, and Supabase Auth applies
 * its own limits behind it.
 */
interface Window { count: number; resetAt: number }

const windows = new Map<string, Window>()
const MAX_KEYS = 10_000

export interface Limit { limit: number; windowMs: number }

/** The auth endpoints' budgets, per client IP. */
export const LIMITS = {
  login: { limit: 10, windowMs: 60_000 },
  signup: { limit: 5, windowMs: 10 * 60_000 },
  formToken: { limit: 30, windowMs: 60_000 },
} satisfies Record<string, Limit>

export function rateLimit(key: string, { limit, windowMs }: Limit, now = Date.now()): { ok: boolean; retryAfterS: number } {
  let w = windows.get(key)
  if (!w || w.resetAt <= now) {
    if (windows.size >= MAX_KEYS) sweep(now)
    w = { count: 0, resetAt: now + windowMs }
    windows.set(key, w)
  }
  w.count++
  return { ok: w.count <= limit, retryAfterS: Math.max(1, Math.ceil((w.resetAt - now) / 1000)) }
}

function sweep(now: number) {
  for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k)
  // Still full of live windows: drop the oldest rather than grow without bound.
  if (windows.size >= MAX_KEYS) windows.delete(windows.keys().next().value!)
}

/** For tests. */
export const resetRateLimits = () => windows.clear()

/**
 * The client's IP. On Vercel, x-forwarded-for is set by the platform and its
 * first entry is the client; x-real-ip is the fallback.
 */
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return fwd || req.headers.get('x-real-ip')?.trim() || 'unknown'
}
