'use client'

import { useSyncExternalStore } from 'react'

/**
 * Cookie consent: the visitor's choice about optional analytics.
 *
 * Essential storage (the session cookies, the device cookie and this choice
 * itself) is always on, because the site cannot work without it. Analytics
 * are optional and load only after an explicit "Accept all". The choice is
 * stored in localStorage under a version, so changing what analytics do can
 * ask again by bumping CONSENT_VERSION.
 */
export const CONSENT_KEY = 'slate_consent'
export const CONSENT_VERSION = 1

export interface Consent {
  v: number
  analytics: boolean
  /** ISO timestamp of the choice. */
  at: string
}

/** `unknown` on the server and before hydration; `null` means "not chosen yet". */
export type ConsentState = Consent | null | 'unknown'

let current: Consent | null = null
let loaded = false
let settingsOpen = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function parseConsent(raw: string | null): Consent | null {
  if (!raw) return null
  try {
    const c = JSON.parse(raw) as Partial<Consent>
    if (c.v !== CONSENT_VERSION || typeof c.analytics !== 'boolean' || typeof c.at !== 'string') return null
    return { v: c.v, analytics: c.analytics, at: c.at }
  } catch {
    return null
  }
}

function load() {
  if (loaded) return
  loaded = true
  try { current = parseConsent(window.localStorage.getItem(CONSENT_KEY)) } catch { current = null }
}

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function setConsent(analytics: boolean): void {
  current = { v: CONSENT_VERSION, analytics, at: new Date().toISOString() }
  settingsOpen = false
  // Private mode can refuse storage: the choice still holds for this page view.
  try { window.localStorage.setItem(CONSENT_KEY, JSON.stringify(current)) } catch { /* not persisted */ }
  emit()
}

/** Re-open the banner from "Cookie settings" so a choice can be changed. */
export function openCookieSettings(): void {
  settingsOpen = true
  emit()
}

export function useConsent(): ConsentState {
  return useSyncExternalStore<ConsentState>(subscribe, () => { load(); return current }, () => 'unknown')
}

export function useCookieSettingsOpen(): boolean {
  return useSyncExternalStore(subscribe, () => settingsOpen, () => false)
}
