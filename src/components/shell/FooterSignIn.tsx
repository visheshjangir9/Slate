'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/client/auth'

/** "Sign in" only for visitors: a signed-in account has nothing to sign in to. */
export function FooterSignIn({ className }: { className: string }) {
  const { status } = useAuth()
  if (status === 'user') return null
  return <li><Link href="/sign-in" className={className}>Sign in</Link></li>
}
