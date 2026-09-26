import type { NextRequest } from 'next/server'
import { ZodError } from 'zod'
import { adminClient, authClient, authConfigured, ownerForUser, writeSession } from '@/lib/auth/server'
import { authErrorCopy, credentialsSchema } from '@/lib/auth/schema'
import { badRequest, fail, fromZod, ok, serverError } from '@/lib/api/respond'
import { adoptGuestWork } from '@/lib/auth/adopt'

/**
 * Create a real Supabase Auth user and sign them in.
 *
 * The user is created server-side and marked confirmed. This project's built-in
 * mailer only delivers to its own team, so a confirmation email would never
 * reach anyone else and sign-up would be impossible. The trade-off, stated
 * plainly: an address is not proven to belong to whoever registers it.
 */
export async function POST(req: NextRequest) {
  try {
    if (!authConfigured()) return fail(503, { code: 'auth_unconfigured', message: 'Accounts are not configured here.' })
    const body = await req.json().catch(() => null)
    if (!body) return badRequest('Expected a JSON body')
    const { email, password } = credentialsSchema.parse(body)

    const created = await adminClient().auth.admin.createUser({ email, password, email_confirm: true })
    if (created.error) {
      const e = authErrorCopy(created.error.code)
      return fail(e.status, { code: e.code, message: e.message })
    }

    const { data, error } = await authClient().auth.signInWithPassword({ email, password })
    if (error || !data.session || !data.user) {
      const e = authErrorCopy(error?.code)
      return fail(e.status, { code: e.code, message: e.message })
    }
    await writeSession(data.session)
    const adopted = await adoptGuestWork(ownerForUser(data.user.id))
    return ok({ user: { id: data.user.id, email: data.user.email ?? email }, adopted }, { status: 201 })
  } catch (e) {
    if (e instanceof ZodError) return fromZod(e)
    return serverError(e, 'signup_failed')
  }
}
