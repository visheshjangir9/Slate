'use client'

import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'
const subscribe = (fn: () => void) => {
  const m = matchMedia(QUERY)
  m.addEventListener('change', fn)
  return () => m.removeEventListener('change', fn)
}

/** The viewer's reduced-motion preference. False on the server. */
export const useReducedMotion = () =>
  useSyncExternalStore(subscribe, () => matchMedia(QUERY).matches, () => false)
