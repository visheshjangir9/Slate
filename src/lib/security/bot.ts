import 'server-only'
import { timingSafeEqual } from 'node:crypto'
import { sign } from './secret'

/**
 * Bot protection for public forms, with no CAPTCHA service or API key.
 *
 * 1. Honeypot: the form has a field people never see or fill (`website`).
 *    Form-filling bots fill every field; anything in it means "bot".
 * 2. Signed form token: the page asks the server for a timestamp signed with
 *    the server secret. A token cannot be forged, must be at least
 *    MIN_FILL_MS old (no person types an email and password that fast) and
 *    at most MAX_AGE_MS old (it cannot be harvested once and replayed for days).
 *
 * Paired with per-IP rate limits (rateLimit.ts) on the same routes.
 */
export const HONEYPOT_FIELD = 'website'
export const MIN_FILL_MS = 2_000
export const MAX_AGE_MS = 2 * 60 * 60_000
const PURPOSE = 'form-token'

export function issueFormToken(now = Date.now()): string {
  const ts = String(now)
  return `${ts}.${sign(PURPOSE, ts)}`
}

export type FormTokenCheck = 'ok' | 'missing' | 'invalid' | 'too_fast' | 'expired'

export function checkFormToken(token: unknown, now = Date.now()): FormTokenCheck {
  if (typeof token !== 'string' || !token) return 'missing'
  const dot = token.indexOf('.')
  const ts = token.slice(0, dot)
  const mac = token.slice(dot + 1)
  if (dot <= 0 || !/^\d{13}$/.test(ts)) return 'invalid'
  const expected = Buffer.from(sign(PURPOSE, ts))
  const given = Buffer.from(mac)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return 'invalid'
  const age = now - Number(ts)
  if (age < MIN_FILL_MS) return 'too_fast'
  if (age > MAX_AGE_MS) return 'expired'
  return 'ok'
}

/** True when the hidden honeypot field came back with anything in it. */
export const honeypotFilled = (body: unknown): boolean => {
  const v = (body as Record<string, unknown> | null)?.[HONEYPOT_FIELD]
  return typeof v === 'string' ? v.trim().length > 0 : v !== undefined && v !== null
}
