'use client'

import Link from 'next/link'
import { KIND_LABEL, KINDS, PLANS, PRO_PASS, type Kind, type PlanId } from '@/lib/billing/plans'
import { useBilling } from '@/lib/client/billing'
import { buttonClass } from '@/components/ui/button'
import { IconArrowRight, IconCheck } from '@/components/ui/icons'
import { ProButton, formatInr } from '@/components/billing/ProButton'
import { spot } from '@/components/home/spot'

const allowance = (plan: PlanId, k: Kind): string => {
  const n = PLANS[plan].limits[k]
  if (n === null) return `Unlimited ${KIND_LABEL[k].many}`
  if (n === 0) return `No ${KIND_LABEL[k].many}`
  return `${n} ${n === 1 ? KIND_LABEL[k].one : KIND_LABEL[k].many}`
}

const EXTRAS: Record<PlanId, string[]> = {
  free: ['Your own library, on any browser', 'Unlimited work on your own AI key'],
  pro: ['Allowances refill with every pass', 'Everything in Free'],
}

const FAQ = [
  { q: 'Does Pro renew by itself?',
    a: `No. Pro is a ${PRO_PASS.days}-day pass: one payment, and it ends on its own. Buy another whenever you want one; paying early adds ${PRO_PASS.days} days to the pass you have.` },
  { q: 'What counts against my allowance?',
    a: 'Only finished work. A generation that fails is never counted, and neither is trying it again. Deleting a result does not hand its allowance back.' },
  { q: 'Why are camera moves so generous?',
    a: 'A camera move over your own image renders in your browser, so it costs almost nothing to run. Images and video run on paid AI models, which is what Pro pays for.' },
  { q: 'What if I bring my own AI key?',
    a: 'Work on your own provider key is never counted, on either plan. You pay your provider for it directly, not Slate.' },
  { q: 'How do I pay?',
    a: 'Through Razorpay: UPI, cards, net banking and wallets. Slate never sees or stores your card details.' },
]

function Row({ children, muted = false }: { children: string; muted?: boolean }) {
  return (
    <li className={`flex items-center gap-3 text-[15px] ${muted ? 'text-ink-3' : 'text-ink'}`}>
      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${muted ? 'border border-white/[.17] text-ink-3' : 'bg-ink text-ground'}`}>
        {muted ? <span className="h-px w-2 bg-current" /> : <IconCheck size={12} />}
      </span>
      {children}
    </li>
  )
}

export function PricingPage() {
  const { status, auth } = useBilling()
  const used = status?.plan === 'free' ? status.used : null

  return (
    <div className="wrap pb-[clamp(88px,12vh,152px)] pt-[clamp(56px,9vh,112px)]">
      <p className="text-[13.5px] text-ink-3">Pricing</p>
      <h1 className="display display-xl mt-6 max-w-5xl">Free to start. <span className="serif-accent">Pro when you need it.</span></h1>
      <p className="hero-lede mt-7">
        Make your first image and fifteen camera moves on the house. When you want generative video and room to
        work, one payment opens Pro for {PRO_PASS.days} days.
      </p>

      <div className="mt-[clamp(40px,7vh,72px)] grid items-stretch gap-5 min-[900px]:grid-cols-2">
        {/* Free */}
        <section aria-labelledby="plan-free" className="frame flex flex-col p-7 sm:p-9">
          <h2 id="plan-free" className="text-[15px] text-ink-3">Free</h2>
          <p className="mt-5 flex items-baseline gap-2">
            <span className="font-display text-[56px] font-medium leading-none tracking-[-0.04em]">{formatInr(0)}</span>
            <span className="text-[14.5px] text-ink-3">for as long as you like</span>
          </p>
          <ul className="mt-8 flex flex-col gap-3.5 border-t border-white/[.085] pt-7">
            {KINDS.map((k) => <Row key={k} muted={PLANS.free.limits[k] === 0}>{allowance('free', k)}</Row>)}
            {EXTRAS.free.map((x) => <Row key={x}>{x}</Row>)}
          </ul>
          {used && (
            <p className="meta mt-6">
              Used so far: {KINDS.filter((k) => PLANS.free.limits[k]).map((k) => `${used[k]} of ${PLANS.free.limits[k]} ${KIND_LABEL[k].many}`).join(' · ')}
            </p>
          )}
          <div className="mt-auto pt-9">
            <Link href={auth.status === 'user' ? '/studio/motion' : '/sign-in?mode=signup'} className={buttonClass('secondary', 'lg', 'group w-full')}>
              {auth.status === 'user' ? 'Open the Studio' : 'Start free'}
              <IconArrowRight size={16} className="transition-transform duration-500 ease-out group-hover:translate-x-1" />
            </Link>
          </div>
        </section>

        {/* Pro */}
        <section aria-labelledby="plan-pro" {...spot} className="frame plane lit flex flex-col p-7 sm:p-9">
          <span className="lit-edge" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-44 h-80 bg-[radial-gradient(closest-side,rgba(255,255,255,.13),transparent)]" />
          <div className="relative flex items-center justify-between">
            <h2 id="plan-pro" className="text-[15px] text-ink">Pro</h2>
            <span className="rounded-full border border-white/[.17] bg-white/[.06] px-2.5 py-1 text-[12.5px] leading-none text-ink">Most room to work</span>
          </div>
          <p className="relative mt-5 flex items-baseline gap-2">
            <span className="silver font-display text-[56px] font-medium leading-none tracking-[-0.04em]">{formatInr(PRO_PASS.amountInr)}</span>
            <span className="text-[14.5px] text-ink-3">for {PRO_PASS.days} days · no automatic renewal</span>
          </p>
          <ul className="relative mt-8 flex flex-col gap-3.5 border-t border-white/[.085] pt-7">
            {KINDS.map((k) => <Row key={k}>{allowance('pro', k)}</Row>)}
            {EXTRAS.pro.map((x) => <Row key={x}>{x}</Row>)}
          </ul>
          <div className="relative mt-auto pt-9"><ProButton /></div>
        </section>
      </div>

      <section aria-labelledby="pricing-faq" className="mt-[clamp(72px,11vh,136px)] grid gap-x-[clamp(32px,6vw,96px)] gap-y-8 min-[900px]:grid-cols-[1fr_1.4fr]">
        <h2 id="pricing-faq" className="display display-m">Fair <span className="serif-accent">questions.</span></h2>
        <dl className="border-t border-white/[.085]">
          {FAQ.map((f) => (
            <div key={f.q} className="border-b border-white/[.085] py-[22px]">
              <dt className="text-[17px] font-medium leading-[1.3] tracking-[-0.01em]">{f.q}</dt>
              <dd className="mt-[6px] max-w-[60ch] text-[15px] leading-[1.55] text-[#b9b9b6]">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
