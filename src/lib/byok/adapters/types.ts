import type { AspectRatio } from '@/lib/engine/types'
import type { ByokProviderId, DiscoveredModel } from '../catalog'
import type { Policy } from '../http'

/** A key as held for the length of one request. Never stored, never returned. */
export interface Credential {
  providerId: ByokProviderId
  apiKey: string
}

export interface ImageJob {
  model: string
  prompt: string
  aspectRatio: AspectRatio
  quality: 'standard' | 'high'
}

export interface ImageArtifact {
  bytes: Uint8Array
  mime: 'image/png' | 'image/jpeg' | 'image/webp'
  ext: 'png' | 'jpg' | 'webp'
  width: number
  height: number
}

/** A first frame for image-to-video: bytes for providers that take inline data, a URL for those that fetch. */
export interface FirstFrame { bytes: Uint8Array; mime: string; url: string }

export interface VideoJob {
  model: string
  prompt: string
  aspectRatio: AspectRatio
  durationS: number
  firstFrame?: FirstFrame
}

export type VideoStatus =
  | { state: 'pending'; progress?: number }
  | { state: 'completed' }
  | { state: 'failed'; code: 'byok_job_failed' | 'byok_job_expired' | 'byok_blocked' | 'byok_no_credit' | 'byok_unsupported' }

/**
 * One provider. Every connectable provider implements discovery; generation
 * operations exist only where Slate has a real implementation of the
 * provider's documented API.
 *
 * `listModels` is the connection test: authenticated, free, and never
 * generates anything.
 */
export interface ByokAdapter {
  id: ByokProviderId
  listModels(cred: Credential, policy: Policy): Promise<DiscoveredModel[]>
  generateImage?(cred: Credential, job: ImageJob, policy: Policy): Promise<ImageArtifact>
  video?: {
    /** Submit once. Returns the provider's job handle. Never retried. */
    submit(cred: Credential, job: VideoJob, policy: Policy): Promise<string>
    status(cred: Credential, handle: string, policy: Policy): Promise<VideoStatus>
    download(cred: Credential, handle: string, policy: Policy): Promise<Uint8Array>
    /** A handle this adapter could have issued; anything else is refused. */
    validHandle(handle: string): boolean
  }
}
