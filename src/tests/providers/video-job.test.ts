import { describe, expect, it, vi } from 'vitest'
import { followVideoJob, type FollowDeps } from '@/lib/client/videoJob'
import { ApiError } from '@/lib/client/api'
import type { Generation } from '@/lib/generation/types'
import { FAKE_GOOGLE_KEY } from '@/tests/fixtures'

const body = { credential: { providerId: 'google', apiKey: FAKE_GOOGLE_KEY } }
const gen = (status: Generation['status'], progress = 0) => ({ id: 'g1', status, progress } as Generation)

/** A deterministic clock: every sleep advances it; nothing waits for real. */
function harness(over: Partial<FollowDeps> & { replies?: (Generation | Error)[] } = {}) {
  let t = 0
  const replies = [...(over.replies ?? [])]
  const poll = vi.fn(async () => {
    const r = replies.shift()
    if (!r) throw new Error('no more replies')
    if (r instanceof Error) throw r
    return { generation: r }
  })
  const updates: Generation[] = []
  const deps: FollowDeps = {
    id: 'g1',
    credential: () => body,
    poll,
    onUpdate: (g) => updates.push(g),
    signal: new AbortController().signal,
    intervalMs: 8000,
    now: () => t,
    sleep: async (ms) => { t += ms },
    ...over,
  }
  return { deps, poll, updates, advance: (ms: number) => { t += ms } }
}

describe('following a provider video job', () => {
  it('polls until completed, one request at a time, reporting each update', async () => {
    const h = harness({ replies: [gen('generating', 10), gen('generating', 60), gen('completed', 100)] })
    expect(await followVideoJob(h.deps)).toBe('completed')
    expect(h.poll).toHaveBeenCalledTimes(3)
    expect(h.updates.map((u) => u.progress)).toEqual([10, 60, 100])
  })

  it('stops on failure', async () => {
    const h = harness({ replies: [gen('generating'), gen('failed')] })
    expect(await followVideoJob(h.deps)).toBe('failed')
    expect(h.poll).toHaveBeenCalledTimes(2)
  })

  it('stops the moment the key is gone (sign-out, reload, another account): no request without it', async () => {
    let key: typeof body | null = body
    const h = harness({ replies: [gen('generating'), gen('generating')], credential: () => key })
    h.poll.mockImplementationOnce(async () => { key = null; return { generation: gen('generating') } })
    expect(await followVideoJob(h.deps)).toBe('key_gone')
    expect(h.poll).toHaveBeenCalledTimes(1)
  })

  it('stops when the server says the key is missing', async () => {
    const h = harness({ replies: [new ApiError({ code: 'byok_key_missing', message: 'x' })] })
    expect(await followVideoJob(h.deps)).toBe('key_gone')
  })

  it('stops on cancel without another request', async () => {
    const ac = new AbortController()
    const h = harness({ replies: [gen('generating')], signal: ac.signal })
    h.poll.mockImplementationOnce(async () => { ac.abort(); return { generation: gen('generating') } })
    expect(await followVideoJob(h.deps)).toBe('cancelled')
    expect(h.poll).toHaveBeenCalledTimes(1)
  })

  it('has a hard deadline: polling is bounded however long the provider takes', async () => {
    const forever = Array.from({ length: 500 }, () => gen('generating'))
    const h = harness({ replies: forever, deadlineMs: 15 * 60_000 })
    expect(await followVideoJob(h.deps)).toBe('deadline')
    // 15 minutes at one poll per 8 seconds, never more.
    expect(h.poll.mock.calls.length).toBeLessThanOrEqual(Math.ceil((15 * 60_000) / 8000))
  })

  it('gives up after repeated network errors, but tolerates a passing one', async () => {
    const ok = harness({ replies: [new Error('net'), gen('completed')] })
    expect(await followVideoJob(ok.deps)).toBe('completed')
    const bad = harness({ replies: Array.from({ length: 10 }, () => new Error('net')), maxConsecutiveErrors: 5 })
    expect(await followVideoJob(bad.deps)).toBe('lost')
    expect(bad.poll).toHaveBeenCalledTimes(5)
  })

  it('only ever polls: it has no way to resubmit a generation', () => {
    const h = harness()
    expect(Object.keys(h.deps)).not.toContain('render')
    expect(Object.keys(h.deps)).not.toContain('submit')
  })
})
