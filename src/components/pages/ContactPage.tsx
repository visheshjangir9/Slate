'use client'

import { useState, type ReactNode } from 'react'
import { CONTACT, CONTACT_CHANNELS, type ContactChannel } from '@/lib/contact'
import { Reveal } from '@/components/home/Reveal'
import { IconArrowUpRight } from '@/components/ui/icons'
import { IntroVideo } from './IntroVideo'

/* Brand marks, drawn to sit on the same 24px grid. */
const LOGO: Record<ContactChannel['id'], ReactNode> = {
  email: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" />
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.56 9.56 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.93.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4v11.25H3V9.75Zm6.5 0h3.83v1.54h.05c.53-1 1.84-2.06 3.8-2.06 4.05 0 4.8 2.67 4.8 6.14v5.63h-4v-4.99c0-1.19-.02-2.72-1.66-2.72-1.66 0-1.92 1.3-1.92 2.64V21h-4V9.75Z" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="5.5" /><circle cx="12" cy="12" r="4.2" /><circle cx="17.4" cy="6.6" r=".6" fill="currentColor" stroke="none" />
    </svg>
  ),
}

function CopyEmail() {
  const [copied, setCopied] = useState(false)
  return (
    <button type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(CONTACT.email); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* clipboard blocked */ }
      }}
      className="rounded-[var(--radius-ctl)] border border-line-strong px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-2 transition-colors hover:border-ink-4 hover:text-ink"
      aria-live="polite">
      {copied ? 'Copied' : 'Copy email'}
    </button>
  )
}

/** Contact: the maker, and one tile per channel, each opening that profile. */
export function ContactPage() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-32 pt-14 sm:px-6 lg:px-10 lg:pt-24">
      <Reveal variant="head">
        <p className="eyebrow flex items-center gap-3 text-ink-3">
          <span className="text-signal">Contact</span><span className="rv-bar h-px w-8 bg-line-strong" />{CONTACT.name}
        </p>
        <h1 className="rv-title display display-xl mt-6 max-w-5xl [text-wrap:balance]">
          Let’s make <span className="serif-accent text-signal">something.</span>
        </h1>
        <div className="rv-aside mt-8 flex max-w-2xl flex-col gap-5">
          <p className="text-[clamp(1.05rem,1.4vw,1.3rem)] leading-relaxed text-ink-2">
            Questions about Slate, a collaboration, or feedback on something you made with it: reach me directly.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a href={`mailto:${CONTACT.email}`} className="font-mono text-[15px] text-ink underline decoration-line-strong underline-offset-[6px] transition-colors hover:text-signal hover:decoration-signal">
              {CONTACT.email}
            </a>
            <CopyEmail />
          </div>
        </div>
      </Reveal>

      <Reveal delay={150} className="mt-14 max-w-[1080px] lg:mt-20">
        <IntroVideo />
      </Reveal>

      <p className="eyebrow mt-16 text-ink-3">Find me</p>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CONTACT_CHANNELS.map((c, i) => (
          <li key={c.id}>
            <Reveal delay={i * 90}>
              <a href={c.href} target={c.id === 'email' ? undefined : '_blank'} rel={c.id === 'email' ? undefined : 'noreferrer'}
                aria-label={`${c.label}: ${c.handle}`}
                className="contact-tile group relative flex h-full flex-col justify-between gap-10 overflow-hidden rounded-[6px] border border-line bg-surface p-6">
                <span className="flex items-start justify-between">
                  <span className="contact-logo flex h-12 w-12 items-center justify-center rounded-full border border-line-strong bg-ground text-ink [&>svg]:h-[22px] [&>svg]:w-[22px]">
                    {LOGO[c.id]}
                  </span>
                  <IconArrowUpRight size={18} className="text-ink-4 transition-all duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-signal" />
                </span>
                <span>
                  <span className="display display-s block">{c.label}</span>
                  <span className="mt-1.5 block truncate font-mono text-[12px] text-ink-3 transition-colors group-hover:text-ink-2">{c.handle}</span>
                </span>
              </a>
            </Reveal>
          </li>
        ))}
      </ul>
    </div>
  )
}
