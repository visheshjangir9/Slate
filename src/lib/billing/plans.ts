/**
 * Plans, as one table. Everything that mentions a price or an allowance (the
 * server check, the pricing page, the upgrade panel) reads it from here, so
 * changing a number is a one-line edit.
 *
 * What counts:
 *   image   a still made on Slate's image model
 *   video   a clip made on Slate's generative video model
 *   motion  a camera move from Slate's own engine. It renders in the person's
 *           browser, which is why the allowance is generous.
 *
 * Work on the person's own provider key (Bring your own AI) is never counted:
 * they pay their provider for it, not Slate.
 */
export type Kind = 'image' | 'video' | 'motion'
export type PlanId = 'free' | 'pro'
export const KINDS: Kind[] = ['image', 'video', 'motion']

/** A number, or null for no limit. */
export type Limits = Record<Kind, number | null>

export interface Plan {
  id: PlanId
  name: string
  limits: Limits
  /** Free allowances are for the life of the account; Pro's refill with each pass. */
  window: 'lifetime' | 'pass'
}

export const PLANS: Record<PlanId, Plan> = {
  free: { id: 'free', name: 'Free', limits: { image: 1, video: 0, motion: 15 }, window: 'lifetime' },
  pro: { id: 'pro', name: 'Pro', limits: { image: 50, video: 10, motion: null }, window: 'pass' },
}

/** Pro is a pass, not a subscription: one payment, thirty days, no automatic renewal. */
export const PRO_PASS = { amountInr: 799, days: 30, currency: 'INR' } as const
export const PRO_AMOUNT_PAISE = PRO_PASS.amountInr * 100

export type Usage = Record<Kind, number>
export const noUsage = (): Usage => ({ image: 0, video: 0, motion: 0 })

/**
 * What one generation is counted as, decided from the engine that runs it and
 * never from the workflow the client says it is in: the camera-motion engine
 * is a camera move, the image model an image, and anything else is video.
 */
export function kindOf(g: { provider: string }): Kind {
  if (g.provider === 'gpt-image') return 'image'
  if (g.provider === 'cinematic') return 'motion'
  return 'video'
}

export const remaining = (limits: Limits, used: Usage, kind: Kind): number | null => {
  const cap = limits[kind]
  return cap === null ? null : Math.max(0, cap - used[kind])
}

export const KIND_LABEL: Record<Kind, { one: string; many: string }> = {
  image: { one: 'image', many: 'images' },
  video: { one: 'video', many: 'videos' },
  motion: { one: 'camera move', many: 'camera moves' },
}

/** What the Studio and the pricing page are told about an account. Safe to send to the browser. */
export interface BillingStatus {
  plan: PlanId
  limits: Limits
  used: Usage
  /** When the current Pro pass ends, or null on Free. */
  until: string | null
  /** Whether checkout can run in this environment. */
  payments: boolean
}
