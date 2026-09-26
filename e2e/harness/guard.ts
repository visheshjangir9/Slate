import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { REFRESH_COOKIE, currentUser, type SessionUser } from './server'

// E2E HARNESS: copied over lib/auth/guard.ts only in the credential-free E2E build. With SLATE_MOCK=1
// account pages render for a fixed QA user and never contact Supabase.
const MOCK_USER: SessionUser = { id: 'mock-user', email: 'qa@slate.test' } as SessionUser

export async function requireUser(next: string): Promise<SessionUser> {
  if (process.env.SLATE_MOCK === '1') return MOCK_USER
  const user = await currentUser({ refresh: false })
  if (user) return user
  const target = encodeURIComponent(next)
  if ((await cookies()).get(REFRESH_COOKIE)) redirect(`/api/auth/refresh?next=${target}`)
  redirect(`/sign-in?next=${target}`)
}
