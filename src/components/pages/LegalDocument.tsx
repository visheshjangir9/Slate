import Link from 'next/link'
import type { ReactNode } from 'react'
import { SITE } from '@/lib/site'

export interface LegalSection {
  id: string
  title: string
  body: ReactNode
}

/**
 * Shared frame for /privacy and /terms: a headline, the effective date, a
 * table of contents that becomes a sidebar on wide screens, and readable
 * prose (65ch measure, AA contrast on the ground colour).
 */
export function LegalDocument({
  eyebrow, title, intro, sections, related,
}: {
  eyebrow: string
  title: string
  intro: ReactNode
  sections: LegalSection[]
  related: { label: string; href: string }
}) {
  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-32 pt-14 sm:px-6 lg:px-10 lg:pt-24">
      <p className="eyebrow text-signal">{eyebrow}</p>
      <h1 className="display display-l mt-6 max-w-4xl [text-wrap:balance]">{title}</h1>
      <p className="tabular mt-6 text-[12px] text-ink-3">
        Last updated <time dateTime="2026-10-02">{SITE.legalUpdated}</time>
      </p>
      <div className="mt-8 max-w-[65ch] text-[16px] leading-relaxed text-ink-2">{intro}</div>

      <div className="mt-14 grid gap-12 border-t border-line pt-10 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
          <p className="eyebrow text-ink-3">On this page</p>
          <ol className="mt-4 flex flex-col gap-2 text-[14px]">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="inline-flex gap-2 py-1 text-ink-2 transition-colors hover:text-signal">
                  <span className="tabular text-ink-3">{String(i + 1).padStart(2, '0')}</span>{s.title}
                </a>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-[13px] text-ink-3">
            See also{' '}
            <Link href={related.href} className="text-ink underline underline-offset-4 hover:text-signal">{related.label}</Link>
          </p>
        </nav>

        <div className="legal max-w-[70ch]">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-24 border-b border-line pb-10 pt-2 [&+section]:pt-10">
              <h2 id={`${s.id}-title`} className="flex items-baseline gap-3 text-[22px] font-semibold tracking-[-0.01em] text-ink">
                <span className="tabular text-[13px] font-normal text-signal">{String(i + 1).padStart(2, '0')}</span>
                {s.title}
              </h2>
              <div className="mt-4 flex flex-col gap-4 text-[15px] leading-relaxed text-ink-2">{s.body}</div>
            </section>
          ))}
          <p className="mt-10 text-[14px] text-ink-3">
            Questions about this page? Email{' '}
            <a href={`mailto:${SITE.contactEmail}`} className="text-ink underline underline-offset-4 hover:text-signal">
              {SITE.contactEmail}
            </a>.
          </p>
        </div>
      </div>
    </div>
  )
}
