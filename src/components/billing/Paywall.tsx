'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { KIND_LABEL, PLANS, PRO_PASS, type Kind } from '@/lib/billing/plans'
import { paywall, useBilling } from '@/lib/client/billing'
import { IconCheck, IconClose } from '@/components/ui/icons'
import { ProButton, formatInr } from './ProButton'

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

/** Why the panel opened, in the person's terms. */
function reason(kind: Kind | 'plans', freeLimit: number | null): { title: string; accent: string; line: string } {
  if (kind === 'plans') return { title: 'Make more with', accent: 'Slate Pro.', line: 'More images, generative video and every camera move, for thirty days.' }
  if (freeLimit === 0) {
    return { title: `${cap(KIND_LABEL[kind].many)} are part of`, accent: 'Slate Pro.', line: `The Free plan does not include ${KIND_LABEL[kind].many}. Pro does.` }
  }
  const n = freeLimit ?? 0
  return {
    title: `You have used your free ${n === 1 ? KIND_LABEL[kind].one : KIND_LABEL[kind].many}.`, accent: 'Keep going with Pro.',
    line: `The Free plan includes ${n} ${n === 1 ? KIND_LABEL[kind].one : KIND_LABEL[kind].many}. Pro gives you room to work.`,
  }
}

const proLine = (k: Kind) => {
  const n = PLANS.pro.limits[k]
  return n === null ? `Unlimited ${KIND_LABEL[k].many}` : `${n} ${KIND_LABEL[k].many}`
}

/**
 * The upgrade panel. It opens when a generation would go past the plan's
 * allowance (the server decides that; this only explains it) and offers the
 * one thing that lifts the limit. Mounted once, in the Studio.
 */
export function Paywall() {
  const { paywall: open } = useBilling()
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') paywall.close() }
    document.addEventListener('keydown', key)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = prev }
  }, [open])

  if (!open) return null
  const r = reason(open, open === 'plans' ? null : PLANS.free.limits[open])

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" aria-label="Close" onClick={paywall.close} className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="paywall-title" tabIndex={-1} data-testid="paywall"
        className="rise plane relative w-full overflow-hidden rounded-t-[20px] border border-white/[.12] outline-none sm:max-w-[30rem] sm:rounded-[20px]">
        {/* A soft key light behind the heading, the same silver as the rest of the page. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-40 h-80 bg-[radial-gradient(closest-side,rgba(255,255,255,.12),transparent)]" />
        <button type="button" onClick={paywall.close} aria-label="Close"
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full text-ink-3 transition-colors hover:bg-white/[.07] hover:text-ink">
          <IconClose />
        </button>

        <div className="relative max-h-[88dvh] overflow-y-auto p-7 sm:p-9">
          <p className="meta">Slate Pro</p>
          <h2 id="paywall-title" className="display display-s mt-4">
            {r.title} <span className="serif-accent">{r.accent}</span>
          </h2>
          <p className="mt-3 text-[15px] leading-[1.55] text-[#b9b9b6]">{r.line}</p>

          <ul className="mt-7 flex flex-col gap-3 border-t border-white/[.085] pt-6">
            {(['image', 'video', 'motion'] as const).map((k) => (
              <li key={k} className="flex items-center gap-3 text-[15px] text-ink">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink text-ground"><IconCheck size={12} /></span>
                {proLine(k)}
              </li>
            ))}
          </ul>

          <div className="mt-7 flex items-baseline gap-2">
            <span className="font-display text-[40px] font-medium leading-none tracking-[-0.035em]">{formatInr(PRO_PASS.amountInr)}</span>
            <span className="text-[14.5px] text-ink-3">for {PRO_PASS.days} days · no automatic renewal</span>
          </div>

          <ProButton className="mt-6" onPaid={paywall.close} />

          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13.5px] text-ink-3">
            <Link href="/pricing" onClick={paywall.close} className="underline decoration-white/20 underline-offset-4 transition-colors hover:text-ink">Compare plans</Link>
            <Link href="/byok" onClick={paywall.close} className="underline decoration-white/20 underline-offset-4 transition-colors hover:text-ink">Use your own AI key instead</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
