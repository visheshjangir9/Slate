'use client'

import { useSyncExternalStore } from 'react'
import { byokStore } from './byok'

/**
 * Client view of the session.
 *
 * The session itself lives in httpOnly cookies the browser cannot read; this
 * only mirrors what /api/auth/session reports so the shell can render
 * "Sign in" or the account menu. It holds no tokens.
 */
export interface SessionUser {
  id: string
  email: string
}

export interface AuthSnapshot {
  status: 'loading' | 'guest' | 'user'
  user: SessionUser | null
}

let snap: AuthSnapshot = { status: 'loading', user: null }
const listeners = new Set<() => void>()
let inflight: Promise<void> | null = null

const emit = (next: AuthSnapshot) => {
  snap = next
  // A provider key belongs to the account that entered it: signing out or
  // switching accounts drops it before anything else can read it.
  byokStore.keepOnlyFor(next.user?.id ?? null)
  listeners.forEach((l) => l())
}

function load(): Promise<void> {
  inflight ??= fetch('/api/auth/session', { cache: 'no-store' })
    .then((r) => r.json())
    .then((b: { user: SessionUser | null }) =>
      emit(b.user ? { status: 'user', user: b.user } : { status: 'guest', user: null }))
    .catch(() => emit({ status: 'guest', user: null }))
  return inflight
}

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  if (snap.status === 'loading') void load()
  return () => { listeners.delete(fn) }
}

const SERVER: AuthSnapshot = { status: 'loading', user: null }

export function useAuth(): AuthSnapshot {
  return useSyncExternalStore(subscribe, () => snap, () => SERVER)
}

export interface AuthError {
  code: string
  message: string
  fields?: Record<string, string>
}

async function post(path: string, body?: unknown): Promise<{ ok: true } | { ok: false; error: AuthError }> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: json?.error ?? { code: 'network', message: 'Something went wrong. Try again.' } }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: { code: 'network', message: 'Could not reach Slate. Check your connection.' } }
  }
}

export const signIn = (email: string, password: string) => post('/api/auth/login', { email, password })
export const signUp = (email: string, password: string) => post('/api/auth/signup', { email, password })

/**
 * Sign out, then hard-navigate to the public homepage. A full reload is
 * deliberate: it drops every in-memory view of the account's history, so
 * nothing belonging to one user can linger on screen for the next.
 */
export async function signOut(next = '/'): Promise<void> {
  // The key goes first, before the session: nothing after this point can use it.
  byokStore.clear()
  await post('/api/auth/logout')
  window.location.assign(next)
}

/** The signed-in user's id, if known. */
export const currentUserId = (): string | null => snap.user?.id ?? null
