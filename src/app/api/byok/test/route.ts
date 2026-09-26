import type { NextRequest } from 'next/server'
import { ZodError } from 'zod'
import { resolveOwnerId } from '@/lib/api/session'
import { fromZod, ok, serverError } from '@/lib/api/respond'
import { byokBodySchema } from '@/lib/byok/schema'
import { ByokError } from '@/lib/byok/errors'
import { testConnection } from '@/lib/byok/service'

/**
 * Test a user's provider key with one free listing call, and return the
 * models the key can reach that Slate can drive.
 *
 * Signed-in only: the session is checked before the body is even read, so a
 * signed-out request never gets a key anywhere near a provider. The key is
 * used for this request and dropped; it is never stored, logged or returned.
 */
export async function POST(req: NextRequest) {
  try {
    await resolveOwnerId()
    const body = byokBodySchema.parse(await req.json().catch(() => ({})))
    // A provider saying no is an answer, not an HTTP failure: 401 stays
    // reserved for "your Slate session is missing".
    try {
      const models = await testConnection(body.credential, body.settings)
      return ok({ connected: true, models })
    } catch (e) {
      if (e instanceof ByokError) return ok({ connected: false, error: { code: e.code, message: e.message } })
      throw e
    }
  } catch (e) {
    if (e instanceof ZodError) return fromZod(e)
    return serverError(e, 'byok_test_failed')
  }
}
