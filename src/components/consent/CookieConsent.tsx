'use client'

import Link from 'next/link'
import { setConsent, useConsent, useCookieSettingsOpen } from '@/lib/client/consent'

/**
 * The cookie banner. Shown until a choice is made, and again from "Cookie
 * settings". Rejecting is exactly as easy as accepting: two equal buttons,
 * no pre-ticked boxes, nothing optional loads before a choice.
 *
 * Not a modal: the page stays usable, and the banner sits in its own region
 * so screen readers can find it.
 */
export function CookieConsent() {
  const consent = useConsent()
  const reopened = useCookieSettingsOpen()
  if (consent === 'unknown') return null
  if (consent && !reopened) return null

  return (
    <section aria-labelledby="cookie-title" aria-describedby="cookie-body"
      className="rise fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-[560px] rounded-[8px] border border-line-strong bg-surface p-5 shadow-2xl shadow-black/70 sm:bottom-5 sm:p-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <h2 id="cookie-title" className="text-[15px] font-semibold text-ink">Your privacy</h2>
      <p id="cookie-body" className="mt-2 text-[14px] leading-relaxed text-ink-2">
        Slate uses essential cookies to keep you signed in. With your permission we&rsquo;d also count page views and measure load
        speed. That data is anonymous, uses no cookies and is never used for ads.{' '}
        <Link href="/privacy#cookies" className="text-ink underline underline-offset-4 hover:text-signal">Privacy Policy</Link>
      </p>
      {consent && (
        <p className="mt-2 text-[13px] text-ink-3">
          Current choice: {consent.analytics ? 'all cookies accepted' : 'essential only'}.
        </p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setConsent(false)}
          className="h-11 rounded-[var(--radius-ctl)] border border-line-strong px-4 text-[14px] font-medium text-ink transition-colors hover:border-ink-3">
          Essential only
        </button>
        <button type="button" onClick={() => setConsent(true)}
          className="h-11 rounded-[var(--radius-ctl)] bg-ink px-4 text-[14px] font-semibold text-ground transition-colors hover:bg-white">
          Accept all
        </button>
      </div>
    </section>
  )
}
