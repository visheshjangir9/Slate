import { NextResponse, type NextRequest } from 'next/server'
import { httpsRedirectTarget } from '@/lib/security/https'
import { isCrossSiteWrite } from '@/lib/security/origin'
import { API_BUDGETS, apiBudgetFor } from '@/lib/security/apiLimits'
import { clientIp, rateLimit } from '@/lib/security/rateLimit'
import { securityEvent } from '@/lib/security/audit'

/**
 * Runs before every route, in this order:
 *   1. a plain-HTTP request in production is permanently redirected to HTTPS
 *      (308 keeps the method and body); HSTS in next.config.ts then keeps the
 *      browser there
 *   2. a state-changing API request from another site is refused (CSRF)
 *   3. every API request spends from a per-IP budget (rate limiting)
 */
export function proxy(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  const target = httpsRedirectTarget({
    url: req.url,
    host: req.headers.get('host'),
    forwardedProto: req.headers.get('x-forwarded-proto'),
    production: process.env.NODE_ENV === 'production',
  })
  if (target) return NextResponse.redirect(target, 308)

  const { pathname } = req.nextUrl
  if (!pathname.startsWith('/api/')) return NextResponse.next()

  const ip = clientIp(req)
  if (isCrossSiteWrite({
    method: req.method,
    origin: req.headers.get('origin'),
    secFetchSite: req.headers.get('sec-fetch-site'),
    host,
  })) {
    securityEvent('cross_origin_blocked', { ip, method: req.method, path: pathname, origin: req.headers.get('origin') ?? undefined })
    return NextResponse.json(
      { error: { code: 'cross_origin', message: 'This request must come from Slate itself.' } },
      { status: 403 },
    )
  }

  const budget = apiBudgetFor(req.method, pathname)
  if (budget) {
    const r = rateLimit(`api:${budget}:${ip}`, API_BUDGETS[budget])
    if (!r.ok) {
      securityEvent('rate_limited', { ip, budget, method: req.method, path: pathname })
      return NextResponse.json(
        { error: { code: 'rate_limited', message: 'Too many requests. Wait a minute and try again.' } },
        { status: 429, headers: { 'Retry-After': String(r.retryAfterS) } },
      )
    }
  }
  return NextResponse.next()
}

export const config = {
  // Build output is immutable and only ever linked from an HTTPS page.
  matcher: ['/((?!_next/static|_next/image).*)'],
}
