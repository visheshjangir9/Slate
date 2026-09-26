import type { Generation } from '@/lib/generation/types'
import type { ByokRequestBody } from './api'

/** Why following a provider video job ended. */
export type FollowOutcome = 'completed' | 'failed' | 'key_gone' | 'cancelled' | 'deadline' | 'lost'

export interface FollowDeps {
  id: string
  /** The key body for this provider right now, or null once it is gone (sign-out, reload, other account). */
  credential: () => ByokRequestBody | null
  poll: (id: string, body: ByokRequestBody, signal: AbortSignal) => Promise<{ generation: Generation; done?: boolean }>
  onUpdate: (g: Generation) => void
  signal: AbortSignal
  intervalMs?: number
  deadlineMs?: number
  maxConsecutiveErrors?: number
  now?: () => number
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>
}

const wait = (ms: number, signal: AbortSignal) => new Promise<void>((resolve) => {
  if (signal.aborted) return resolve()
  const t = setTimeout(resolve, ms)
  signal.addEventListener('abort', () => { clearTimeout(t); resolve() }, { once: true })
})

/**
 * Follow one provider video job until it ends, one poll at a time.
 *
 * Bounded in every direction: it stops on completion or failure, the moment
 * the key disappears (so no request is ever made with a key the user has
 * signed out of), on cancel, at a hard deadline, and after repeated network
 * errors. It never resubmits and never retries a generation; it only reads
 * the job's state.
 */
export async function followVideoJob(d: FollowDeps): Promise<FollowOutcome> {
  const now = d.now ?? Date.now
  const sleep = d.sleep ?? wait
  const interval = d.intervalMs ?? 8_000
  const deadline = now() + (d.deadlineMs ?? 15 * 60_000)
  const maxErrors = d.maxConsecutiveErrors ?? 5
  let errors = 0

  for (;;) {
    await sleep(interval, d.signal)
    if (d.signal.aborted) return 'cancelled'
    if (now() > deadline) return 'deadline'
    const body = d.credential()
    if (!body) return 'key_gone'
    try {
      const { generation } = await d.poll(d.id, body, d.signal)
      errors = 0
      d.onUpdate(generation)
      if (generation.status === 'completed') return 'completed'
      if (generation.status === 'failed') return 'failed'
    } catch (e) {
      if (d.signal.aborted) return 'cancelled'
      if ((e as { code?: string })?.code === 'byok_key_missing') return 'key_gone'
      if (++errors >= maxErrors) return 'lost'
    }
  }
}
