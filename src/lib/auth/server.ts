import 'server-only'
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { supabaseEnv } from '@/lib/env'

/**
 * Real Supabase Auth sessions, held in httpOnly cookies.
 *
 * The browser never sees a token: sign-in happens in a route handler, the
 * access and refresh tokens go into httpOnly cookies, and every request is
 * verified here. Access tokens are ES256 JWTs checked against the project's
 * published keys (getClaims), so verification is local and fast; when one
 * expires the refresh token is exchanged for a new pair.
 */
export const ACCESS_COOKIE = 'slate_at'
export const REFRESH_COOKIE = 'slate_rt'

export interface SessionUser {
  id: string
  email: string
}

const cookieBase = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: process.env.NODE_ENV === 'production',
}

function publishableKey(): string {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY
  // Names only. The value is never interpolated into anything.
  if (!key) throw new Error('Missing SUPABASE_PUBLISHABLE_KEY')
  return key
}

/**
 * A fresh client per auth operation. Sign-in and refresh put a session on the
 * client instance; a shared instance would let one request see another's.
 */
export function authClient(): SupabaseClient {
  return createClient(supabaseEnv().url, publishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

/** Admin client for user creation. Secret key, server only. */
export function adminClient(): SupabaseClient {
  const { url, secretKey } = supabaseEnv()
  return createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

/**
 * Verification client. getClaims(jwt) never touches stored session state, so
 * one instance is safe to share, and sharing it keeps the JWKS cache warm.
 */
let verifier: SupabaseClient | null = null
const verifyClient = () => (verifier ??= authClient())

export const authConfigured = (): boolean =>
  Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY && process.env.SUPABASE_SECRET_KEY)

export async function writeSession(session: Session): Promise<void> {
  const jar = await cookies()
  jar.set(ACCESS_COOKIE, session.access_token, { ...cookieBase, maxAge: 60 * 60 * 24 * 7 })
  jar.set(REFRESH_COOKIE, session.refresh_token, { ...cookieBase, maxAge: 60 * 60 * 24 * 30 })
}

export async function clearSession(): Promise<void> {
  const jar = await cookies()
  jar.delete(ACCESS_COOKIE)
  jar.delete(REFRESH_COOKIE)
}

async function verify(token: string): Promise<SessionUser | null> {
  try {
    const { data, error } = await verifyClient().auth.getClaims(token)
    const claims = data?.claims as { sub?: string; email?: string; role?: string } | undefined
    if (error || !claims?.sub || claims.role !== 'authenticated') return null
    return { id: claims.sub, email: claims.email ?? '' }
  } catch {
    return null
  }
}

/**
 * The signed-in user for this request, or null for a guest.
 *
 * `refresh` may only be true inside a Route Handler or Server Function, the
 * only places a cookie can be written.
 */
export async function currentUser({ refresh = true }: { refresh?: boolean } = {}): Promise<SessionUser | null> {
  if (!authConfigured()) return null
  const jar = await cookies()
  const access = jar.get(ACCESS_COOKIE)?.value
  const refreshToken = jar.get(REFRESH_COOKIE)?.value
  if (!access && !refreshToken) return null

  if (access) {
    const user = await verify(access)
    if (user) return user
  }
  if (!refresh || !refreshToken) return null

  try {
    const { data, error } = await authClient().auth.refreshSession({ refresh_token: refreshToken })
    if (error || !data.session || !data.user) {
      await clearSession()
      return null
    }
    await writeSession(data.session)
    return { id: data.user.id, email: data.user.email ?? '' }
  } catch {
    return null
  }
}

/** Owner key stored on each generation row for a signed-in user. */
export const ownerForUser = (userId: string): string => `user:${userId}`
