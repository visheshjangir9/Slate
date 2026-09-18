import type { Generation } from '@/lib/generation/types'
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
