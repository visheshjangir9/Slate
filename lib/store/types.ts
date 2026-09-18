import type { Generation } from '@/lib/generation/types'

export type NewGeneration = Omit<
  Generation,
  'id' | 'createdAt' | 'updatedAt' | 'completedAt' | 'heartbeatAt'
> & { id?: string }

export interface ListOptions {
  limit: number
  cursor?: string
}

export interface ListResult {
  items: Generation[]
  nextCursor: string | null
}

/**
 * Persistence boundary.
 *
 * Route handlers only ever see this interface, so swapping the in-memory
 * adapter for Supabase is a one-line change in the resolver rather than a
 * rewrite of every endpoint.
 */
export interface GenerationStore {
  readonly name: string
  readonly durable: boolean
  create(input: NewGeneration): Promise<Generation>
  get(id: string): Promise<Generation | null>
  listByDevice(deviceId: string, opts: ListOptions): Promise<ListResult>
  patch(id: string, patch: Partial<Generation>): Promise<Generation | null>
  remove(id: string): Promise<boolean>
  /** Fail any non-terminal job that has stopped heart-beating. Returns count swept. */
  sweepStale(now?: Date): Promise<number>
}

export interface StoredBlob {
  bytes: Uint8Array
  contentType: string
}

export interface BlobStore {
  readonly name: string
  readonly durable: boolean
  /** Returns the public URL the client should use. */
  put(key: string, bytes: Uint8Array, contentType: string): Promise<string>
  get(key: string): Promise<StoredBlob | null>
  remove(key: string): Promise<void>
}
