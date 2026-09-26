import { describe, expect, it } from 'vitest'
import {
  STALE_AFTER_MS, canTransition, isStale, isTerminal, reduce,
} from '@/lib/generation/state'
import { GENERATION_STATUSES, type GenerationStatus } from '@/lib/generation/types'

const at = (status: GenerationStatus, heartbeatAt: string | null = null) => ({ status, heartbeatAt })
const NOW = new Date('2026-09-18T12:00:00.000Z')

describe('transition table', () => {
  it('marks exactly completed and failed as terminal', () => {
    expect(isTerminal('completed')).toBe(true)
    expect(isTerminal('failed')).toBe(true)
    expect(isTerminal('queued')).toBe(false)
    expect(isTerminal('generating')).toBe(false)
  })

  it('allows only the documented moves', () => {
    expect(canTransition('queued', 'generating')).toBe(true)
    expect(canTransition('queued', 'failed')).toBe(true)
    expect(canTransition('generating', 'completed')).toBe(true)
    expect(canTransition('generating', 'failed')).toBe(true)
  })

  it('forbids skipping straight from queued to completed', () => {
    expect(canTransition('queued', 'completed')).toBe(false)
  })

  it('lets nothing escape a terminal state', () => {
    for (const to of GENERATION_STATUSES) {
      expect(canTransition('completed', to)).toBe(false)
      expect(canTransition('failed', to)).toBe(false)
    }
  })
})

describe('reduce', () => {
  it('start moves queued -> generating and stamps a heartbeat', () => {
    const r = reduce(at('queued'), { type: 'start' }, NOW)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.patch.status).toBe('generating')
    expect(r.patch.stage).toBe('image')
    expect(r.patch.progress).toBe(0)
    expect(r.patch.heartbeatAt).toBe(NOW.toISOString())
  })

  it('refuses to start a job that is already running', () => {
    const r = reduce(at('generating'), { type: 'start' }, NOW)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe('illegal_transition')
  })

  it('accepts progress only while generating', () => {
    const good = reduce(at('generating'), { type: 'progress', stage: 'encode', progress: 40 }, NOW)
    expect(good.ok).toBe(true)
    const bad = reduce(at('queued'), { type: 'progress', stage: 'encode', progress: 40 }, NOW)
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.error.code).toBe('not_running')
  })

  it('progress refreshes the heartbeat', () => {
    const r = reduce(at('generating'), { type: 'progress', stage: 'render', progress: 10 }, NOW)
    if (!r.ok) throw new Error('expected ok')
    expect(r.patch.heartbeatAt).toBe(NOW.toISOString())
  })

  it('complete records the artifact and clears any earlier error', () => {
    const r = reduce(at('generating'), {
      type: 'complete', outputUrl: '/api/blob/x.mp4', posterUrl: null, fileBytes: 1234,
    }, NOW)
    if (!r.ok) throw new Error('expected ok')
    expect(r.patch.status).toBe('completed')
    expect(r.patch.progress).toBe(100)
    expect(r.patch.outputUrl).toBe('/api/blob/x.mp4')
    expect(r.patch.fileBytes).toBe(1234)
    expect(r.patch.errorCode).toBeNull()
    expect(r.patch.completedAt).toBe(NOW.toISOString())
  })

  it('fail records a machine code and a human message', () => {
    const r = reduce(at('generating'), { type: 'fail', code: 'encode_failed', message: 'nope' }, NOW)
    if (!r.ok) throw new Error('expected ok')
    expect(r.patch.status).toBe('failed')
    expect(r.patch.errorCode).toBe('encode_failed')
    expect(r.patch.errorMessage).toBe('nope')
  })

  it('rejects every event against a terminal job', () => {
    for (const status of ['completed', 'failed'] as const) {
      for (const ev of [
        { type: 'start' as const },
        { type: 'progress' as const, stage: 'encode' as const, progress: 1 },
        { type: 'complete' as const, outputUrl: 'u', posterUrl: null, fileBytes: 1 },
        { type: 'fail' as const, code: 'x', message: 'y' },
      ]) {
        const r = reduce(at(status), ev, NOW)
        expect(r.ok, `${status} + ${ev.type}`).toBe(false)
      }
    }
  })

  it('never lets a completed job be overwritten by a late failure', () => {
    // The exact race a slow client can cause: artifact lands, then an error
    // handler fires. The completed result must win.
    const r = reduce(at('completed'), { type: 'fail', code: 'late', message: 'too late' }, NOW)
    expect(r.ok).toBe(false)
  })
})

describe('staleness sweep', () => {
  const old = new Date(NOW.getTime() - STALE_AFTER_MS - 1000).toISOString()
  const fresh = new Date(NOW.getTime() - 1000).toISOString()

  it('treats a long-silent running job as stale', () => {
    expect(isStale(at('generating', old), NOW)).toBe(true)
  })

  it('leaves a recently beating job alone', () => {
    expect(isStale(at('generating', fresh), NOW)).toBe(false)
  })

  it('never considers a finished job stale', () => {
    expect(isStale(at('completed', old), NOW)).toBe(false)
    expect(isStale(at('failed', old), NOW)).toBe(false)
  })

  it('sweeps a job that never started, aged from creation', () => {
    // A tab that died between create and render leaves no heartbeat at all.
    // Without this the row sits in "queued" forever and reads as broken.
    expect(isStale({ ...at('queued', null), createdAt: old }, NOW)).toBe(true)
    expect(isStale({ ...at('queued', null), createdAt: fresh }, NOW)).toBe(false)
  })

  it('still ignores a job with neither heartbeat nor creation time', () => {
    expect(isStale(at('queued', null), NOW)).toBe(false)
  })

  it('sweeping produces a recoverable failure with a plain-language cause', () => {
    const r = reduce(at('generating', old), { type: 'sweep' }, NOW)
    if (!r.ok) throw new Error('expected ok')
    expect(r.patch.status).toBe('failed')
    expect(r.patch.errorCode).toBe('client_disconnected')
    expect(r.patch.errorMessage).toMatch(/tab was closed/i)
  })

  it('refuses to sweep a healthy job', () => {
    const r = reduce(at('generating', fresh), { type: 'sweep' }, NOW)
    expect(r.ok).toBe(false)
  })
})
