import 'server-only'
import { MemoryBlobStore, MemoryGenerationStore } from './memory'
import type { BlobStore, GenerationStore } from './types'

/**
 * Store resolution.
 *
 * Today this always returns the in-memory adapter. The Supabase adapter lands
 * here the moment credentials exist -- one branch, no route changes, because
 * every handler talks to the interface rather than to a database client.
 *
 * Module-level singletons so state survives across requests within a single
 * dev process.
 */
const g = globalThis as typeof globalThis & {
  __slateGenerations?: GenerationStore
  __slateBlobs?: BlobStore
}

export function generationStore(): GenerationStore {
  g.__slateGenerations ??= new MemoryGenerationStore()
  return g.__slateGenerations
}

export function blobStore(): BlobStore {
  g.__slateBlobs ??= new MemoryBlobStore()
  return g.__slateBlobs
}

/** Surfaced by /api/models so the UI can warn when history will not survive. */
export const persistenceIsDurable = (): boolean => generationStore().durable
