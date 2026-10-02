import { afterEach, describe, expect, it, vi } from 'vitest'
import { signingSecret } from '@/lib/security/secret'

const DEV = 'slate-dev-secret-not-for-production'
afterEach(() => vi.unstubAllEnvs())

const env = (vars: Record<string, string | undefined>) => {
  for (const k of ['DEVICE_COOKIE_SECRET', 'SUPABASE_SECRET_KEY', 'SLATE_STORE']) vi.stubEnv(k, undefined)
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v)
}

describe('signing secret', () => {
  it('uses DEVICE_COOKIE_SECRET when set', () => {
    env({ NODE_ENV: 'production', DEVICE_COOKIE_SECRET: 'configured-secret' })
    expect(signingSecret()).toBe('configured-secret')
  })

  it('never signs with the public dev string in a real production deployment', () => {
    env({ NODE_ENV: 'production', SUPABASE_SECRET_KEY: 'server-secret' })
    const derived = signingSecret()
    expect(derived).not.toBe(DEV)
    expect(derived).not.toContain('server-secret')
    env({ NODE_ENV: 'production' })
    expect(() => signingSecret()).toThrow(/DEVICE_COOKIE_SECRET/)
  })

  it('allows the dev string only in development or a memory-only build', () => {
    env({ NODE_ENV: 'development' })
    expect(signingSecret()).toBe(DEV)
    env({ NODE_ENV: 'production', SLATE_STORE: 'memory' })
    expect(signingSecret()).toBe(DEV)
  })
})
