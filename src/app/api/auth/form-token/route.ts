import type { NextRequest } from 'next/server'
import { issueFormToken } from '@/lib/security/bot'
import { LIMITS, clientIp, rateLimit } from '@/lib/security/rateLimit'
import { fail, ok, tooManyRequests } from '@/lib/api/respond'
import { authConfigured } from '@/lib/auth/server'

/**
 * A fresh signed form token for the sign-up form (see lib/security/bot.ts).
 * Never cached: each page load gets its own timestamp.
 */
export async function GET(req: NextRequest) {
  if (!authConfigured()) return fail(503, { code: 'auth_unconfigured', message: 'Accounts are not configured here.' })
  const limit = rateLimit(`form-token:${clientIp(req)}`, LIMITS.formToken)
  if (!limit.ok) return tooManyRequests(limit.retryAfterS)
  return ok({ token: issueFormToken() }, { headers: { 'Cache-Control': 'no-store' } })
}
