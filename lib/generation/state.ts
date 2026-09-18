import type { Generation, GenerationStage, GenerationStatus } from './types'

/**
 * Legal status transitions.
 *
 * `completed` and `failed` are terminal on purpose: retrying creates a NEW row
 * rather than resurrecting an old one, so history stays an honest record of
 * what actually happened rather than a mutable scoreboard.
 */
const ALLOWED: Record<GenerationStatus, readonly GenerationStatus[]> = {
  queued: ['generating', 'failed'],
  generating: ['completed', 'failed'],
  completed: [],
  failed: [],
}

/** A job that stops heart-beating for this long is presumed dead. */
export const STALE_AFTER_MS = 90_000
export const HEARTBEAT_INTERVAL_MS = 5_000

export const isTerminal = (s: GenerationStatus): boolean => ALLOWED[s].length === 0

export const canTransition = (from: GenerationStatus, to: GenerationStatus): boolean =>
  ALLOWED[from].includes(to)

export type GenerationEvent =
  | { type: 'start' }
  | { type: 'progress'; stage: GenerationStage; progress: number }
  | { type: 'complete'; outputUrl: string; posterUrl: string | null; fileBytes: number }
  | { type: 'fail'; code: string; message: string }
  | { type: 'sweep' }

export interface TransitionError {
  code: 'illegal_transition' | 'terminal' | 'not_running'
  message: string
}

export type TransitionResult =
  | { ok: true; patch: Partial<Generation> }
  | { ok: false; error: TransitionError }

const deny = (code: TransitionError['code'], message: string): TransitionResult => ({
  ok: false,
  error: { code, message },
})

/**
 * Pure reducer: given a job and an event, produce the patch to persist.
 *
 * Every write path in the API goes through here, so an illegal move is
 * impossible to perform by accident from a route handler.
 */
export function reduce(
  gen: Pick<Generation, 'status' | 'heartbeatAt'>,
  event: GenerationEvent,
  now: Date = new Date(),
): TransitionResult {
  const iso = now.toISOString()
  const base = { updatedAt: iso }

  if (isTerminal(gen.status) && event.type !== 'sweep') {
    return deny('terminal', `Job is already ${gen.status} and cannot change`)
  }

  switch (event.type) {
    case 'start': {
      if (!canTransition(gen.status, 'generating')) {
        return deny('illegal_transition', `Cannot start from ${gen.status}`)
      }
      return {
        ok: true,
        patch: { ...base, status: 'generating', stage: 'image', progress: 0, heartbeatAt: iso },
      }
    }

    case 'progress': {
      if (gen.status !== 'generating') {
        return deny('not_running', `Cannot report progress while ${gen.status}`)
      }
      return {
        ok: true,
        patch: { ...base, stage: event.stage, progress: event.progress, heartbeatAt: iso },
      }
    }

    case 'complete': {
      if (!canTransition(gen.status, 'completed')) {
        return deny('illegal_transition', `Cannot complete from ${gen.status}`)
      }
      return {
        ok: true,
        patch: {
          ...base,
          status: 'completed',
          stage: null,
          progress: 100,
          outputUrl: event.outputUrl,
          posterUrl: event.posterUrl,
          fileBytes: event.fileBytes,
          errorCode: null,
          errorMessage: null,
          completedAt: iso,
        },
      }
    }

    case 'fail': {
      if (!canTransition(gen.status, 'failed')) {
        return deny('illegal_transition', `Cannot fail from ${gen.status}`)
      }
      return {
        ok: true,
        patch: {
          ...base,
          status: 'failed',
          stage: null,
          errorCode: event.code,
          errorMessage: event.message,
          completedAt: iso,
        },
      }
    }

    case 'sweep': {
      // Only a non-terminal job that has stopped heart-beating may be swept.
      if (isTerminal(gen.status)) return deny('terminal', 'Already finished')
      if (!isStale(gen, now)) return deny('not_running', 'Job is still alive')
      return {
        ok: true,
        patch: {
          ...base,
          status: 'failed',
          stage: null,
          errorCode: 'client_disconnected',
          errorMessage: 'Rendering stopped, most likely because the tab was closed.',
          completedAt: iso,
        },
      }
    }
  }
}

export function isStale(
  gen: Pick<Generation, 'status' | 'heartbeatAt'>,
  now: Date = new Date(),
): boolean {
  if (isTerminal(gen.status)) return false
  if (!gen.heartbeatAt) return false
  return now.getTime() - new Date(gen.heartbeatAt).getTime() > STALE_AFTER_MS
}

/** Human-facing copy for known failure codes. Unknown codes fall back to the raw message. */
export const ERROR_COPY: Record<string, string> = {
  client_disconnected: 'Rendering stopped, most likely because the tab was closed.',
  still_unavailable: 'The image service did not respond. This usually clears on a retry.',
  still_rate_limited: 'The image service is rate limiting us. Wait a moment, then retry.',
  encode_failed: 'Your browser could not encode the video.',
  provider_unavailable: 'The generation engine is temporarily unreachable.',
  upload_failed: 'The finished video could not be saved.',
  cancelled: 'Generation was cancelled.',
}
