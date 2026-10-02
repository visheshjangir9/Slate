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
const { GET: formTokenRoute } = await import('@/app/api/auth/form-token/route')
const { resolveOwnerId } = await import('@/lib/api/session')
const { issueFormToken } = await import('@/lib/security/bot')
const { resetRateLimits } = await import('@/lib/security/rateLimit')

/** A token issued five seconds ago: old enough to pass the fill-time check. */
const aged = () => issueFormToken(Date.now() - 5_000)

const post = (p: string, body: unknown, ip = '203.0.113.7') =>
  new NextRequest(`http://localhost${p}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body),
  })
const me = async () => (await (await sessionRoute()).json()).user

beforeEach(() => { jar.clear(); signedOut.length = 0; refreshes = 0; resetRateLimits() })

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
    const res = await signup(post('/api/auth/signup', { email: 'new@slate.test', password: 'a long enough password', formToken: aged(), website: '' }))
    expect(res.status).toBe(201)
    expect(jar.get('slate_at')).toBeDefined()
    jar.clear()
    const dup = await signup(post('/api/auth/signup', { email: 'new@slate.test', password: 'a long enough password', formToken: aged() }))
    expect(dup.status).toBe(409)
    expect(jar.size).toBe(0)
  })
})

describe('bot protection', () => {
  const attempt = (extra: Record<string, unknown>, ip?: string) =>
    signup(post('/api/auth/signup', { email: `bot${Math.random()}@slate.test`, password: 'a long enough password', ...extra }, ip))
  const code = async (res: Response) => (await res.json()).error?.code

  it('sign-up without a form token is refused before any account is created', async () => {
    const before = users.size
    const res = await attempt({})
    expect(res.status).toBe(400)
    expect(await code(res)).toBe('bot_check_failed')
    expect(users.size).toBe(before)
  })

  it('a forged, instant or expired token is refused', async () => {
    expect(await code(await attempt({ formToken: `${Date.now() - 5_000}.forged-signature` }))).toBe('bot_check_failed')
    expect(await code(await attempt({ formToken: issueFormToken() }))).toBe('bot_check_failed')
    const old = await attempt({ formToken: issueFormToken(Date.now() - 3 * 60 * 60_000) })
    expect((await old.json()).error.message).toMatch(/reload/i)
  })

  it('a filled honeypot is refused on sign-up and sign-in', async () => {
    expect(await code(await attempt({ formToken: aged(), website: 'https://spam.example' }))).toBe('bot_check_failed')
    const res = await login(post('/api/auth/login', { email: 'qa@slate.test', password: 'correct horse battery', website: 'x' }))
    expect(res.status).toBe(400)
    expect(jar.size).toBe(0)
  })

  it('the form-token route issues a token that sign-up accepts once it has aged', async () => {
    const res = await formTokenRoute(new NextRequest('http://localhost/api/auth/form-token'))
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    const { token } = await res.json()
    expect(token).toMatch(/^\d{13}\.[\w-]+$/)
  })

  it('rate-limits repeated sign-in attempts per IP with 429 and Retry-After', async () => {
    const tries = () => login(post('/api/auth/login', { email: 'qa@slate.test', password: 'wrong password here' }, '198.51.100.1'))
    for (let i = 0; i < 10; i++) expect((await tries()).status).toBe(401)
    const blocked = await tries()
    expect(blocked.status).toBe(429)
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0)
    // Another client is unaffected.
    const other = await login(post('/api/auth/login', { email: 'qa@slate.test', password: 'correct horse battery' }, '198.51.100.2'))
    expect(other.status).toBe(200)
  })

  it('rate-limits sign-ups per IP', async () => {
    for (let i = 0; i < 5; i++) await attempt({ formToken: aged() }, '198.51.100.9')
    expect((await attempt({ formToken: aged() }, '198.51.100.9')).status).toBe(429)
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
