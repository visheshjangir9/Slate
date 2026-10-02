/**
 * Force HTTPS: decide whether a request must be redirected to https://.
 *
 * Pure, so it is unit-tested without a server. Behind Vercel (or any proxy)
 * the original scheme arrives in x-forwarded-proto; a list such as
 * "http,https" reflects the hops, and the first entry is the client's.
 * Local hosts are exempt so `next start` keeps working over plain HTTP.
 */
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/i

export function httpsRedirectTarget(input: {
  url: string
  host: string | null
  forwardedProto: string | null
  production: boolean
}): string | null {
  if (!input.production || !input.host) return null
  if (LOCAL_HOST.test(input.host)) return null
  const proto = input.forwardedProto?.split(',')[0]?.trim().toLowerCase()
  if (proto !== 'http') return null
  const target = new URL(input.url)
  target.protocol = 'https:'
  target.host = input.host
  target.port = ''
  return target.toString()
}

/** Two years, the preload-list minimum. Browsers ignore it on plain HTTP. */
export const HSTS_VALUE = 'max-age=63072000; includeSubDomains'
