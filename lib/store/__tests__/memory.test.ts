import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryBlobStore, MemoryGenerationStore } from '../memory'
import { STALE_AFTER_MS } from '@/lib/generation/state'
import type { NewGeneration } from '../types'

const base = (deviceId = 'dev-1'): NewGeneration => ({
  deviceId,
  prompt: 'test prompt',
  model: 'slate-cinematic-1',
  motion: 'dolly_in',
  durationS: 4,
  aspectRatio: '16:9',
  resolution: '720p',
  bitrate: 'standard',
  referenceUrl: null,
  seed: 1,
  status: 'queued',
  stage: null,
  progress: 0,
  outputUrl: null,
  posterUrl: null,
  fileBytes: null,
  errorCode: null,
  errorMessage: null,
  provider: 'cinematic',
  adjustments: [],
  retryOf: null,
})

let store: MemoryGenerationStore
beforeEach(() => { store = new MemoryGenerationStore() })

describe('MemoryGenerationStore', () => {
  it('declares itself non-durable so callers cannot mistake it for a database', () => {
    expect(store.durable).toBe(false)
  })

  it('creates with an id and timestamps', async () => {
    const row = await store.create(base())
    expect(row.id).toMatch(/[0-9a-f-]{36}/)
    expect(row.createdAt).toBeTruthy()
    expect(row.completedAt).toBeNull()
  })

  it('returns copies, so callers cannot mutate stored state by reference', async () => {
    const row = await store.create(base())
    row.prompt = 'mutated'
    expect((await store.get(row.id))?.prompt).toBe('test prompt')
  })

  it('scopes history to a device', async () => {
    await store.create(base('dev-1'))
    await store.create(base('dev-2'))
    const mine = await store.listByDevice('dev-1', { limit: 10 })
    expect(mine.items).toHaveLength(1)
    expect(mine.items[0].deviceId).toBe('dev-1')
  })

  it('lists newest first', async () => {
    const a = await store.create(base())
    await new Promise((r) => setTimeout(r, 5))
    const b = await store.create(base())
    const list = await store.listByDevice('dev-1', { limit: 10 })
    expect(list.items[0].id).toBe(b.id)
    expect(list.items[1].id).toBe(a.id)
  })

  it('paginates with a cursor without repeating rows', async () => {
    for (let i = 0; i < 5; i++) {
      await store.create(base())
      await new Promise((r) => setTimeout(r, 2))
    }
    const p1 = await store.listByDevice('dev-1', { limit: 2 })
    expect(p1.items).toHaveLength(2)
    expect(p1.nextCursor).toBeTruthy()
    const p2 = await store.listByDevice('dev-1', { limit: 2, cursor: p1.nextCursor! })
    expect(p2.items).toHaveLength(2)
    const ids = new Set([...p1.items, ...p2.items].map((r) => r.id))
    expect(ids.size).toBe(4)
  })

  it('patches without letting the id be reassigned', async () => {
    const row = await store.create(base())
    const patched = await store.patch(row.id, { status: 'generating', id: 'hacked' } as never)
    expect(patched?.id).toBe(row.id)
    expect(patched?.status).toBe('generating')
  })

  it('returns null when patching or getting something absent', async () => {
    expect(await store.patch('nope', { progress: 1 })).toBeNull()
    expect(await store.get('nope')).toBeNull()
  })

  it('removes rows', async () => {
    const row = await store.create(base())
    expect(await store.remove(row.id)).toBe(true)
    expect(await store.get(row.id)).toBeNull()
    expect(await store.remove(row.id)).toBe(false)
  })

  it('sweeps only jobs that have genuinely gone silent', async () => {
    const stale = await store.create(base())
    await store.patch(stale.id, {
      status: 'generating',
      heartbeatAt: new Date(Date.now() - STALE_AFTER_MS - 5_000).toISOString(),
    })
    const alive = await store.create(base())
    await store.patch(alive.id, { status: 'generating', heartbeatAt: new Date().toISOString() })
    const done = await store.create(base())
    await store.patch(done.id, { status: 'completed' })

    expect(await store.sweepStale()).toBe(1)
    expect((await store.get(stale.id))?.status).toBe('failed')
    expect((await store.get(stale.id))?.errorCode).toBe('client_disconnected')
    expect((await store.get(alive.id))?.status).toBe('generating')
    expect((await store.get(done.id))?.status).toBe('completed')
  })
})

describe('MemoryBlobStore', () => {
  it('round-trips bytes and content type', async () => {
    const blobs = new MemoryBlobStore()
    const url = await blobs.put('a.mp4', new Uint8Array([1, 2, 3]), 'video/mp4')
    expect(url).toBe('/api/blob/a.mp4')
    const got = await blobs.get('a.mp4')
    expect(got?.contentType).toBe('video/mp4')
    expect(Array.from(got!.bytes)).toEqual([1, 2, 3])
  })

  it('encodes keys that need it', async () => {
    const blobs = new MemoryBlobStore()
    expect(await blobs.put('a b.mp4', new Uint8Array(1), 'video/mp4')).toBe('/api/blob/a%20b.mp4')
  })

  it('removes', async () => {
    const blobs = new MemoryBlobStore()
    await blobs.put('x', new Uint8Array(1), 'video/mp4')
    await blobs.remove('x')
    expect(await blobs.get('x')).toBeNull()
  })
})
