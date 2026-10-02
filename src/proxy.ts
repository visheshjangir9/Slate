import { NextResponse, type NextRequest } from 'next/server'
import { httpsRedirectTarget } from '@/lib/security/https'

/**
 * Runs before every route. Its one job: a plain-HTTP request in production is
 * permanently redirected to the same URL over HTTPS (308 keeps the method and
 * body). HSTS, set in next.config.ts, then keeps the browser on HTTPS.
 */
export function proxy(req: NextRequest) {
  const target = httpsRedirectTarget({
    url: req.url,
    host: req.headers.get('host'),
    forwardedProto: req.headers.get('x-forwarded-proto'),
    production: process.env.NODE_ENV === 'production',
  })
  return target ? NextResponse.redirect(target, 308) : NextResponse.next()
}

export const config = {
  // Build output is immutable and only ever linked from an HTTPS page.
  matcher: ['/((?!_next/static|_next/image).*)'],
}
