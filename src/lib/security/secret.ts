import 'server-only'
import { createHmac } from 'node:crypto'

/**
 * The server's HMAC signing secret, for values the browser holds but must not
 * be able to forge (the device cookie, sign-up form tokens).
 *
 * DEVICE_COOKIE_SECRET when set. In production without it, a key derived from
 * SUPABASE_SECRET_KEY, so the public development string below never signs
 * anything real. With neither in production (and real storage), refuse
 * rather than sign weakly.
 */
const DEV_SECRET = 'slate-dev-secret-not-for-production'

export function signingSecret(): string {
  if (process.env.DEVICE_COOKIE_SECRET) return process.env.DEVICE_COOKIE_SECRET
  if (process.env.NODE_ENV !== 'production') return DEV_SECRET
  const server = process.env.SUPABASE_SECRET_KEY
  if (server) return createHmac('sha256', server).update('slate-device-cookie-v1').digest('base64url')
  // A credential-free production build (e2e, local demos) keeps data in memory
  // only, so there is nothing persistent for a forged value to reach.
  if (process.env.SLATE_STORE === 'memory') return DEV_SECRET
  throw new Error('Missing DEVICE_COOKIE_SECRET')
}

/** HMAC-SHA256 of `value`, scoped by `purpose` so one signature never verifies another kind of value. */
export const sign = (purpose: string, value: string): string =>
  createHmac('sha256', signingSecret()).update(`${purpose}:${value}`).digest('base64url')
