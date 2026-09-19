import 'server-only'
import { cloudflare } from './cloudflare'
import { openaiImages } from './openai'
import { pollinations } from './pollinations'
import type { StillFailure, StillRequest, StillResult } from './types'

export type { StillFailure, StillRequest, StillResult } from './types'

/**
 * Tried in order. OpenAI is primary: it is rate-limit stable and produces no
 * watermark. The keyless service is now only a fallback for when no key is
 * configured, since it rate limits by IP and degrades under load.
 */
const CHAIN = [openaiImages, cloudflare, pollinations]

/**
 * Budget is deliberately tight. A successful fetch is usually 3-6s and slow
 * ones around 30s, but a user watching a dead frame for a minute is worse than
 * a fast, honest failure with a retry button. Measured: a degraded upstream
 * takes ~40s to fail on its own, so we cut it off first.
 */
const ATTEMPTS: { timeoutMs: number; backoffMs: number }[] = [
  { timeoutMs: 22_000, backoffMs: 0 },
  { timeoutMs: 8_000, backoffMs: 1_200 },
]

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * Fetch a still, falling through providers and retrying transient failures.
 *
 * Budget is kept tight on purpose: a user staring at a dead frame for a minute
 * is worse than a fast, honest failure they can retry.
 */
export async function fetchStill(
  req: StillRequest,
): Promise<{ result: StillResult } | { failure: StillFailure }> {
  let worst: StillFailure = 'unavailable'

  for (const provider of CHAIN) {
    if (!provider.configured()) continue

    for (const attempt of ATTEMPTS) {
      if (attempt.backoffMs) await sleep(attempt.backoffMs)
      const ac = new AbortController()
      const timer = setTimeout(() => ac.abort(), attempt.timeoutMs)
      try {
        const out = await provider.fetchStill(req, ac.signal)
        if (typeof out !== 'string') return { result: out }
        worst = out === 'rate_limited' ? 'rate_limited' : worst
        // A rate limit will not clear in 1.5s; move to the next provider.
        if (out === 'rate_limited') break
      } catch {
        // timeout or network error -- retry, then fall through
      } finally {
        clearTimeout(timer)
      }
    }
  }
  return { failure: worst }
}

export const configuredProviders = (): string[] =>
  CHAIN.filter((p) => p.configured()).map((p) => p.id)
