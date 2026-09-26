import 'server-only'
import type { ByokProviderId, ByokSettings, DiscoveredModel, ParsedByok } from './catalog'
import { ByokError } from './errors'
import type { Policy } from './http'
import { googleAdapter } from './adapters/google'
import { openaiAdapter } from './adapters/openai'
import { openrouterAdapter } from './adapters/openrouter'
import { anthropicAdapter, mistralAdapter } from './adapters/text'
import type { ByokAdapter, Credential, ImageArtifact, ImageJob, VideoJob, VideoStatus } from './adapters/types'

/**
 * The provider resolver. Routes call this; this calls exactly one adapter.
 * Adding a provider is one adapter file, one line here and one registry
 * entry; the routes and Studio do not change.
 */
const ADAPTERS: Record<ByokProviderId, ByokAdapter> = {
  google: googleAdapter,
  openai: openaiAdapter,
  openrouter: openrouterAdapter,
  anthropic: anthropicAdapter,
  mistral: mistralAdapter,
}

/** Providers with a real adapter. The UI must never offer one that is not here. */
export const ADAPTER_IDS = Object.keys(ADAPTERS) as ByokProviderId[]

const adapterFor = (id: ByokProviderId): ByokAdapter => {
  const a = ADAPTERS[id]
  if (!a) throw new ByokError('byok_unsupported')
  return a
}

const policyFrom = (s: ByokSettings, signal?: AbortSignal): Policy => ({ timeoutMs: s.timeoutS * 1000, maxRetries: s.maxRetries, signal })

/**
 * The connection test: authentication plus discovery, nothing else. It never
 * generates, and never retries more than once.
 */
export async function testConnection(cred: Credential, settings: ByokSettings): Promise<DiscoveredModel[]> {
  return adapterFor(cred.providerId).listModels(cred, {
    timeoutMs: Math.min(settings.timeoutS, 30) * 1000,
    maxRetries: Math.min(settings.maxRetries, 1),
  })
}

/** The credential must be for the provider the generation was created with. */
function assertMatch(cred: Credential, target: ParsedByok) {
  if (cred.providerId !== target.providerId) throw new ByokError('byok_key_missing')
}

export async function generateImage(
  cred: Credential, target: ParsedByok, job: Omit<ImageJob, 'model'>, settings: ByokSettings, signal?: AbortSignal,
): Promise<ImageArtifact> {
  assertMatch(cred, target)
  const adapter = adapterFor(cred.providerId)
  if (target.op !== 'image' || !adapter.generateImage) throw new ByokError('byok_capability_unavailable')
  const spec = target.runs?.image
  // Documented providers: only what the model documents. Gateways: the provider decides.
  if (spec && spec.aspectRatios.length && !spec.aspectRatios.includes(job.aspectRatio)) throw new ByokError('byok_unsupported')
  const quality = spec?.quality ? job.quality : 'standard'
  return adapter.generateImage(cred, { ...job, model: target.model, quality }, policyFrom(settings, signal))
}

export function videoAdapter(cred: Credential, target: ParsedByok) {
  assertMatch(cred, target)
  const v = adapterFor(cred.providerId).video
  if (target.op !== 'video' || !v) throw new ByokError('byok_capability_unavailable')
  return v
}

export async function submitVideo(
  cred: Credential, target: ParsedByok, job: Omit<VideoJob, 'model'>, settings: ByokSettings, signal?: AbortSignal,
): Promise<string> {
  const v = videoAdapter(cred, target)
  const spec = target.runs?.video
  if (spec) {
    if (!spec.aspectRatios.includes(job.aspectRatio)) throw new ByokError('byok_unsupported')
    if (!spec.durations.includes(job.durationS)) throw new ByokError('byok_unsupported')
    if (job.firstFrame && !spec.imageToVideo) throw new ByokError('byok_capability_unavailable')
  }
  return v.submit(cred, { ...job, model: target.model }, { ...policyFrom(settings, signal), maxRetries: 0 })
}

export async function videoStatus(cred: Credential, target: ParsedByok, handle: string, settings: ByokSettings): Promise<VideoStatus> {
  const v = videoAdapter(cred, target)
  if (!v.validHandle(handle)) throw new ByokError('byok_unsupported')
  // A status read is safe to repeat once; it costs the user nothing.
  return v.status(cred, handle, { timeoutMs: 30_000, maxRetries: Math.min(settings.maxRetries, 1) })
}

export async function downloadVideo(cred: Credential, target: ParsedByok, handle: string, signal?: AbortSignal): Promise<Uint8Array> {
  const v = videoAdapter(cred, target)
  if (!v.validHandle(handle)) throw new ByokError('byok_unsupported')
  return v.download(cred, handle, { timeoutMs: 180_000, maxRetries: 0, signal })
}
