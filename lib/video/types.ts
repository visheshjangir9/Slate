import 'server-only'
import type { AspectRatio, MotionId, Resolution } from '@/lib/engine/types'

export interface VideoJobRequest {
  prompt: string
  durationS: number
  aspectRatio: AspectRatio
  resolution: Resolution
  motion: MotionId
  seed: number
  /** Source frame for image-to-video providers. */
  imageUrl?: string | null
}

export type VideoJobState =
  | { status: 'queued'; progress?: number }
  | { status: 'running'; progress?: number }
  | { status: 'succeeded'; url: string }
  | { status: 'failed'; code: string; message: string }

export interface VideoProvider {
  id: string
  label: string
  /** False when this environment lacks credentials. Never throws. */
  configured: () => boolean
  /** True when the provider animates a supplied frame rather than pure text. */
  needsSourceImage: boolean
  /** Durations the provider genuinely supports, or 'continuous'. */
  durations: number[] | 'continuous'
  submit: (req: VideoJobRequest) => Promise<{ externalId: string }>
  poll: (externalId: string) => Promise<VideoJobState>
  /** Only implement when the provider genuinely supports remote cancellation. */
  cancel?: (externalId: string) => Promise<boolean>
}
