import 'server-only'
import { cookies } from 'next/headers'
import { DEVICE_COOKIE, deviceCookieOptions, mintDeviceToken, verifyDeviceToken } from '@/lib/device'
import { currentUser, ownerForUser } from '@/lib/auth/server'
import { AuthRequiredError } from './respond'

/** Resolve (and mint on first visit) the anonymous device id for this request. */
export async function resolveDeviceId(): Promise<string> {
  const jar = await cookies()
  const existing = verifyDeviceToken(jar.get(DEVICE_COOKIE)?.value)
  if (existing) return existing

  const minted = mintDeviceToken()
  jar.set(DEVICE_COOKIE, minted.token, deviceCookieOptions)
  return minted.id
}

/**
 * Who owns the work in this request: the signed-in Supabase user.
 *
 * Studio, History and Assets are account features, so there is no anonymous
 * fallback: a request without a valid session is refused with a 401 (routes
 * map AuthRequiredError through serverError). Every generation route checks
 * ownership against this value.
 */
export async function resolveOwnerId(): Promise<string> {
  const user = await currentUser()
  if (!user) throw new AuthRequiredError()
  return ownerForUser(user.id)
}
