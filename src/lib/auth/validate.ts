import { PASSWORD_MIN } from './schema'

/**
 * Client-side credential checks. Mirrors credentialsSchema so most mistakes
 * are caught before a round trip; the server still validates everything.
 */
export type CredentialMode = 'signin' | 'signup'
export type CredentialErrors = Partial<Record<'email' | 'password', string>>

export const EMAIL_MAX = 254
export const PASSWORD_MAX = 72
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validateEmail(email: string): string | undefined {
  const v = email.trim()
  if (!v) return 'Enter your email'
  if (v.length > EMAIL_MAX) return 'That email is too long'
  if (!EMAIL.test(v)) return 'Enter a valid email address, like name@example.com'
}

export function validatePassword(mode: CredentialMode, password: string): string | undefined {
  if (!password) return mode === 'signup' ? 'Choose a password' : 'Enter your password'
  if (mode === 'signup' && password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters`
  if (password.length > PASSWORD_MAX) return `Use ${PASSWORD_MAX} characters or fewer`
  if (mode === 'signup' && !password.trim()) return 'A password cannot be only spaces'
}

export function validateCredentials(mode: CredentialMode, email: string, password: string): CredentialErrors {
  const f: CredentialErrors = {}
  const e = validateEmail(email)
  const p = validatePassword(mode, password)
  if (e) f.email = e
  if (p) f.password = p
  return f
}
