import Link from 'next/link'
import type { Metadata } from 'next'
import { TopBar } from '@/components/shell/TopBar'
import { Footer } from '@/components/shell/Footer'
import { PRIMARY_CTA } from '@/components/shell/nav'
import { ButtonLink } from '@/components/ui/primitives'
import { IconArrowRight } from '@/components/ui/icons'

export const metadata: Metadata = {
  title: 'Page not found',
  description: 'This page does not exist. Head back to Slate’s homepage, Explore or the Studio.',
  robots: { index: false, follow: true },
}

const PLACES = [
  { href: '/explore', label: 'Explore', note: 'Ready-made shot recipes' },
  { href: '/motion', label: 'Motion library', note: '15 real camera moves' },
  { href: '/byok', label: 'Bring your own AI', note: 'Use your own provider' },
  { href: '/contact', label: 'Contact', note: 'Report a broken link' },
]

/** Every unmatched URL, and any notFound() call, lands here with a 404 status. */
export default function NotFound() {
  return (
    <div className="environment flex min-h-dvh flex-col">
      <TopBar />
      <main id="main" className="flex-1">
        <div className="mx-auto max-w-[1440px] px-4 pb-28 pt-16 sm:px-6 lg:px-10 lg:pt-28">
          <p className="eyebrow flex items-center gap-3 text-ink-3">
            <span className="text-signal">404</span><span className="h-px w-8 bg-line-strong" />Page not found
          </p>
          <h1 className="display display-xl mt-6 max-w-5xl [text-wrap:balance]">
            This shot <span className="serif-accent text-signal">didn’t make the cut.</span>
          </h1>
          <p className="mt-8 max-w-xl text-[clamp(1.05rem,1.4vw,1.25rem)] leading-relaxed text-ink-2">
            The page you were looking for has moved or never existed. Check the address, or pick up from one of these.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <ButtonLink href={PRIMARY_CTA.href} variant="contrast" size="lg" className="uppercase tracking-[0.08em]">
              {PRIMARY_CTA.label} <IconArrowRight size={16} />
            </ButtonLink>
            <ButtonLink href="/" variant="ghost" size="lg" className="uppercase tracking-[0.08em]">Back to home</ButtonLink>
          </div>

          <ul className="mt-20 grid gap-px overflow-hidden rounded-[6px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {PLACES.map((p) => (
              <li key={p.href}>
                <Link href={p.href} className="group flex h-full flex-col gap-2 bg-ground p-6 transition-colors hover:bg-surface">
                  <span className="flex items-center justify-between text-[16px] font-semibold text-ink">
                    {p.label}
                    <IconArrowRight size={15} className="text-ink-3 transition-all group-hover:translate-x-0.5 group-hover:text-signal" />
                  </span>
                  <span className="text-[13px] text-ink-3">{p.note}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
      <Footer />
    </div>
  )
}
