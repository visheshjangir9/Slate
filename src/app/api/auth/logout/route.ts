import { cookies } from 'next/headers'
import { ACCESS_COOKIE, adminClient, clearSession } from '@/lib/auth/server'
import { ok } from '@/lib/api/respond'

/** Revoke the session server-side, then drop the cookies. */
export async function POST() {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value
  if (token) {
    try { await adminClient().auth.admin.signOut(token, 'local') } catch { /* cookies are cleared regardless */ }
  }
  await clearSession()
  return ok({ signedOut: true })
}
