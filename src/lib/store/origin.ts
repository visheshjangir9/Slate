import type { Adjustment, Workflow } from '@/lib/generation/types'

/**
 * Reserved markers kept in the generations table's `adjustments` JSON array,
 * for facts that have no column of their own:
 *
 *   __origin  which Studio workflow created the generation
 *   __job     the provider's job handle for an asynchronous render on the
 *             user's own provider (e.g. a Veo operation name). It is an
 *             identifier only, useless without the user's key, and never a
 *             credential.
 *
 * Markers are written and stripped only here, at the storage boundary: the
 * rest of the app sees plain `workflow` and `providerJob` fields and never
 * sees a marker. Moving either to a real column later changes this file and
 * nothing else.
 */
const ORIGIN = '__origin'
const JOB = '__job'
const RESERVED = new Set([ORIGIN, JOB])
const WORKFLOWS: Workflow[] = ['video', 'image', 'motion']

export interface Markers {
  workflow?: Workflow | null
  providerJob?: string | null
}

const marker = (field: string, value: string): Adjustment => ({ field, requested: value, actual: value, reason: '' })

/** User-visible adjustments plus the reserved markers, ready to store. */
export function withMarkers(adjustments: Adjustment[], m: Markers): Adjustment[] {
  const clean = adjustments.filter((a) => !RESERVED.has(a.field))
  if (m.workflow) clean.push(marker(ORIGIN, m.workflow))
  if (m.providerJob) clean.push(marker(JOB, m.providerJob))
  return clean
}

export function readMarkers(stored: Adjustment[] | null | undefined): { adjustments: Adjustment[]; workflow: Workflow | null; providerJob: string | null } {
  const all = stored ?? []
  const origin = all.find((a) => a.field === ORIGIN)
  const job = all.find((a) => a.field === JOB)
  return {
    adjustments: all.filter((a) => !RESERVED.has(a.field)),
    workflow: origin && (WORKFLOWS as string[]).includes(origin.actual) ? (origin.actual as Workflow) : null,
    providerJob: job?.actual || null,
  }
}

/* Back-compat for callers that only care about the workflow marker. */
export function withOrigin(adjustments: Adjustment[], workflow: Workflow | null | undefined): Adjustment[] {
  return withMarkers(adjustments, { workflow })
}

export function readOrigin(stored: Adjustment[] | null | undefined): { adjustments: Adjustment[]; workflow: Workflow | null } {
  const { adjustments, workflow } = readMarkers(stored)
  return { adjustments, workflow }
}
