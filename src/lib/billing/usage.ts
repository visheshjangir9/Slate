import 'server-only'
import { isByokProviderTag } from '@/lib/byok/catalog'
import { generationStore } from '@/lib/store'
import { accountStore, userIdOf, type Account } from './account'
import { KIND_LABEL, PLANS, kindOf, noUsage, type BillingStatus, type Kind, type PlanId, type Usage } from './plans'
import { razorpayConfigured } from './razorpay'

/** A generation that would go past the plan's allowance. Becomes a 402 with what the Studio needs to explain it. */
export class QuotaError extends Error {
  readonly code = 'quota_exceeded'
  constructor(readonly kind: Kind, readonly plan: PlanId, readonly limit: number, readonly used: number) {
    super(
      limit === 0
        ? `${KIND_LABEL[kind].many[0].toUpperCase()}${KIND_LABEL[kind].many.slice(1)} are part of Slate Pro.`
        : `You have used ${used} of ${limit} ${limit === 1 ? KIND_LABEL[kind].one : KIND_LABEL[kind].many} on the ${PLANS[plan].name} plan.`,
    )
  }
}

export const activePlan = (account: Account, now: Date): PlanId =>
  account.pro && new Date(account.pro.until).getTime() > now.getTime() ? 'pro' : 'free'

/**
 * What an account has used, counted from its own history rather than a
 * running counter: a failed generation never counts, and a retry that fails
 * again costs nothing. Deleted results are added back from the account's
 * notes. On Pro only work made during the current pass counts.
 */
export async function usageFor(ownerId: string, account: Account, plan: PlanId): Promise<Usage> {
  const since = plan === 'pro' && account.pro ? account.pro.since : ''
  const used = noUsage()
  for (const row of await generationStore().listUsage(ownerId)) {
    if (row.status === 'failed' || isByokProviderTag(row.provider) || row.createdAt < since) continue
    used[kindOf(row)]++
  }
  for (const d of account.deleted) if (d.t >= since) used[d.k]++
  return used
}

export async function billingStatus(ownerId: string, now = new Date()): Promise<BillingStatus> {
  const account = await accountStore().get(userIdOf(ownerId))
  const plan = activePlan(account, now)
  return {
    plan,
    limits: PLANS[plan].limits,
    used: await usageFor(ownerId, account, plan),
    until: plan === 'pro' ? account.pro!.until : null,
    payments: razorpayConfigured(),
  }
}

/** Throws QuotaError when one more generation of this kind is past the allowance. */
export async function assertWithinPlan(ownerId: string, kind: Kind, now = new Date()): Promise<void> {
  const status = await billingStatus(ownerId, now)
  const limit = status.limits[kind]
  if (limit !== null && status.used[kind] >= limit) throw new QuotaError(kind, status.plan, limit, status.used[kind])
}

/** Keep the allowance spent when a counted result is deleted. */
export async function noteDeletion(row: { deviceId: string; provider: string; status: string; createdAt: string }) {
  if (row.status === 'failed' || isByokProviderTag(row.provider)) return
  await accountStore().noteDeleted(userIdOf(row.deviceId), kindOf(row), row.createdAt)
}
