import type { AspectRatio, Bitrate, MotionId, Resolution } from '@/lib/engine/types'

export const GENERATION_STATUSES = ['queued', 'generating', 'completed', 'failed'] as const
export type GenerationStatus = (typeof GENERATION_STATUSES)[number]

export const GENERATION_STAGES = ['image', 'render', 'encode', 'upload'] as const
export type GenerationStage = (typeof GENERATION_STAGES)[number]

export interface Generation {
  id: string
  deviceId: string
  prompt: string
  model: string
  motion: MotionId
  durationS: number
  aspectRatio: AspectRatio
  resolution: Resolution
  bitrate: Bitrate
  referenceUrl: string | null
  seed: number
  status: GenerationStatus
  stage: GenerationStage | null
  progress: number
  outputUrl: string | null
  posterUrl: string | null
  fileBytes: number | null
  errorCode: string | null
  errorMessage: string | null
  provider: string
  /** Set when a provider coerced a setting it could not honour exactly. */
  adjustments: Adjustment[]
  heartbeatAt: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
  /** Set when this job was created by retrying another. */
  retryOf: string | null
}

export interface Adjustment {
  field: string
  requested: string
  actual: string
  reason: string
}
