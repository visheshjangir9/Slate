import 'server-only'
import { hasSupabaseEnv } from '@/lib/env'
import { adminClient } from '@/lib/auth/server'
import type { Kind } from './plans'

/**
 * The billing facts kept per account: whether a Pro pass is running, and a
 * note of every counted generation the person has since deleted, so deleting
 * a result never hands its allowance back.
 *
 * With Supabase it lives in the auth user's app_metadata (under `slate`),
 * which only the server's secret key can write: no new table, and nothing a
 * signed-in browser can edit. Without Supabase (tests, local) it is in memory.
 */
export interface ProPass {
  since: string
  until: string
  /** The payment that opened or last extended the pass. Makes activation idempotent. */
  paymentId: string
}

export interface Account {
  pro: ProPass | null
  deleted: { k: Kind; t: string }[]
  /**
   * Every payment ever credited. Checking only the latest one would let two
   * real payments be replayed in turn (A, B, A, B…) for endless extensions.
   */
  payments: string[]
}

/** Enough to outlast any allowance; the oldest notes fall off first. */
const MAX_DELETED = 400
/** One a month for over sixteen years. */
const MAX_PAYMENTS = 200

const withPayment = (account: Account, pro: ProPass): Account => ({
  ...account,
  pro,
  payments: account.payments.includes(pro.paymentId)
    ? account.payments
    : [...account.payments, pro.paymentId].slice(-MAX_PAYMENTS),
})

export interface AccountStore {
  get(userId: string): Promise<Account>
  setPro(userId: string, pro: ProPass): Promise<void>
  noteDeleted(userId: string, kind: Kind, createdAt: string): Promise<void>
}

const empty = (): Account => ({ pro: null, deleted: [], payments: [] })

const KIND_SET = new Set<string>(['image', 'video', 'motion'])

/** Read whatever is stored defensively: metadata is JSON, and old shapes must never throw. */
export function parseAccount(raw: unknown): Account {
  const r = (raw ?? {}) as { pro?: Partial<ProPass> | null; deleted?: unknown; payments?: unknown }
  const pro = r.pro && typeof r.pro.since === 'string' && typeof r.pro.until === 'string'
    ? { since: r.pro.since, until: r.pro.until, paymentId: String(r.pro.paymentId ?? '') }
    : null
  const deleted = Array.isArray(r.deleted)
    ? r.deleted.filter((d): d is { k: Kind; t: string } =>
        Boolean(d) && KIND_SET.has((d as { k?: string }).k ?? '') && typeof (d as { t?: unknown }).t === 'string')
    : []
  const payments = Array.isArray(r.payments) ? r.payments.filter((p): p is string => typeof p === 'string' && p !== '') : []
  // Accounts written before the list existed still remember their latest payment.
  if (pro?.paymentId && !payments.includes(pro.paymentId)) payments.push(pro.paymentId)
  return { pro, deleted, payments }
}

export class MemoryAccountStore implements AccountStore {
  private rows = new Map<string, Account>()
  async get(userId: string) { return structuredClone(this.rows.get(userId) ?? empty()) }
  async setPro(userId: string, pro: ProPass) {
    this.rows.set(userId, withPayment(this.rows.get(userId) ?? empty(), pro))
  }
  async noteDeleted(userId: string, kind: Kind, createdAt: string) {
    const cur = this.rows.get(userId) ?? empty()
    this.rows.set(userId, { ...cur, deleted: [...cur.deleted, { k: kind, t: createdAt }].slice(-MAX_DELETED) })
  }
}

export class SupabaseAccountStore implements AccountStore {
  private async read(userId: string): Promise<{ account: Account; meta: Record<string, unknown> }> {
    const { data, error } = await adminClient().auth.admin.getUserById(userId)
    if (error || !data.user) throw new Error(`billing account read failed: ${error?.code ?? 'no_user'}`)
    const meta = (data.user.app_metadata ?? {}) as Record<string, unknown>
    return { account: parseAccount(meta.slate), meta }
  }
  private async write(userId: string, meta: Record<string, unknown>, account: Account) {
    const { error } = await adminClient().auth.admin.updateUserById(userId, { app_metadata: { ...meta, slate: account } })
    if (error) throw new Error(`billing account write failed: ${error.code ?? 'unknown'}`)
  }
  async get(userId: string) { return (await this.read(userId)).account }
  async setPro(userId: string, pro: ProPass) {
    const { account, meta } = await this.read(userId)
    await this.write(userId, meta, withPayment(account, pro))
  }
  async noteDeleted(userId: string, kind: Kind, createdAt: string) {
    const { account, meta } = await this.read(userId)
    await this.write(userId, meta, { ...account, deleted: [...account.deleted, { k: kind, t: createdAt }].slice(-MAX_DELETED) })
  }
}

const g = globalThis as typeof globalThis & { __slateAccounts?: AccountStore }

/** Same rule as the generation store: Supabase when it is configured, memory for tests and local runs. */
export function accountStore(): AccountStore {
  const memory = process.env.SLATE_STORE === 'memory' || Boolean(process.env.VITEST) || !hasSupabaseEnv()
  g.__slateAccounts ??= memory ? new MemoryAccountStore() : new SupabaseAccountStore()
  return g.__slateAccounts
}

/** Owner keys are `user:<id>`; billing is kept against the bare user id. */
export const userIdOf = (ownerId: string): string => ownerId.replace(/^user:/, '')
