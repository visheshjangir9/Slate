import 'server-only'

export interface StillRequest {
  prompt: string
  width: number
  height: number
  seed: number
  /**
   * 'low' for frames that a video model will animate anyway -- it halves the
   * wait and the whole render has to fit in one serverless invocation.
   * 'medium' for stills a user actually keeps.
   */
  quality?: 'low' | 'medium'
}

export interface StillResult {
  bytes: Uint8Array
  contentType: string
  provider: string
}

export type StillFailure = 'rate_limited' | 'unavailable' | 'unconfigured'

export interface ImageProvider {
  id: string
  /** False when this environment lacks the credentials it needs. */
  configured: () => boolean
  fetchStill: (req: StillRequest, signal: AbortSignal) => Promise<StillResult | StillFailure>
}
