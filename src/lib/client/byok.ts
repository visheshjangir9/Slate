'use client'

import { useSyncExternalStore } from 'react'
import { parseByokModelId, type ByokProviderId, type DiscoveredModel, type ModelRuns } from '@/lib/byok/catalog'

/**
 * The active Bring-Your-Own-Key configuration for this browser tab.
 *
 * Lifetime is deliberately short:
 *   - memory only: never localStorage, sessionStorage, cookies or the URL,
 *     so a reload or a closed tab drops it and it has to be entered again;
 *   - bound to the signed-in user: auth.ts clears it the moment the session
 *     ends or changes to a different account, and signOut clears it first;
 *   - the key itself is NOT in the snapshot components subscribe to, so no
 *     component can render it. It leaves this module only as the body of a
 *     test or render request (credentialBody).
 */
export type { DiscoveredModel } from '@/lib/byok/catalog'

export interface ActiveByok {
  userId: string
  providerId: ByokProviderId
  /** The model chosen when saving, as discovered with this key. */
  model: string
  /** Everything the key can reach, with capabilities and what Slate can run. */
  models: DiscoveredModel[]
}

let active: ActiveByok | null = null
let secret: string | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export const byokStore = {
  subscribe(fn: () => void) {
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  },
  getSnapshot: (): ActiveByok | null => active,

  activate(config: ActiveByok, apiKey: string) {
    active = config
    secret = apiKey
    emit()
  },

  /** Switch to another model the active key already discovered. The key is untouched. */
  useModel(model: string) {
    if (!active || !active.models.some((m) => m.id === model)) return
    active = { ...active, model }
    emit()
  },

  clear() {
    if (!active && !secret) return
    active = null
    secret = null
    byokDraft.providerId = null
    emit()
  },

  /** Drop the configuration unless it belongs to this user. */
  keepOnlyFor(userId: string | null) {
    if (active && active.userId !== userId) this.clear()
  },

  /**
   * The request body for a render on this provider, or null when no key for
   * it is active. The only place the key leaves this module.
   */
  credentialBody(providerId: ByokProviderId) {
    if (!active || !secret || active.providerId !== providerId) return null
    // Reliability limits (timeout, retries) are the server's defaults, not a user setting.
    return { credential: { providerId, apiKey: secret } }
  },
}

/**
 * What Slate can run for a stored user-key model id: documented specs when the
 * provider documents them, otherwise what this tab's discovery returned.
 */
export function runsFor(modelId: string, active: ActiveByok | null): ModelRuns | null {
  const parsed = parseByokModelId(modelId)
  if (!parsed) return null
  if (parsed.runs) return parsed.runs
  if (!active || active.providerId !== parsed.providerId) return null
  return active.models.find((m) => m.id === parsed.model)?.runs ?? null
}

/**
 * What the user was configuring, kept while the form is closed or the page
 * changes, so closing and reopening never resets it. Only choices: never the
 * key, never discovered models (those belong to a key). Memory only.
 */
export const byokDraft: { providerId: ByokProviderId | null } = { providerId: null }

const SERVER: ActiveByok | null = null
export const useByok = (): ActiveByok | null =>
  useSyncExternalStore(byokStore.subscribe, byokStore.getSnapshot, () => SERVER)
