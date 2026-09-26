import { currentUser } from '@/lib/auth/server'
import { ok } from '@/lib/api/respond'

/** Who is signed in. Tokens stay in httpOnly cookies; only id and email return. */
export async function GET() {
  const user = await currentUser()
  return ok({ user }, { headers: { 'Cache-Control': 'no-store' } })
}
