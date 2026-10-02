import { describe, expect, it } from 'vitest'
import { validateCredentials, validateEmail, validatePassword } from '@/lib/auth/validate'
import { credentialsSchema } from '@/lib/auth/schema'

describe('credential validation (client)', () => {
  it('accepts a valid sign-up', () => {
    expect(validateCredentials('signup', ' person@example.com ', 'a long password')).toEqual({})
  })

  it('explains each email problem', () => {
    expect(validateEmail('')).toBe('Enter your email')
    expect(validateEmail('person@')).toMatch(/valid email/)
    expect(validateEmail('person@example')).toMatch(/valid email/)
    expect(validateEmail(`${'a'.repeat(250)}@example.com`)).toMatch(/too long/)
  })

  it('applies length rules to sign-up only, except the maximum', () => {
    expect(validatePassword('signup', 'short')).toMatch(/at least 8/)
    expect(validatePassword('signin', 'short')).toBeUndefined()
    expect(validatePassword('signin', 'x'.repeat(73))).toMatch(/72/)
    expect(validatePassword('signup', '        ')).toMatch(/only spaces/)
    expect(validatePassword('signin', '')).toBe('Enter your password')
  })

  it('never passes something the server schema would reject', () => {
    const cases: [string, string][] = [
      ['person@example.com', 'a long password'], ['bad', 'a long password'], ['person@example.com', 'short'],
      ['person@example.com', 'x'.repeat(80)], ['', ''],
    ]
    for (const [email, password] of cases) {
      const clientOk = Object.keys(validateCredentials('signup', email, password)).length === 0
      if (clientOk) expect(credentialsSchema.safeParse({ email, password }).success).toBe(true)
    }
  })
})
