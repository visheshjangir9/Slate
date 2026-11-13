'use client'

import Link from 'next/link'
import { useState } from 'react'
import { PRO_PASS } from '@/lib/billing/plans'
import { ApiError } from '@/lib/client/api'
import { buyProPass, useBilling } from '@/lib/client/billing'
import { Button, buttonClass } from '@/components/ui/primitives'
import { IconArrowRight, IconCheck } from '@/components/ui/icons'

export const formatInr = (n: number) => `₹${n.toLocaleString('en-IN')}`
const longDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

/**
 * The one way to buy Pro, wherever it appears. It always tells the truth
 * about where things stand: sign in first, already on Pro, payments not
 * switched on yet, or ready to pay.
 */
export function ProButton({ onPaid, className = '' }: { onPaid?: () => void; className?: string }) {
  const { status, auth } = useBilling()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (auth.status === 'guest') {
    return (
      <Link href="/sign-in?mode=signup" className={buttonClass('contrast', 'lg', `group w-full ${className}`)}>
        Create a free account <IconArrowRight size={16} className="transition-transform duration-500 ease-out group-hover:translate-x-1" />
      </Link>
    )
  }
  if (status?.plan === 'pro') {
    return (
      <p className={`flex min-h-12 items-center justify-center gap-2 rounded-[12px] border border-white/[.17] bg-white/[.045] px-4 text-[15px] text-ink ${className}`}>
        <IconCheck size={16} /> You are on Pro{status.until ? ` until ${longDate(status.until)}` : ''}
      </p>
    )
  }
  if (status && !status.payments) {
    return (
      <div className={className}>
        <Button variant="contrast" size="lg" disabled className="w-full">Pro opens soon</Button>
        <p className="meta mt-3 text-center">Payments are being switched on. Nothing has been charged.</p>
      </div>
    )
  }

  const pay = async () => {
    setBusy(true); setError(null)
    try {
      if ((await buyProPass()) === 'paid') onPaid?.()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The payment did not go through. You have not been charged twice; try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={className}>
      <Button variant="contrast" size="lg" disabled={busy || !status} onClick={pay} className="group w-full">
        {busy ? 'Opening payment…' : <>Get Pro · {formatInr(PRO_PASS.amountInr)} <IconArrowRight size={16} className="transition-transform duration-500 ease-out group-hover:translate-x-1" /></>}
      </Button>
      {error && <p role="alert" className="mt-3 text-center text-[13px] text-danger">{error}</p>}
    </div>
  )
}
