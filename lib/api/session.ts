import 'server-only'
import { cookies } from 'next/headers'
import { DEVICE_COOKIE, deviceCookieOptions, mintDeviceToken, verifyDeviceToken } from '@/lib/device'

/** Resolve (and mint on first visit) the anonymous device id for this request. */
export async function resolveDeviceId(): Promise<string> {
  const jar = await cookies()
  const existing = verifyDeviceToken(jar.get(DEVICE_COOKIE)?.value)
  if (existing) return existing

  const minted = mintDeviceToken()
  jar.set(DEVICE_COOKIE, minted.token, deviceCookieOptions)
  return minted.id
}
