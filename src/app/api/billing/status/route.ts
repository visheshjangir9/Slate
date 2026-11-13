import { resolveOwnerId } from '@/lib/api/session'
import { ok, serverError } from '@/lib/api/respond'
import { billingStatus } from '@/lib/billing/usage'

/** The signed-in account's plan, allowances and what it has used. */
export async function GET() {
  try {
    return ok(await billingStatus(await resolveOwnerId()), { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return serverError(e, 'billing_status_failed')
  }
}
