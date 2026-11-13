import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

export interface ApiError {
  code: string
  message: string
  /** Field-level detail for validation failures. */
  fields?: Record<string, string>
}

export const ok = <T>(data: T, init?: ResponseInit): NextResponse =>
  NextResponse.json(data, init)

export const fail = (status: number, error: ApiError): NextResponse =>
  NextResponse.json({ error }, { status })

/** Shape of billing's QuotaError, matched structurally so this module stays free of server-only imports. */
interface QuotaLike { code: 'quota_exceeded'; message: string; kind: string; plan: string; limit: number; used: number }
const isQuotaError = (e: unknown): e is QuotaLike =>
  e instanceof Error && (e as { code?: unknown }).code === 'quota_exceeded' && typeof (e as { kind?: unknown }).kind === 'string'

export const badRequest = (message: string, fields?: Record<string, string>) =>
  fail(400, { code: 'invalid_request', message, fields })

export const notFound = (message = 'Not found') => fail(404, { code: 'not_found', message })

export const conflict = (code: string, message: string) => fail(409, { code, message })

/** Turn a Zod failure into field-level messages the UI can attach to inputs. */
export function fromZod(err: ZodError): NextResponse {
  const fields: Record<string, string> = {}
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_'
    fields[key] ??= issue.message
  }
  return badRequest('Some settings are not valid', fields)
}

/**
 * Never let a raw exception reach the client: it can carry internals, and in
 * the provider paths it could carry an Authorization header.
 */
/** Thrown when a route needs a signed-in user and there is none. Becomes a 401. */
export class AuthRequiredError extends Error {
  readonly code = 'auth_required'
  constructor() { super('Sign in to continue.') }
}

export const unauthorized = () =>
  fail(401, { code: 'auth_required', message: 'Sign in to continue.' })

/** Past the plan's allowance. `fields` carries what the upgrade panel needs: kind, plan, limit, used. */
export const paymentRequired = (message: string, fields: Record<string, string>) =>
  fail(402, { code: 'quota_exceeded', message, fields })

export function serverError(err: unknown, code = 'internal_error'): NextResponse {
  if (err instanceof AuthRequiredError) return unauthorized()
  if (isQuotaError(err)) {
    return paymentRequired(err.message, { kind: err.kind, plan: err.plan, limit: String(err.limit), used: String(err.used) })
  }
  const message = err instanceof Error ? err.message : String(err)
  // OpenAI-style (sk-…, Bearer …) and Google-style (AIza…) keys, whoever's they are.
  const safe = message.replace(/(Bearer\s+|sk-|AIza)[A-Za-z0-9._-]+/gi, '[redacted]')
  console.error(`[slate:${code}]`, safe)
  return fail(500, { code, message: 'Something went wrong on our side.' })
}

/** 429 with Retry-After, so well-behaved clients know when to come back. */
export const tooManyRequests = (retryAfterS: number) => {
  const res = fail(429, { code: 'rate_limited', message: 'Too many attempts. Wait a minute and try again.' })
  res.headers.set('Retry-After', String(retryAfterS))
  return res
}
