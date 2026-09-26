import type { NextRequest } from 'next/server'
import { ZodError } from 'zod'
import { authClient, authConfigured, ownerForUser, writeSession } from '@/lib/auth/server'
import { authErrorCopy, credentialsSchema } from '@/lib/auth/schema'
import { adoptGuestWork } from '@/lib/auth/adopt'
import { badRequest, fail, fromZod, ok, serverError } from '@/lib/api/respond'

export async function POST(req: NextRequest) {
  try {
    if (!authConfigured()) return fail(503, { code: 'auth_unconfigured', message: 'Accounts are not configured here.' })
    const body = await req.json().catch(() => null)
    if (!body) return badRequest('Expected a JSON body')
    const { email, password } = credentialsSchema.parse(body)

    const { data, error } = await authClient().auth.signInWithPassword({ email, password })
    if (error || !data.session || !data.user) {
      const e = authErrorCopy(error?.code)
      return fail(e.status, { code: e.code, message: e.message })
    }
    await writeSession(data.session)

    const adopted = await adoptGuestWork(ownerForUser(data.user.id))
    return ok({ user: { id: data.user.id, email: data.user.email ?? email }, adopted })
  } catch (e) {
    if (e instanceof ZodError) return fromZod(e)
    return serverError(e, 'login_failed')
  }
}
