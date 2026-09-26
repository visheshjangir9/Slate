import { NextResponse, type NextRequest } from 'next/server'
import { currentUser } from '@/lib/auth/server'
import { safeNext } from '@/lib/auth/next'

/**
 * Rotate an expired session, then continue. Cookies can only be written here,
 * not in the server component that noticed the expiry.
 */
export async function GET(req: NextRequest) {
  const next = safeNext(req.nextUrl.searchParams.get('next'))
  const user = await currentUser({ refresh: true })
  const to = user ? next : `/sign-in?next=${encodeURIComponent(next)}`
  return NextResponse.redirect(new URL(to, req.url))
}
