import 'server-only'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

export const DEVICE_COOKIE = 'slate_device'
const MAX_AGE_S = 60 * 60 * 24 * 365

/**
 * Anonymous device identity.
 *
 * Deliberately not an account. The brief requires the live link to work for
 * someone who is not signed in, so history is scoped to a signed cookie: no
 * signup wall, no auth dependency, and nothing personal stored.
 *
 * The value is HMAC-signed so a client cannot claim another device's history
 * by editing the cookie.
 */
function secret(): string {
  return process.env.DEVICE_COOKIE_SECRET || 'slate-dev-secret-not-for-production'
}

const sign = (id: string): string => createHmac('sha256', secret()).update(id).digest('base64url')

export const mintDeviceToken = (id: string = randomUUID()): { id: string; token: string } => ({
  id,
  token: `${id}.${sign(id)}`,
})

/** Verify a cookie value, returning the device id or null if tampered/absent. */
export function verifyDeviceToken(token: string | undefined | null): string | null {
  if (!token) return null
  const idx = token.lastIndexOf('.')
  if (idx <= 0) return null
  const id = token.slice(0, idx)
  const mac = token.slice(idx + 1)
  const expected = sign(id)
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return null
  return timingSafeEqual(a, b) ? id : null
}

export const deviceCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: MAX_AGE_S,
  secure: process.env.NODE_ENV === 'production',
}
