import 'server-only'

export interface StillRequest {
  prompt: string
  width: number
  height: number
  seed: number
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
