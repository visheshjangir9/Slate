import type { Limit } from './rateLimit'

/**
 * Per-IP budgets for the API, applied in the proxy before any route runs.
 *
 * Tight where a request costs money or storage (starting a generation,
 * uploading, fetching a still, payments, testing a provider key), generous
 * where the studio's own polling and progress pings need room. The sign-in
 * routes keep their stricter budgets inside the routes as well.
 */
const MIN = 60_000

export const API_BUDGETS = {
  generate: { limit: 20, windowMs: MIN },
  render: { limit: 30, windowMs: MIN },
  upload: { limit: 20, windowMs: MIN },
  still: { limit: 20, windowMs: MIN },
  billing: { limit: 10, windowMs: MIN },
  byok: { limit: 10, windowMs: MIN },
  write: { limit: 240, windowMs: MIN },
  read: { limit: 600, windowMs: MIN },
} satisfies Record<string, Limit>

export type ApiBudget = keyof typeof API_BUDGETS

/** Which budget a request spends, or null for anything outside /api. */
export function apiBudgetFor(method: string, pathname: string): ApiBudget | null {
  if (!pathname.startsWith('/api/')) return null
  const m = method.toUpperCase()
  const write = m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS'
  if (m === 'GET' && pathname === '/api/still') return 'still'
  if (!write) return 'read'
  if (pathname === '/api/generations' && m === 'POST') return 'generate'
  if (/^\/api\/generations\/[^/]+\/retry$/.test(pathname)) return 'generate'
  if (/^\/api\/generations\/[^/]+\/render$/.test(pathname)) return 'render'
  if (/^\/api\/generations\/[^/]+\/artifact$/.test(pathname)) return 'upload'
  if (pathname === '/api/uploads/reference') return 'upload'
  if (pathname.startsWith('/api/billing/')) return 'billing'
  if (pathname.startsWith('/api/byok/')) return 'byok'
  return 'write'
}
