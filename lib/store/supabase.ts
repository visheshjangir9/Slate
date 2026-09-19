import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Adjustment, Generation } from '@/lib/generation/types'
import { STALE_AFTER_MS, reduce } from '@/lib/generation/state'
import { OUTPUTS_BUCKET, supabaseEnv } from '@/lib/env'
import type {
  BlobStore, GenerationStore, ListOptions, ListResult, NewGeneration, StoredBlob,
} from './types'

/**
 * Single server-side client. The secret key bypasses row-level security, which
 * is why this module is `server-only` and why ownership is still enforced by
 * deviceId in every query below rather than being delegated to RLS.
 */
let client: SupabaseClient | null = null
export function supabase(): SupabaseClient {
  if (client) return client
  const { url, secretKey } = supabaseEnv()
  client = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return client
}

const TABLE = 'generations'

/** DB rows are snake_case; the domain model is camelCase. Mapped explicitly. */
interface Row {
  id: string
  device_id: string
  prompt: string
  model: string
  motion: string
  duration_s: number
  aspect_ratio: string
  resolution: string
  bitrate: string
  reference_url: string | null
  seed: number
  status: string
  stage: string | null
  progress: number
  output_url: string | null
  poster_url: string | null
  file_bytes: number | null
  error_code: string | null
  error_message: string | null
  provider: string
  adjustments: Adjustment[] | null
  retry_of: string | null
  heartbeat_at: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

const fromRow = (r: Row): Generation => ({
  id: r.id,
  deviceId: r.device_id,
  prompt: r.prompt,
  model: r.model,
  motion: r.motion as Generation['motion'],
  durationS: r.duration_s,
  aspectRatio: r.aspect_ratio as Generation['aspectRatio'],
  resolution: r.resolution as Generation['resolution'],
  bitrate: r.bitrate as Generation['bitrate'],
  referenceUrl: r.reference_url,
  seed: Number(r.seed),
  status: r.status as Generation['status'],
  stage: r.stage as Generation['stage'],
  progress: r.progress,
  outputUrl: r.output_url,
  posterUrl: r.poster_url,
  fileBytes: r.file_bytes === null ? null : Number(r.file_bytes),
  errorCode: r.error_code,
  errorMessage: r.error_message,
  provider: r.provider,
  adjustments: r.adjustments ?? [],
  retryOf: r.retry_of,
  heartbeatAt: r.heartbeat_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  completedAt: r.completed_at,
})

/** Only maps keys that are present, so PATCH semantics stay partial. */
function toRow(p: Partial<Generation>): Record<string, unknown> {
  const map: Array<[keyof Generation, string]> = [
    ['deviceId', 'device_id'], ['prompt', 'prompt'], ['model', 'model'], ['motion', 'motion'],
    ['durationS', 'duration_s'], ['aspectRatio', 'aspect_ratio'], ['resolution', 'resolution'],
    ['bitrate', 'bitrate'], ['referenceUrl', 'reference_url'], ['seed', 'seed'],
    ['status', 'status'], ['stage', 'stage'], ['progress', 'progress'],
    ['outputUrl', 'output_url'], ['posterUrl', 'poster_url'], ['fileBytes', 'file_bytes'],
    ['errorCode', 'error_code'], ['errorMessage', 'error_message'], ['provider', 'provider'],
    ['adjustments', 'adjustments'], ['retryOf', 'retry_of'], ['heartbeatAt', 'heartbeat_at'],
    ['createdAt', 'created_at'], ['updatedAt', 'updated_at'], ['completedAt', 'completed_at'],
  ]
  const out: Record<string, unknown> = {}
  for (const [k, col] of map) if (k in p) out[col] = p[k]
  return out
}

/** Errors must never carry the key or the full request URL. */
function boom(op: string, err: { message?: string } | null): never {
  const msg = (err?.message ?? 'unknown error').replace(/(apikey|Bearer)\s*\S+/gi, '[redacted]')
  throw new Error(`supabase ${op} failed: ${msg}`)
}

export class SupabaseGenerationStore implements GenerationStore {
  readonly name = 'supabase'
  readonly durable = true

  async create(input: NewGeneration): Promise<Generation> {
    const now = new Date().toISOString()
    const payload = {
      ...toRow(input as Partial<Generation>),
      ...(input.id ? { id: input.id } : {}),
      created_at: now,
      updated_at: now,
      completed_at: null,
      heartbeat_at: null,
    }
    const { data, error } = await supabase().from(TABLE).insert(payload).select().single()
    if (error || !data) boom('insert', error)
    return fromRow(data as Row)
  }

  async get(id: string): Promise<Generation | null> {
    const { data, error } = await supabase().from(TABLE).select('*').eq('id', id).maybeSingle()
    if (error) boom('select', error)
    return data ? fromRow(data as Row) : null
  }

  /**
   * Cursor is the created_at of the last row seen. Opaque to callers, and it
   * avoids the offset drift you get when new rows land mid-pagination.
   */
  async listByDevice(deviceId: string, opts: ListOptions): Promise<ListResult> {
    let q = supabase()
      .from(TABLE)
      .select('*')
      .eq('device_id', deviceId)
      .order('created_at', { ascending: false })
      .limit(opts.limit + 1)
    if (opts.cursor) q = q.lt('created_at', opts.cursor)

    const { data, error } = await q
    if (error) boom('list', error)

    const rows = (data ?? []) as Row[]
    const hasMore = rows.length > opts.limit
    const page = hasMore ? rows.slice(0, opts.limit) : rows
    return {
      items: page.map(fromRow),
      nextCursor: hasMore ? page[page.length - 1].created_at : null,
    }
  }

  async patch(id: string, patch: Partial<Generation>): Promise<Generation | null> {
    const row = toRow(patch)
    delete row.id
    const { data, error } = await supabase()
      .from(TABLE).update(row).eq('id', id).select().maybeSingle()
    if (error) boom('update', error)
    return data ? fromRow(data as Row) : null
  }

  async remove(id: string): Promise<boolean> {
    const { data, error } = await supabase().from(TABLE).delete().eq('id', id).select('id')
    if (error) boom('delete', error)
    return (data?.length ?? 0) > 0
  }

  async sweepStale(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - STALE_AFTER_MS).toISOString()
    // Two shapes are stale: a running job that stopped heart-beating, and one
    // that never started at all (no heartbeat), which is aged from creation.
    // Filtering on heartbeat_at alone left never-started rows stuck forever.
    const { data, error } = await supabase()
      .from(TABLE)
      .select('*')
      .in('status', ['queued', 'generating'])
      .or(`heartbeat_at.lt.${cutoff},and(heartbeat_at.is.null,created_at.lt.${cutoff})`)
    if (error) boom('sweep-select', error)

    let n = 0
    for (const raw of (data ?? []) as Row[]) {
      const gen = fromRow(raw)
      const r = reduce(gen, { type: 'sweep' }, now)
      if (!r.ok) continue
      const { error: upErr } = await supabase().from(TABLE).update(toRow(r.patch)).eq('id', gen.id)
      if (!upErr) n++
    }
    return n
  }
}

export class SupabaseBlobStore implements BlobStore {
  readonly name = 'supabase'
  readonly durable = true
  private bucket = OUTPUTS_BUCKET

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<string> {
    const body = new Blob([bytes as unknown as BlobPart], { type: contentType })
    const { error } = await supabase().storage
      .from(this.bucket)
      .upload(key, body, { contentType, upsert: true })
    if (error) boom('storage upload', error)
    const { data } = supabase().storage.from(this.bucket).getPublicUrl(key)
    return data.publicUrl
  }

  async get(key: string): Promise<StoredBlob | null> {
    const { data, error } = await supabase().storage.from(this.bucket).download(key)
    if (error || !data) return null
    return {
      bytes: new Uint8Array(await data.arrayBuffer()),
      contentType: data.type || 'application/octet-stream',
    }
  }

  async remove(key: string): Promise<void> {
    await supabase().storage.from(this.bucket).remove([key])
  }
}
