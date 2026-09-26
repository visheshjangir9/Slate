import { describe, expect, it } from 'vitest'
import { authErrorCopy, credentialsSchema } from '@/lib/auth/schema'

describe('credentialsSchema', () => {
  it('normalises the email', () => {
    const out = credentialsSchema.parse({ email: '  Ana@Example.COM ', password: 'longenough' })
    expect(out.email).toBe('ana@example.com')
  })

  it('rejects a malformed email and a short password with field messages', () => {
    const r = credentialsSchema.safeParse({ email: 'nope', password: 'short' })
    expect(r.success).toBe(false)
    const paths = r.error!.issues.map((i) => i.path[0])
    expect(paths).toEqual(expect.arrayContaining(['email', 'password']))
  })
})

describe('authErrorCopy', () => {
  it('maps known provider codes to specific statuses', () => {
    expect(authErrorCopy('invalid_credentials').status).toBe(401)
    expect(authErrorCopy('user_already_exists').code).toBe('email_exists')
    expect(authErrorCopy('over_request_rate_limit').status).toBe(429)
  })

  it('never leaks an unknown provider message', () => {
    const out = authErrorCopy('something_internal')
    expect(out.code).toBe('auth_unavailable')
    expect(out.message).not.toMatch(/something_internal/)
  })
})
