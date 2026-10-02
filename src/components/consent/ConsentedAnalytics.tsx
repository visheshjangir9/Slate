'use client'

import { Analytics, type BeforeSendEvent } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { useConsent } from '@/lib/client/consent'

/** Page paths only: query strings can carry a return URL or a prompt. */
function withoutQuery<T extends { url: string }>(event: T): T {
  const url = new URL(event.url)
  url.search = ''
  url.hash = ''
  return { ...event, url: url.toString() }
}

/**
 * Vercel Web Analytics (page views) and Speed Insights (real-user Core Web
 * Vitals), mounted only after the visitor chooses "Accept all". Neither sets
 * cookies or needs an API key: they report to the Vercel project once
 * Analytics and Speed Insights are enabled in its dashboard. Locally the
 * scripts are absent (they are served by Vercel), so nothing is sent.
 */
export function ConsentedAnalytics() {
  const consent = useConsent()
  if (consent === 'unknown' || !consent?.analytics) return null
  return (
    <>
      <Analytics beforeSend={(e: BeforeSendEvent) => withoutQuery(e)} />
      <SpeedInsights beforeSend={(e) => withoutQuery(e)} />
    </>
  )
}
