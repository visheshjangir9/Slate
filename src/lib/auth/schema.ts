import { z } from 'zod'

export const PASSWORD_MIN = 8

export const credentialsSchema = z.object({
  email: z.string({ error: 'Enter your email' }).trim().toLowerCase().email('Enter a valid email address').max(254),
  password: z
    .string({ error: 'Enter a password' })
    .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
    .max(72, 'Use 72 characters or fewer'),
})

export type Credentials = z.infer<typeof credentialsSchema>

/**
 * Supabase error codes mapped to copy a person can act on. Anything unmapped
 * gets a generic line; raw provider messages are never shown.
 */
export function authErrorCopy(code: string | undefined): { status: number; code: string; message: string } {
  switch (code) {
    case 'invalid_credentials':
      return { status: 401, code: 'invalid_credentials', message: 'That email and password do not match an account.' }
    case 'email_exists':
    case 'user_already_exists':
      return { status: 409, code: 'email_exists', message: 'An account with this email already exists. Sign in instead.' }
    case 'weak_password':
      return { status: 400, code: 'weak_password', message: 'Choose a stronger password.' }
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return { status: 429, code: 'rate_limited', message: 'Too many attempts. Wait a minute and try again.' }
    case 'user_banned':
      return { status: 403, code: 'user_banned', message: 'This account is disabled.' }
    default:
      return { status: 502, code: 'auth_unavailable', message: 'Sign-in is unavailable right now. Try again shortly.' }
  }
}
