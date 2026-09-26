import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The Supabase adapters against a faithful in-memory fake of the query
 * builder and storage API. No network, no real project, no real key: this
 * checks the mapping (camelCase ↔ snake_case), ownership filters, cursor
 * paging, marker merging, the stale sweep and storage round trips.
 */
type Row = Record<string, unknown>
const db: { rows: Row[]; blobs: Map<string, { bytes: Uint8Array; type: string }>; calls: string[] } = { rows: [], blobs: new Map(), calls: [] }

function query(table: string) {
  let op: 'select' | 'insert' | 'update' | 'delete' = 'select'
  let payload: Row | null = null
  const filters: ((r: Row) => boolean)[] = []
  let order: { col: string; asc: boolean } | null = null
  let limit = Infinity
  let single: 'single' | 'maybe' | null = null
  db.calls.push(table)

  const run = () => {
    let hit = db.rows.filter((r) => filters.every((f) => f(r)))
    if (op === 'insert') {
      const row = { id: crypto.randomUUID(), ...payload }
      db.rows.push(row)
      hit = [row]
    } else if (op === 'update') {
      hit.forEach((r) => Object.assign(r, payload))
    } else if (op === 'delete') {
      db.rows = db.rows.filter((r) => !hit.includes(r))
    }
    if (order) hit = [...hit].sort((a, b) => String(a[order!.col]).localeCompare(String(b[order!.col])) * (order!.asc ? 1 : -1))
    hit = hit.slice(0, limit).map((r) => ({ ...r }))
    if (single) return { data: hit[0] ?? null, error: single === 'single' && !hit[0] ? { message: 'no rows' } : null }
    return { data: hit, error: null }
  }

  const b = {
    select: () => b,
    insert: (p: Row) => { op = 'insert'; payload = p; return b },
    update: (p: Row) => { op = 'update'; payload = p; return b },
    delete: () => { op = 'delete'; return b },
    eq: (c: string, v: unknown) => { filters.push((r) => r[c] === v); return b },
    lt: (c: string, v: string) => { filters.push((r) => String(r[c]) < v); return b },
    in: (c: string, vs: unknown[]) => { filters.push((r) => vs.includes(r[c])); return b },
    or: (expr: string) => {
      // heartbeat_at.lt.X,and(heartbeat_at.is.null,created_at.lt.X)
      const cutoff = expr.match(/heartbeat_at\.lt\.([^,]+)/)![1]
      filters.push((r) => (r.heartbeat_at ? String(r.heartbeat_at) < cutoff : String(r.created_at) < cutoff))
      return b
    },
    order: (col: string, o: { ascending: boolean }) => { order = { col, asc: o.ascending }; return b },
    limit: (n: number) => { limit = n; return b },
    single: () => { single = 'single'; return Promise.resolve(run()) },
    maybeSingle: () => { single = 'maybe'; return Promise.resolve(run()) },
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(run()).then(res, rej),
  }
  return b
}

const storage = (bucket: string) => ({
  upload: async (key: string, body: Uint8Array | Blob, o: { contentType: string }) => {
    const bytes = body instanceof Blob ? new Uint8Array(await body.arrayBuffer()) : body
    db.blobs.set(`${bucket}/${key}`, { bytes, type: o.contentType })
    return { error: null }
  },
  getPublicUrl: (key: string) => ({ data: { publicUrl: `https://test.supabase.co/storage/v1/object/public/${bucket}/${key}` } }),
  download: async (key: string) => {
    const b = db.blobs.get(`${bucket}/${key}`)
    return b ? { data: new Blob([b.bytes.slice().buffer], { type: b.type }), error: null } : { data: null, error: { message: 'not found' } }
  },
  remove: async (keys: string[]) => { keys.forEach((k) => db.blobs.delete(`${bucket}/${k}`)); return { error: null } },
})

const createClient = vi.fn(() => ({ from: query, storage: { from: storage } }))
vi.mock('@supabase/supabase-js', () => ({ createClient }))

process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SECRET_KEY = 'test-not-a-real-secret'
const { SupabaseBlobStore, SupabaseGenerationStore } = await import('@/lib/store/supabase')

const base = {
  deviceId: 'user:a', prompt: 'a red door', model: 'ltx-2-pro', motion: 'static' as const, durationS: 6,
  aspectRatio: '16:9' as const, resolution: '720p' as const, bitrate: 'standard' as const, referenceUrl: null, seed: 1,
  status: 'queued' as const, stage: null, progress: 0, outputUrl: null, posterUrl: null, fileBytes: null,
  errorCode: null, errorMessage: null, provider: 'ltxv', adjustments: [], retryOf: null, workflow: 'video' as const,
}

beforeEach(() => { db.rows = []; db.blobs.clear(); db.calls = [] })

describe('SupabaseGenerationStore', () => {
  const store = new SupabaseGenerationStore()

  it('creates with snake_case columns and reads back the domain model', async () => {
    const g = await store.create(base)
    expect(db.rows[0]).toMatchObject({ device_id: 'user:a', aspect_ratio: '16:9', duration_s: 6, status: 'queued' })
    expect(db.rows[0]).not.toHaveProperty('deviceId')
    expect(g).toMatchObject({ deviceId: 'user:a', aspectRatio: '16:9', durationS: 6, workflow: 'video' })
    expect(await store.get(g.id)).toMatchObject({ id: g.id, prompt: 'a red door' })
    expect(await store.get('missing')).toBeNull()
  })

  it('lists only the owner’s rows, newest first, with a working cursor', async () => {
    for (let i = 0; i < 5; i++) {
      const g = await store.create({ ...base, prompt: `p${i}` })
      db.rows.find((r) => r.id === g.id)!.created_at = `2026-01-0${i + 1}T00:00:00.000Z`
    }
    await store.create({ ...base, deviceId: 'user:b' })
    const p1 = await store.listByDevice('user:a', { limit: 2 })
    expect(p1.items.map((g) => g.prompt)).toEqual(['p4', 'p3'])
    expect(p1.nextCursor).toBe('2026-01-04T00:00:00.000Z')
    const p2 = await store.listByDevice('user:a', { limit: 2, cursor: p1.nextCursor! })
    expect(p2.items.map((g) => g.prompt)).toEqual(['p2', 'p1'])
    const p3 = await store.listByDevice('user:a', { limit: 2, cursor: p2.nextCursor! })
    expect(p3.items.map((g) => g.prompt)).toEqual(['p0'])
    expect(p3.nextCursor).toBeNull()
    expect((await store.listByDevice('user:b', { limit: 10 })).items).toHaveLength(1)
  })

  it('patching a job handle keeps the workflow marker, and the reverse', async () => {
    const g = await store.create(base)
    const a = await store.patch(g.id, { providerJob: 'op-1', status: 'generating' })
    expect(a).toMatchObject({ providerJob: 'op-1', workflow: 'video', status: 'generating' })
    const b = await store.patch(g.id, { providerJob: null })
    expect(b).toMatchObject({ providerJob: null, workflow: 'video' })
    expect(await store.patch('missing', { providerJob: 'x' })).toBeNull()
  })

  it('removes and reassigns ownership', async () => {
    const g = await store.create({ ...base, deviceId: 'device:anon' })
    expect(await store.reassignOwner('device:anon', 'user:a')).toBe(1)
    expect((await store.get(g.id))!.deviceId).toBe('user:a')
    expect(await store.reassignOwner('user:a', 'user:a')).toBe(0)
    expect(await store.remove(g.id)).toBe(true)
    expect(await store.remove(g.id)).toBe(false)
  })

  it('sweeps stale jobs (stopped heartbeat, or never started) and leaves live ones', async () => {
    const now = new Date('2026-01-01T12:00:00.000Z')
    const old = '2026-01-01T11:00:00.000Z'
    const fresh = '2026-01-01T11:59:50.000Z'
    const stuck = await store.create({ ...base, status: 'generating' })
    const never = await store.create(base)
    const live = await store.create({ ...base, status: 'generating' })
    const done = await store.create({ ...base, status: 'completed' })
    const set = (id: string, v: Row) => Object.assign(db.rows.find((r) => r.id === id)!, v)
    set(stuck.id, { heartbeat_at: old, created_at: old })
    set(never.id, { heartbeat_at: null, created_at: old })
    set(live.id, { heartbeat_at: fresh, created_at: old })
    set(done.id, { heartbeat_at: null, created_at: old })
    expect(await store.sweepStale(now)).toBe(2)
    expect((await store.get(stuck.id))!.status).toBe('failed')
    expect((await store.get(never.id))!.status).toBe('failed')
    expect((await store.get(live.id))!.status).toBe('generating')
    expect((await store.get(done.id))!.status).toBe('completed')
  })
})

describe('SupabaseBlobStore', () => {
  it('uploads, returns the public URL, reads back exact bytes, removes', async () => {
    const blobs = new SupabaseBlobStore()
    const bytes = new Uint8Array([1, 2, 3, 4])
    const url = await blobs.put('g1.mp4', bytes, 'video/mp4')
    expect(url).toBe('https://test.supabase.co/storage/v1/object/public/outputs/g1.mp4')
    const back = await blobs.get('g1.mp4')
    expect([...back!.bytes]).toEqual([1, 2, 3, 4])
    expect(back!.contentType).toBe('video/mp4')
    await blobs.remove('g1.mp4')
    expect(await blobs.get('g1.mp4')).toBeNull()
  })
})
