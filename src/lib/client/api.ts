import type { Generation } from '@/lib/generation/types'
import type { DiscoveredModel } from '@/lib/byok/catalog'
import type { ModelDescriptor } from '@/lib/providers/types'
import type { AspectRatio, Bitrate, MotionId, Resolution } from '@/lib/engine/types'

export interface Catalog {
  models: ModelDescriptor[]
  motions: { id: MotionId; label: string; description: string; badge?: 'TOP' | 'NEW' }[]
  settings: {
    aspectRatios: AspectRatio[]
    resolutions: Resolution[]
    bitrates: Bitrate[]
    duration: { min: number; max: number }
  }
  engines: { id: string; label: string; description: string; execution: string; sunsetAt: string | null }[]
  persistence: { durable: boolean; adapter: string }
}

export interface ApiErrorShape {
  code: string
  message: string
  fields?: Record<string, string>
}

export class ApiError extends Error {
  code: string
  fields?: Record<string, string>
  constructor(e: ApiErrorShape) {
    super(e.message)
    this.code = e.code
    this.fields = e.fields
  }
}

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(body?.error ?? { code: 'network', message: `Request failed (${res.status})` })
  }
  return body as T
}

export interface CreateInput {
  prompt: string
  referenceUrl?: string | null
  model: string
  motion: MotionId
  durationS: number
  aspectRatio: AspectRatio
  resolution: Resolution
  bitrate: Bitrate
  workflow?: 'video' | 'image' | 'motion'
}

export function uploadReference(file: File) {
  const form = new FormData()
  form.append('image', file)
  return fetch('/api/uploads/reference', { method: 'POST', body: form })
    .then(json<{ url: string; bytes: number }>)
}

export const getCatalog = () => fetch('/api/models').then(json<Catalog>)

export const listGenerations = (limit = 30) =>
  fetch(`/api/generations?limit=${limit}`).then(json<{ generations: Generation[]; nextCursor: string | null }>)

export const createGeneration = (input: CreateInput) =>
  fetch('/api/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }).then(json<{ generation: Generation; execution: string }>)

export const patchGeneration = (id: string, body: Record<string, unknown>) =>
  fetch(`/api/generations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(json<{ generation: Generation }>)

/** A user-key request body: sent only in the render or test request itself. */
export interface ByokRequestBody {
  credential: { providerId: string; apiKey: string }
}

/** Kick off a server-side render. Resolves when the server finishes the job. */
export const renderGeneration = (id: string, byok?: ByokRequestBody | null, signal?: AbortSignal) =>
  fetch(`/api/generations/${id}/render`, byok
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(byok), signal, cache: 'no-store' }
    : { method: 'POST', signal }).then(json<{ generation: Generation }>)

export type ByokTestResult =
  | { connected: true; models: DiscoveredModel[] }
  | { connected: false; error: { code: string; message: string } }

/**
 * Follow a provider video job once. The key travels in the body of this one
 * request and nowhere else.
 */
export const pollGeneration = (id: string, byok: ByokRequestBody, signal?: AbortSignal) =>
  fetch(`/api/generations/${id}/poll`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(byok), signal, cache: 'no-store',
  }).then(json<{ generation: Generation; done?: boolean }>)

/** One user-initiated connection test. Never called automatically. */
export const testByok = (body: ByokRequestBody) =>
  fetch('/api/byok/test', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store',
  }).then(json<ByokTestResult>)

export const getGeneration = (id: string) =>
  fetch(`/api/generations/${id}`).then(json<{ generation: Generation }>)

export const retryGeneration = (id: string) =>
  fetch(`/api/generations/${id}/retry`, { method: 'POST' }).then(
    json<{ generation: Generation; execution: string }>,
  )

export const deleteGeneration = (id: string) =>
  fetch(`/api/generations/${id}`, { method: 'DELETE' }).then(json<{ deleted: boolean }>)

export function uploadArtifact(id: string, video: Blob, poster: Blob | null) {
  const form = new FormData()
  const ext = video.type === 'video/mp4' ? 'mp4' : 'webm'
  form.append('video', video, `slate.${ext}`)
  if (poster) form.append('poster', poster, 'poster.jpg')
  return fetch(`/api/generations/${id}/artifact`, { method: 'POST', body: form }).then(
    json<{ generation: Generation }>,
  )
}

/** The still must come through our server: the upstream 403s browser origins. */
export function stillUrl(opts: {
  prompt: string
  width: number
  height: number
  seed: number
  model: string
}): string {
  const p = new URLSearchParams({
    prompt: opts.prompt,
    width: String(opts.width),
    height: String(opts.height),
    seed: String(opts.seed),
    model: opts.model,
  })
  return `/api/still?${p}`
}
