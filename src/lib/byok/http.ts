import 'server-only'
import { ByokError } from './errors'

/**
 * The only way an adapter talks to a provider.
 *
 *   - Fixed HTTPS origins only. There is no user-supplied endpoint anywhere
 *     (no custom or "OpenAI-compatible" URLs), so there is no SSRF surface.
 *   - A hard timeout per attempt (AbortSignal), plus the caller's own signal.
 *   - Bounded retries, only for rate limits, 5xx and network failures, and
 *     only where the caller says the request is safe to repeat. Submitting a
 *     billable generation is never retried.
 *   - Redirects are refused, except on artifact downloads, which follow them
 *     manually and only to the provider's own storage hosts, never carrying
 *     the user's key to the new host.
 */
const ALLOWED_ORIGINS = new Set([
  'https://generativelanguage.googleapis.com',
  'https://api.openai.com',
  'https://openrouter.ai',
  'https://api.anthropic.com',
  'https://api.mistral.ai',
])

/** Where a provider may redirect an artifact download (signed storage URLs). */
const DOWNLOAD_HOSTS = [/\.googleapis\.com$/, /\.googleusercontent\.com$/, /^openrouter\.ai$/, /\.openrouter\.ai$/, /^api\.openai\.com$/, /\.openai\.com$/, /\.blob\.core\.windows\.net$/, /\.cloudfront\.net$/, /\.r2\.cloudflarestorage\.com$/, /\.amazonaws\.com$/]

export interface Policy {
  timeoutMs: number
  maxRetries: number
  signal?: AbortSignal
  /** Test seam: waits between attempts. */
  sleep?: (ms: number) => Promise<void>
}

const RETRYABLE = (status: number) => status === 429 || status >= 500

export async function providerFetch(url: string, init: RequestInit, policy: Policy): Promise<Response> {
  const origin = new URL(url).origin
  if (!ALLOWED_ORIGINS.has(origin)) throw new ByokError('byok_unsupported')

  const sleep = policy.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  const attempts = 1 + Math.max(0, Math.min(2, policy.maxRetries))
  let last: Response | null = null

  for (let i = 0; i < attempts; i++) {
    if (policy.signal?.aborted) throw new ByokError('byok_timeout')
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), policy.timeoutMs)
    const onAbort = () => ac.abort()
    policy.signal?.addEventListener('abort', onAbort, { once: true })
    try {
      const res = await fetch(url, { ...init, signal: ac.signal, redirect: 'error' })
      if (!RETRYABLE(res.status) || i === attempts - 1) return res
      last = res
    } catch {
      // The error object is discarded on purpose: it is never logged or shown.
      if (ac.signal.aborted) {
        if (i === attempts - 1 || policy.signal?.aborted) throw new ByokError('byok_timeout')
      } else if (i === attempts - 1) {
        throw new ByokError('byok_unreachable')
      }
    } finally {
      clearTimeout(timer)
      policy.signal?.removeEventListener('abort', onAbort)
    }
    await sleep(600 * 2 ** i)
  }
  return last as Response
}

export const MAX_ARTIFACT_BYTES = 200 * 1024 * 1024

/** Read a response body, refusing anything larger than `max` bytes. */
export async function readCapped(res: Response, max = MAX_ARTIFACT_BYTES): Promise<Uint8Array> {
  const declared = Number(res.headers.get('content-length') ?? 0)
  if (declared > max) throw new ByokError('byok_bad_video')
  if (!res.body) return new Uint8Array(await res.arrayBuffer())
  const reader = res.body.getReader()
  const parts: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > max) { await reader.cancel(); throw new ByokError('byok_bad_video') }
    parts.push(value)
  }
  const out = new Uint8Array(total)
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.byteLength }
  return out
}

/**
 * Download a generated artifact. The first request goes to the provider's
 * own origin with its auth headers; one redirect is followed, only to a known
 * storage host over HTTPS, and without the auth headers.
 */
export async function downloadArtifact(url: string, headers: Record<string, string>, policy: Policy): Promise<Uint8Array> {
  const u = new URL(url)
  if (!ALLOWED_ORIGINS.has(u.origin)) throw new ByokError('byok_unsupported')
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), policy.timeoutMs)
  const onAbort = () => ac.abort()
  policy.signal?.addEventListener('abort', onAbort, { once: true })
  try {
    let res = await fetch(url, { headers, redirect: 'manual', signal: ac.signal })
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      const next = loc ? new URL(loc, url) : null
      if (!next || next.protocol !== 'https:' || !DOWNLOAD_HOSTS.some((h) => h.test(next.hostname))) throw new ByokError('byok_bad_video')
      res = await fetch(next.toString(), { redirect: 'error', signal: ac.signal })
    }
    if (res.status === 401 || res.status === 403) throw new ByokError('byok_auth_failed')
    if (res.status === 404 || res.status === 410) throw new ByokError('byok_job_expired')
    if (!res.ok) throw new ByokError('byok_bad_video')
    return await readCapped(res)
  } catch (e) {
    if (e instanceof ByokError) throw e
    throw new ByokError(ac.signal.aborted ? 'byok_timeout' : 'byok_unreachable')
  } finally {
    clearTimeout(timer)
    policy.signal?.removeEventListener('abort', onAbort)
  }
}

/** Map a provider's HTTP status to a normalised error. Bodies are never echoed. */
export function errorForStatus(status: number): ByokError {
  if (status === 401) return new ByokError('byok_auth_failed')
  if (status === 402) return new ByokError('byok_no_credit')
  if (status === 403) return new ByokError('byok_auth_failed')
  if (status === 404) return new ByokError('byok_model_unavailable')
  if (status === 429) return new ByokError('byok_rate_limited')
  if (status >= 500) return new ByokError('byok_unreachable')
  return new ByokError('byok_failed')
}
