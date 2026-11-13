/**
 * CSRF defence for the API: a state-changing request must come from this
 * site's own pages.
 *
 * Session cookies are SameSite=Lax, which already keeps them off cross-site
 * POSTs in current browsers; this is the second, explicit layer. Browsers
 * attach Origin to every POST/PUT/PATCH/DELETE they send and Sec-Fetch-Site
 * to every request, and a page cannot forge either. A request carrying
 * neither is not from a browser (curl, a server), carries no victim's cookies
 * by accident, and is left to the normal auth checks.
 *
 * Pure, so it is unit-tested without a server.
 */
const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function isCrossSiteWrite(input: {
  method: string
  origin: string | null
  secFetchSite: string | null
  host: string | null
}): boolean {
  if (!UNSAFE.has(input.method.toUpperCase())) return false
  const site = input.secFetchSite?.toLowerCase()
  if (site === 'cross-site' || site === 'same-site') return true
  if (!input.origin) return false
  if (input.origin === 'null') return true
  try {
    return new URL(input.origin).host.toLowerCase() !== (input.host ?? '').toLowerCase()
  } catch {
    return true
  }
}
