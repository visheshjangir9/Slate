import type { NextRequest } from 'next/server'
import { z, ZodError } from 'zod'
import { currentUser, ownerForUser } from '@/lib/auth/server'
import { badRequest, fail, fromZod, ok, serverError, unauthorized } from '@/lib/api/respond'
import { accountStore } from '@/lib/billing/account'
import { PRO_AMOUNT_PAISE, PRO_PASS } from '@/lib/billing/plans'
import { fetchOrder, razorpayConfigured, signatureIsValid } from '@/lib/billing/razorpay'
import { billingStatus } from '@/lib/billing/usage'

const bodySchema = z.object({
  razorpay_order_id: z.string().min(6).max(64),
  razorpay_payment_id: z.string().min(6).max(64),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/),
})

const DAY = 24 * 60 * 60 * 1000

/**
 * Turn a finished Razorpay payment into a Pro pass.
 *
 * Three checks, all on the server: the signature proves Razorpay took the
 * payment for that order; the order, read back from Razorpay, must be the one
 * opened for this account; and its amount must be the Pro price. The same
 * payment can be sent twice (a retry, a double callback) and only counts once.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await currentUser()
    if (!user) return unauthorized()
    if (!razorpayConfigured()) {
      return fail(503, { code: 'payments_unconfigured', message: 'Payments are not switched on yet.' })
    }
    const raw = await req.json().catch(() => null)
    if (!raw) return badRequest('Expected a JSON body')
    const body = bodySchema.parse(raw)

    if (!signatureIsValid(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature)) {
      return fail(400, { code: 'payment_unverified', message: 'That payment could not be verified.' })
    }
    const order = await fetchOrder(body.razorpay_order_id)
    if (order.notes.user_id !== user.id || order.amount !== PRO_AMOUNT_PAISE || order.currency !== PRO_PASS.currency) {
      return fail(400, { code: 'payment_mismatch', message: 'That payment does not match this account.' })
    }

    const accounts = accountStore()
    const account = await accounts.get(user.id)
    if (account.pro?.paymentId !== body.razorpay_payment_id) {
      const now = Date.now()
      const running = account.pro && new Date(account.pro.until).getTime() > now
      // Paying early extends the pass from where it ends; a lapsed one starts today.
      const from = running ? new Date(account.pro!.until).getTime() : now
      await accounts.setPro(user.id, {
        since: running ? account.pro!.since : new Date(now).toISOString(),
        until: new Date(from + PRO_PASS.days * DAY).toISOString(),
        paymentId: body.razorpay_payment_id,
      })
    }
    return ok(await billingStatus(ownerForUser(user.id)))
  } catch (e) {
    if (e instanceof ZodError) return fromZod(e)
    return serverError(e, 'verify_failed')
  }
}
