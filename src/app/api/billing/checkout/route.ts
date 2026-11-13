import { currentUser } from '@/lib/auth/server'
import { fail, ok, serverError, unauthorized } from '@/lib/api/respond'
import { PRO_PASS } from '@/lib/billing/plans'
import { createProOrder, publicKeyId, razorpayConfigured } from '@/lib/billing/razorpay'

/**
 * Open a Razorpay order for one Pro pass. The amount is fixed here on the
 * server; the browser is only told what to show. Nothing is granted until
 * /api/billing/verify has checked the payment's signature.
 */
export async function POST() {
  try {
    const user = await currentUser()
    if (!user) return unauthorized()
    if (!razorpayConfigured()) {
      return fail(503, { code: 'payments_unconfigured', message: 'Payments are not switched on yet.' })
    }
    const order = await createProOrder(user.id)
    return ok({
      orderId: order.id, amount: order.amount, currency: order.currency,
      keyId: publicKeyId(), email: user.email, days: PRO_PASS.days,
    })
  } catch (e) {
    return serverError(e, 'checkout_failed')
  }
}
