import 'server-only'
import { hasSupabaseEnv } from '@/lib/env'
import { MemoryBlobStore, MemoryGenerationStore } from './memory'
import { SupabaseBlobStore, SupabaseGenerationStore } from './supabase'
import type { BlobStore, GenerationStore } from './types'

/**
 * Adapter selection.
 *
 * Supabase whenever the environment provides it; the in-memory adapter only as
 * a test/local fallback. Tests force memory so the suite stays hermetic and
 * never depends on (or writes to) a live project.
 *
 * Route handlers only ever see the interface, so this is the single place that
 * knows which backend is in play.
 */
const shouldUseMemoryStore = (): boolean => {
  if (process.env.SLATE_STORE === 'memory') return true
  if (process.env.VITEST) return true
  return !hasSupabaseEnv()
}

const g = globalThis as typeof globalThis & {
  __slateGenerations?: GenerationStore
  __slateBlobs?: BlobStore
}

export function generationStore(): GenerationStore {
  g.__slateGenerations ??= shouldUseMemoryStore() ? new MemoryGenerationStore() : new SupabaseGenerationStore()
  return g.__slateGenerations
}

export function blobStore(): BlobStore {
  g.__slateBlobs ??= shouldUseMemoryStore() ? new MemoryBlobStore() : new SupabaseBlobStore()
  return g.__slateBlobs
}

/** Surfaced by /api/models so the UI can warn when history will not survive. */
export const persistenceIsDurable = (): boolean => generationStore().durable

/** Reported by /api/models for diagnostics. Never includes credentials. */
export const persistenceName = (): string => generationStore().name
