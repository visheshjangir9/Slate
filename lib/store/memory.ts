import type { Generation } from '@/lib/generation/types'
import { isStale, reduce } from '@/lib/generation/state'
import type { BlobStore, GenerationStore, ListOptions, ListResult, NewGeneration, StoredBlob } from './types'

/**
 * In-memory adapter.
 *
 * Correct and fully tested, but explicitly NOT durable: serverless instances
 * do not share it and it dies with the process. It exists so the whole backend
 * can be built and tested before Supabase credentials arrive, and so tests
 * never need a live database.
 */
export class MemoryGenerationStore implements GenerationStore {
  readonly name = 'memory'
  readonly durable = false
  private rows = new Map<string, Generation>()

  async create(input: NewGeneration): Promise<Generation> {
    const now = new Date().toISOString()
    const row: Generation = {
      ...input,
      id: input.id ?? crypto.randomUUID(),
      heartbeatAt: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    }
    this.rows.set(row.id, row)
    return { ...row }
  }

  async get(id: string): Promise<Generation | null> {
    const r = this.rows.get(id)
    return r ? { ...r } : null
  }

  async listByDevice(deviceId: string, opts: ListOptions): Promise<ListResult> {
    const all = [...this.rows.values()]
      .filter((r) => r.deviceId === deviceId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))

    const start = opts.cursor ? all.findIndex((r) => r.id === opts.cursor) + 1 : 0
    const page = all.slice(start, start + opts.limit)
    const nextCursor = start + opts.limit < all.length ? page[page.length - 1]?.id ?? null : null
    return { items: page.map((r) => ({ ...r })), nextCursor }
  }

  async patch(id: string, patch: Partial<Generation>): Promise<Generation | null> {
    const cur = this.rows.get(id)
    if (!cur) return null
    const next = { ...cur, ...patch, id: cur.id }
    this.rows.set(id, next)
    return { ...next }
  }

  async remove(id: string): Promise<boolean> {
    return this.rows.delete(id)
  }

  async sweepStale(now: Date = new Date()): Promise<number> {
    let n = 0
    for (const row of this.rows.values()) {
      if (!isStale(row, now)) continue
      const r = reduce(row, { type: 'sweep' }, now)
      if (r.ok) {
        this.rows.set(row.id, { ...row, ...r.patch })
        n++
      }
    }
    return n
  }

  /** Test helper. Not part of the interface. */
  clear(): void {
    this.rows.clear()
  }
}

export class MemoryBlobStore implements BlobStore {
  readonly name = 'memory'
  readonly durable = false
  private blobs = new Map<string, StoredBlob>()

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<string> {
    this.blobs.set(key, { bytes, contentType })
    return `/api/blob/${encodeURIComponent(key)}`
  }

  async get(key: string): Promise<StoredBlob | null> {
    return this.blobs.get(key) ?? null
  }

  async remove(key: string): Promise<void> {
    this.blobs.delete(key)
  }

  clear(): void {
    this.blobs.clear()
  }
}
