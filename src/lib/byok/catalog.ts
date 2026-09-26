import type { AspectRatio } from '@/lib/engine/types'

/**
 * Bring Your Own AI: the provider registry.
 *
 *   Provider → adapter → authentication → model discovery → capabilities
 *   → what Slate can run → parameters that genuinely apply
 *
 * Three separate facts, never conflated:
 *   provider    can Slate talk to it with the user's key (a real adapter)?
 *   model       does that provider actually offer this model to this key?
 *   capability  can that model do the operation being asked of it?
 *
 * Models are never listed here: they come from the provider's own listing,
 * with the user's key. Capabilities come from the provider's metadata where
 * it publishes them (Google, Anthropic, Mistral, OpenRouter) and from the
 * provider's documented model families where it does not (OpenAI). What
 * Slate can *run* is narrower: an operation the adapter implements, with the
 * parameters that model documents.
 *
 * No secrets and no request code live here, so UI and server both read it.
 */

export type Capability =
  | 'textToText' | 'textToImage' | 'imageToImage' | 'textToVideo' | 'imageToVideo'
  | 'videoToVideo' | 'speechToText' | 'textToSpeech' | 'imageUnderstanding'

export const CAPABILITY_LABEL: Record<Capability, string> = {
  textToText: 'Text',
  textToImage: 'Text → image',
  imageToImage: 'Image → image',
  textToVideo: 'Text → video',
  imageToVideo: 'Image → video',
  videoToVideo: 'Video → video',
  speechToText: 'Speech → text',
  textToSpeech: 'Text → speech',
  imageUnderstanding: 'Image understanding',
}

export const ALL_CAPABILITIES = Object.keys(CAPABILITY_LABEL) as Capability[]

/** What Slate can run on a user's provider: its image and video workflows. */
export type Operation = 'image' | 'video'

export interface ImageSpec {
  aspectRatios: AspectRatio[]
  /** The model takes a quality tier (standard / high). */
  quality: boolean
  output: string
}

export interface VideoSpec {
  aspectRatios: AspectRatio[]
  /** Seconds the provider documents for this model. */
  durations: number[]
  /** Slate can send a first frame for this model. */
  imageToVideo: boolean
  /** The provider reports real progress while rendering. */
  progress: boolean
}

export interface ModelRuns { image?: ImageSpec; video?: VideoSpec }

/** One model, as discovered with the user's key. Never contains the key. */
export interface DiscoveredModel {
  id: string
  label: string
  capabilities: Capability[]
  runs: ModelRuns
}

export type ByokProviderId = 'google' | 'openai' | 'openrouter' | 'anthropic' | 'mistral'

export interface ByokProvider {
  id: ByokProviderId
  label: string
  keyHelp: string
  keyUrl: string
  /** The most Slate can run through this adapter. Empty: connect and discover only. */
  operations: Operation[]
  /** Shape of this provider's model ids; anything else is refused. */
  modelPattern: RegExp
  /**
   * What Slate can run for a model id without asking the provider, from the
   * provider's own documentation. Null when only discovery can say
   * (OpenRouter: the user's gateway decides).
   */
  staticRuns: ((model: string) => ModelRuns | null) | null
}

const ALL_RATIOS: AspectRatio[] = ['21:9', '16:9', '4:3', '1:1', '4:5', '9:16']
const PLAIN_ID = /^[a-z0-9][a-z0-9.-]{1,80}$/

/** Google Gemini API, per ai.google.dev (Veo: predictLongRunning; image: generateContent). */
function googleRuns(model: string): ModelRuns | null {
  if (/^veo-/.test(model)) {
    // Veo 3.1 family: "4" | "6" | "8" seconds; earlier Veo: 8 only. Ratios: 16:9, 9:16.
    return { video: { aspectRatios: ['16:9', '9:16'], durations: /^veo-3\.1/.test(model) ? [4, 6, 8] : [8], imageToVideo: true, progress: false } }
  }
  if (/^gemini-[a-z0-9.-]*image[a-z0-9.-]*$/.test(model)) {
    return { image: { aspectRatios: ALL_RATIOS, quality: false, output: 'PNG' } }
  }
  return null
}

/** OpenAI API: GPT Image via /v1/images/generations, Sora via /v1/videos. */
function openaiRuns(model: string): ModelRuns | null {
  if (/^gpt-image-[a-z0-9.-]+$/.test(model)) return { image: { aspectRatios: ALL_RATIOS, quality: true, output: 'JPEG' } }
  // Sizes 1280x720 / 720x1280; seconds "4" | "8" | "12"; status reports progress.
  // Image-to-video is not enabled here: Sora requires the reference to match
  // the output size exactly, which Slate does not yet prepare.
  if (/^sora-[a-z0-9.-]+$/.test(model)) return { video: { aspectRatios: ['16:9', '9:16'], durations: [4, 8, 12], imageToVideo: false, progress: true } }
  return null
}

export const BYOK_PROVIDERS: ByokProvider[] = [
  {
    id: 'google', label: 'Google',
    keyHelp: 'A Gemini API key from Google AI Studio.', keyUrl: 'https://aistudio.google.com/apikey',
    operations: ['image', 'video'], modelPattern: PLAIN_ID, staticRuns: googleRuns,
  },
  {
    id: 'openai', label: 'OpenAI',
    keyHelp: 'An API key from the OpenAI platform.', keyUrl: 'https://platform.openai.com/api-keys',
    operations: ['image', 'video'], modelPattern: PLAIN_ID, staticRuns: openaiRuns,
  },
  {
    id: 'openrouter', label: 'OpenRouter',
    keyHelp: 'An API key from OpenRouter.', keyUrl: 'https://openrouter.ai/keys',
    operations: ['image', 'video'],
    modelPattern: /^[a-z0-9][a-z0-9._-]{0,60}\/[a-z0-9][a-z0-9._:-]{0,120}$/i,
    staticRuns: null,
  },
  {
    id: 'anthropic', label: 'Anthropic',
    keyHelp: 'An API key from the Claude console.', keyUrl: 'https://platform.claude.com/settings/keys',
    operations: [], modelPattern: PLAIN_ID, staticRuns: () => null,
  },
  {
    id: 'mistral', label: 'Mistral',
    keyHelp: 'An API key from Mistral La Plateforme.', keyUrl: 'https://console.mistral.ai/api-keys',
    operations: [], modelPattern: PLAIN_ID, staticRuns: () => null,
  },
]

export const byokProvider = (id: string): ByokProvider | undefined => BYOK_PROVIDERS.find((p) => p.id === id)

/** In words, what a provider can do inside Slate today. */
export function providerSummary(p: ByokProvider): string {
  if (!p.operations.length) return 'Text models. Not usable in Slate’s image and video workflows yet.'
  if (p.staticRuns === null) return 'Image and video, depending on the model you choose.'
  return (['video', 'image'] as const).filter((o) => p.operations.includes(o)).map((o) => (o === 'video' ? 'Video' : 'Image')).join(' · ')
}

/**
 * Only providers backed by a real adapter are ever shown. Local runtimes and
 * custom endpoints are deliberately absent: a hosted Slate cannot safely
 * reach a model on the user's machine, and arbitrary endpoints would let a
 * request make the server call any address.
 */
export const NOT_OFFERED_NOTE =
  'Local models (Ollama) and custom OpenAI-compatible endpoints are not offered: a hosted Slate cannot safely reach a model on your machine, and custom endpoints would let a request make the server call any address.'

/* ------------------------------------------------------------------ */
/* Stored model ids                                                    */
/* ------------------------------------------------------------------ */

/**
 * A generation on the user's own provider records
 *   model:    byok:<provider>:<operation>:<provider model id>
 *   provider: byok:<provider>
 * Enough to show, filter and validate it; nothing that could call the provider.
 */
const PREFIX = 'byok:'

export const byokModelId = (providerId: ByokProviderId, op: Operation, model: string) => `${PREFIX}${providerId}:${op}:${model}`
export const byokProviderTag = (providerId: ByokProviderId) => `${PREFIX}${providerId}`
export const isByokModelId = (id: string) => id.startsWith(PREFIX)
export const isByokProviderTag = (tag: string) => tag.startsWith(PREFIX)

export interface ParsedByok {
  providerId: ByokProviderId
  op: Operation
  model: string
  /** From the provider's documentation when known; null when only the provider can say. */
  runs: ModelRuns | null
}

export function parseByokModelId(id: string): ParsedByok | null {
  if (!isByokModelId(id)) return null
  const [providerId, op, ...rest] = id.slice(PREFIX.length).split(':')
  const model = rest.join(':')
  const p = byokProvider(providerId)
  if (!p || (op !== 'image' && op !== 'video') || !p.operations.includes(op)) return null
  if (!p.modelPattern.test(model)) return null
  if (p.staticRuns) {
    const runs = p.staticRuns(model)
    // A documented provider must document this operation for this model.
    if (!runs?.[op]) return null
    return { providerId: p.id, op, model, runs }
  }
  return { providerId: p.id, op, model, runs: null }
}

export const byokKind = (id: string): Operation | null => parseByokModelId(id)?.op ?? null

export function byokLabel(id: string): string | null {
  const parsed = parseByokModelId(id)
  if (!parsed) return null
  return `${parsed.model} · your ${byokProvider(parsed.providerId)!.label} account`
}

/* ------------------------------------------------------------------ */
/* Internal request policy                                              */
/* ------------------------------------------------------------------ */

/** Reliability limits for the adapters' HTTP layer. Internal; never shown to users. */
export interface ByokSettings { timeoutS: number; maxRetries: number }

export const BYOK_SETTINGS_BOUNDS = {
  timeoutS: { min: 15, max: 240, default: 120 },
  maxRetries: { min: 0, max: 2, default: 1 },
} as const

export const DEFAULT_BYOK_SETTINGS: ByokSettings = {
  timeoutS: BYOK_SETTINGS_BOUNDS.timeoutS.default,
  maxRetries: BYOK_SETTINGS_BOUNDS.maxRetries.default,
}
