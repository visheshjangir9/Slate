import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Auth routes against a fake cookie jar and a fake Supabase Auth client.
 * No network and no real project: this checks the session contract — httpOnly
 * cookies, verification, refresh rotation, sign-out revocation, and that a
 * forged or expired token never authenticates.
 */
const jar = new Map<string, { value: string; opts?: Record<string, unknown> }>()
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { name: k, value: jar.get(k)!.value } : undefined),
    set: (k: string, value: string, opts?: Record<string, unknown>) => { jar.set(k, { value, opts }) },
    delete: (k: string) => { jar.delete(k) },
  }),
}))

const USER = { id: 'u-1', email: 'qa@slate.test' }
const session = (n: number) => ({ access_token: `access-${n}`, refresh_token: `refresh-${n}` })
const users = new Map<string, string>([['qa@slate.test', 'correct horse battery']])
const signedOut: string[] = []
let refreshes = 0

const auth = {
  signInWithPassword: async ({ email, password }: { email: string; password: string }) =>
    users.get(email) === password
      ? { data: { session: session(1), user: USER }, error: null }
      : { data: { session: null, user: null }, error: { code: 'invalid_credentials' } },
  getClaims: async (token: string) =>
    /^access-\d+$/.test(token) && token !== 'access-expired'
      ? { data: { claims: { sub: USER.id, email: USER.email, role: 'authenticated' } }, error: null }
      : { data: null, error: { message: 'invalid JWT' } },
  refreshSession: async ({ refresh_token }: { refresh_token: string }) => {
    refreshes++
    return refresh_token === 'refresh-1'
      ? { data: { session: session(2), user: USER }, error: null }
      : { data: { session: null, user: null }, error: { code: 'refresh_token_not_found' } }
  },
  admin: {
    createUser: async ({ email, password }: { email: string; password: string }) => {
      if (users.has(email)) return { data: null, error: { code: 'email_exists' } }
      users.set(email, password)
      return { data: { user: { id: 'u-new', email } }, error: null }
    },
    signOut: async (token: string) => { signedOut.push(token); return { error: null } },
  },
}
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth }) }))

process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_PUBLISHABLE_KEY = 'test-publishable'
process.env.SUPABASE_SECRET_KEY = 'test-not-a-real-secret'
process.env.SLATE_STORE = 'memory'

const { POST: login } = await import('@/app/api/auth/login/route')
const { POST: signup } = await import('@/app/api/auth/signup/route')
const { POST: logout } = await import('@/app/api/auth/logout/route')
const { GET: sessionRoute } = await import('@/app/api/auth/session/route')
const { resolveOwnerId } = await import('@/lib/api/session')

const post = (p: string, body: unknown) =>
  new NextRequest(`http://localhost${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const me = async () => (await (await sessionRoute()).json()).user

beforeEach(() => { jar.clear(); signedOut.length = 0; refreshes = 0 })

describe('sign in', () => {
  it('sets httpOnly session cookies and returns only id and email', async () => {
    const res = await login(post('/api/auth/login', { email: 'qa@slate.test', password: 'correct horse battery' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.user).toEqual(USER)
    expect(JSON.stringify(body)).not.toMatch(/access-|refresh-/)
    expect(jar.get('slate_at')).toMatchObject({ value: 'access-1', opts: { httpOnly: true, sameSite: 'lax', path: '/' } })
    expect(jar.get('slate_rt')?.opts).toMatchObject({ httpOnly: true })
    expect(await me()).toEqual(USER)
  })

  it('wrong password: 401 with a fixed message, no cookies', async () => {
    const res = await login(post('/api/auth/login', { email: 'qa@slate.test', password: 'wrong password here' }))
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('invalid_credentials')
    expect(jar.size).toBe(0)
  })

  it('rejects malformed credentials before calling Supabase', async () => {
    expect((await login(post('/api/auth/login', { email: 'not-an-email', password: 'x' }))).status).toBe(400)
  })
})

describe('sign up', () => {
  it('creates the user, signs in, and refuses a duplicate email', async () => {
    const res = await signup(post('/api/auth/signup', { email: 'new@slate.test', password: 'a long enough password' }))
    expect(res.status).toBe(201)
    expect(jar.get('slate_at')).toBeDefined()
    jar.clear()
    const dup = await signup(post('/api/auth/signup', { email: 'new@slate.test', password: 'a long enough password' }))
    expect(dup.status).toBe(409)
    expect(jar.size).toBe(0)
  })
})

describe('session verification', () => {
  it('a guest has no user, and owner-only routes refuse them', async () => {
    expect(await me()).toBeNull()
    await expect(resolveOwnerId()).rejects.toThrow()
  })

  it('a forged token never authenticates', async () => {
    jar.set('slate_at', { value: 'eyJforged.token.here' })
    expect(await me()).toBeNull()
    await expect(resolveOwnerId()).rejects.toThrow()
  })

  it('an expired access token is rotated with the refresh token', async () => {
    jar.set('slate_at', { value: 'access-expired' })
    jar.set('slate_rt', { value: 'refresh-1' })
    expect(await me()).toEqual(USER)
    expect(refreshes).toBe(1)
    expect(jar.get('slate_at')?.value).toBe('access-2')
    expect(await resolveOwnerId()).toBe('user:u-1')
  })

  it('a revoked refresh token signs the user out and clears the cookies', async () => {
    jar.set('slate_at', { value: 'access-expired' })
    jar.set('slate_rt', { value: 'refresh-revoked' })
    expect(await me()).toBeNull()
    expect(jar.has('slate_at')).toBe(false)
    expect(jar.has('slate_rt')).toBe(false)
  })
})

describe('sign out', () => {
  it('revokes the session server-side and clears both cookies', async () => {
    jar.set('slate_at', { value: 'access-1' })
    jar.set('slate_rt', { value: 'refresh-1' })
    expect((await logout()).status).toBe(200)
    expect(signedOut).toEqual(['access-1'])
    expect(jar.size).toBe(0)
    expect(await me()).toBeNull()
  })
})
