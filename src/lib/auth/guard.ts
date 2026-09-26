import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { REFRESH_COOKIE, currentUser, type SessionUser } from './server'

/**
 * Gate for account pages (Studio, Assets). Runs in a server component, so it
 * can read cookies but not write them:
 *   valid session            -> render
 *   expired but refreshable  -> /api/auth/refresh, which rotates the session
 *   anything else            -> /sign-in, returning here afterwards
 */
export async function requireUser(next: string): Promise<SessionUser> {
  const user = await currentUser({ refresh: false })
  if (user) return user
  const target = encodeURIComponent(next)
  if ((await cookies()).get(REFRESH_COOKIE)) redirect(`/api/auth/refresh?next=${target}`)
  redirect(`/sign-in?next=${target}`)
}
