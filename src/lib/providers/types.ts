import type { Adjustment } from '@/lib/generation/types'
import type { AspectRatio, Bitrate, MotionId, Resolution } from '@/lib/engine/types'

export interface GenerationRequest {
  prompt: string
  model: string
  motion: MotionId
  durationS: number
  aspectRatio: AspectRatio
  resolution: Resolution
  bitrate: Bitrate
  seed: number
  referenceUrl?: string | null
}

export interface ProviderCapabilities {
  id: string
  label: string
  description: string
  /**
   * Where the pixels are produced. 'client' renders and encodes in the browser;
   * 'server' submits to a remote API and is polled. The job record and state
   * machine are identical either way -- only the executor differs.
   */
  execution: 'client' | 'server'
  requiresKey: boolean
  /** True when this environment actually has what the provider needs to run. */
  configured: boolean
  /** Allowed durations, or 'continuous' when any value in range works. */
  durations: number[] | 'continuous'
  aspectRatios: AspectRatio[] | 'all'
  resolutions: Resolution[] | 'all'
  supportsReference: boolean
  /** ISO date after which this provider stops working. Surfaced in the UI. */
  sunsetAt?: string
  estimatedCostUsd?: (req: GenerationRequest) => number
}

export interface Negotiation {
  normalized: GenerationRequest
  /** Every coercion is reported. A provider must never silently render something else. */
  adjustments: Adjustment[]
}

export interface ModelDescriptor {
  id: string
  label: string
  description: string
  providerId: string
  /** What the model produces. Absent means video. */
  kind?: 'video' | 'image'
  badge?: 'TOP' | 'NEW'
  available: boolean
  /** Reason shown when `available` is false. */
  unavailableReason?: string
}

export interface GenerationProvider {
  capabilities: ProviderCapabilities
  models(): ModelDescriptor[]
  /** Coerce a request into something this provider can actually render. */
  negotiate(req: GenerationRequest): Negotiation
}
