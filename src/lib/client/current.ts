'use client'

import { useSyncExternalStore } from 'react'
import type { Workflow } from '@/components/shell/nav'

/**
 * The CURRENT creation per workflow: what the big preview shows.
 *
 * Separate from history on purpose. History is everything you have made;
 * current is only what you are working on now. It lives in module memory, so
 * it survives moving between pages but not a reload: a fresh visit always
 * opens on the contextual preview, never on an old result. Clearing it never
 * touches the stored generation.
 */
type State = Record<Workflow, string | null>

let state: State = { video: null, image: null, motion: null }
const listeners = new Set<() => void>()

export const currentStore = {
  get: (): State => state,
  set(workflow: Workflow, id: string | null) {
    if (state[workflow] === id) return
    state = { ...state, [workflow]: id }
    listeners.forEach((l) => l())
  },
  /** Forget an id everywhere, e.g. after it is deleted. */
  forget(id: string) {
    const next = { ...state }
    let changed = false
    for (const k of Object.keys(next) as Workflow[]) {
      if (next[k] === id) { next[k] = null; changed = true }
    }
    if (changed) { state = next; listeners.forEach((l) => l()) }
  },
  subscribe(fn: () => void) {
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  },
}

const EMPTY: State = { video: null, image: null, motion: null }

export function useCurrent(workflow: Workflow): string | null {
  return useSyncExternalStore(currentStore.subscribe, () => state[workflow], () => EMPTY[workflow])
}
