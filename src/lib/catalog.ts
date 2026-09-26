/**
 * Model catalogue.
 *
 * Two kinds of entry, and the difference is the whole point:
 *
 *   live       integrated in this build. The id matches a provider model in
 *              lib/providers/registry.ts, so choosing it really generates.
 *   catalogue  shown for discovery only. Nothing in Slate can call it, so the
 *              UI never offers a Generate action for it.
 *
 *   configurable  not integrated natively, but its own provider has a Slate
 *              adapter (lib/byok): the user can run it on their provider key.
 *              Only that provider is offered; nothing runs until it connects.
 *
 * Catalogue summaries describe the category of model, not performance claims
 * we cannot verify.
 */
import { byokKind, byokLabel, byokProvider, type ByokProviderId, type Operation } from '@/lib/byok/catalog'

export type CatalogKind = 'video' | 'image' | 'edit' | 'motion-transfer'

export interface CatalogModel {
  id: string
  name: string
  maker: string
  kind: CatalogKind
  summary: string
  status: 'live' | 'configurable' | 'catalogue'
  /** For live models: which Studio workflow generates with it. */
  workflow?: 'video' | 'image' | 'motion'
  /** Live models only: the real capabilities, stated plainly. */
  facts?: string[]
  /**
   * Configurable models: the ONE provider and model family that genuinely
   * serve this model, and a hint to preselect it from the models the user's
   * key can reach. The list itself always comes from the provider.
   */
  byok?: { providerId: ByokProviderId; op: Operation; prefer: RegExp }
}

export const IMAGE_MODEL_ID = 'gpt-image-1'
export const CINEMATIC_MODEL_ID = 'slate-cinematic-1'
export const LTX_MODEL_ID = 'ltx-2-pro'

/** The Studio page that generates with a live model. */
export const studioHrefFor = (m: Pick<CatalogModel, 'workflow'>): string =>
  m.workflow === 'image' ? '/studio/image' : m.workflow === 'motion' ? '/studio/motion' : '/studio'

export const LIVE_MODELS: CatalogModel[] = [
  {
    id: CINEMATIC_MODEL_ID,
    name: 'Slate Cinematic 1',
    maker: 'Slate',
    kind: 'video',
    status: 'live',
    workflow: 'motion',
    summary: 'A generated frame driven by a real camera move, encoded as H.264 in your browser.',
    facts: ['15 camera moves', '4–30s', '480p–1080p', 'Your image or a generated one'],
  },
  {
    id: LTX_MODEL_ID,
    name: 'LTX-2 Pro',
    maker: 'Lightricks',
    kind: 'video',
    status: 'live',
    workflow: 'video',
    summary: 'Generative video: the model animates the scene itself rather than moving a camera over a still.',
    facts: ['4, 6 or 8s', 'Rendered server-side', 'Image-to-video'],
  },
  {
    id: IMAGE_MODEL_ID,
    name: 'GPT Image 1',
    maker: 'OpenAI',
    kind: 'image',
    status: 'live',
    workflow: 'image',
    summary: 'Prompt to image, cropped to the aspect ratio you choose and saved to your library.',
    facts: ['6 aspect ratios', 'Standard or High quality', 'JPEG output'],
  },
]

export const CATALOGUE_MODELS: CatalogModel[] = [
  { id: 'seedance-2-5', name: 'Seedance 2.5', maker: 'ByteDance', kind: 'video', status: 'catalogue', summary: 'Text- and image-to-video.' },
  { id: 'kling-3', name: 'Kling 3.0', maker: 'Kuaishou', kind: 'video', status: 'catalogue', summary: 'Text- and image-to-video with audio.' },
  { id: 'kling-3-motion', name: 'Kling 3.0 Motion Control', maker: 'Kuaishou', kind: 'motion-transfer', status: 'catalogue', summary: 'Transfers motion from a reference clip onto a character image.' },
  { id: 'kling-3-omni-edit', name: 'Kling 3.0 Omni Edit', maker: 'Kuaishou', kind: 'edit', status: 'catalogue', summary: 'Edits existing video from a text instruction.' },
  { id: 'veo-3-1', name: 'Veo 3.1', maker: 'Google', kind: 'video', status: 'configurable', summary: 'Text- and image-to-video. Runs on your own Google provider.',
    byok: { providerId: 'google', op: 'video', prefer: /^veo-3\.1-generate/ } },
  { id: 'gemini-omni-flash', name: 'Gemini Omni Flash', maker: 'Google', kind: 'video', status: 'catalogue', summary: 'Video generation and editing from mixed inputs.' },
  { id: 'sora-2', name: 'Sora 2', maker: 'OpenAI', kind: 'video', status: 'configurable', summary: 'Text-to-video. Runs on your own OpenAI provider.',
    byok: { providerId: 'openai', op: 'video', prefer: /^sora-2$/ } },
  { id: 'flux-3-video', name: 'FLUX.3 Video', maker: 'Black Forest Labs', kind: 'video', status: 'catalogue', summary: 'Text, image and video inputs to video.' },
  { id: 'minimax-h3', name: 'MiniMax H3', maker: 'MiniMax', kind: 'video', status: 'catalogue', summary: 'Video from text, keyframes or references.' },
  { id: 'wan-3', name: 'Wan 3.0', maker: 'Alibaba', kind: 'video', status: 'catalogue', summary: 'Video from text, keyframes or references.' },
  { id: 'grok-imagine-1-5', name: 'Grok Imagine 1.5', maker: 'xAI', kind: 'video', status: 'catalogue', summary: 'Text-to-video with synchronized audio.' },
  { id: 'nano-banana-pro', name: 'Nano Banana Pro', maker: 'Google', kind: 'image', status: 'configurable', summary: 'Image generation. Runs on your own Google provider.',
    byok: { providerId: 'google', op: 'image', prefer: /pro-image/ } },
  { id: 'seedream-5', name: 'Seedream 5', maker: 'ByteDance', kind: 'image', status: 'catalogue', summary: 'Text-to-image.' },
  { id: 'flux-2', name: 'FLUX 2', maker: 'Black Forest Labs', kind: 'image', status: 'catalogue', summary: 'Text-to-image.' },
]

export const ALL_MODELS: CatalogModel[] = [...LIVE_MODELS, ...CATALOGUE_MODELS]

/**
 * How a known model is recognised in a provider's own model listing: its id
 * and official variants, as providers publish them (e.g. "veo-3.1-generate-
 * preview" on Google, "google/veo-3.1" on OpenRouter). Matching only ever
 * selects among models the user's key actually returned.
 */
const MATCH: Record<string, RegExp> = {
  'seedance-2-5': /seedance[-_.]?v?2[-_.]5/i,
  'kling-3': /kling[-_.]?v?3(?:[-_.]0)?(?![0-9.])(?!.*(?:motion|edit))/i,
  'kling-3-motion': /kling[-_.]?v?3.*motion/i,
  'kling-3-omni-edit': /kling[-_.]?v?3.*(?:omni|edit)/i,
  'veo-3-1': /veo-3\.1/i,
  'gemini-omni-flash': /gemini[-_.].*omni.*flash/i,
  'sora-2': /(?:^|\/)sora-2(?:-[0-9]{4}-[0-9]{2}-[0-9]{2})?$/i,
  'flux-3-video': /flux[-_.]?3.*video/i,
  'minimax-h3': /minimax.*h-?3(?![0-9])/i,
  'wan-3': /(?:^|[/_-])wan[-_.]?v?3(?:[-_.]0)?(?![0-9.])/i,
  'grok-imagine-1-5': /grok[-_.]?imagine.*1[-_.]5/i,
  'nano-banana-pro': /gemini-3-pro-image|nano-banana-pro/i,
  'seedream-5': /seedream[-_.]?v?5(?![0-9])/i,
  'flux-2': /flux[-_.]?2(?![0-9.])/i,
}

/** The Slate workflow a known model would run in, or null when Slate has none for its kind. */
export const operationFor = (m: CatalogModel): Operation | null =>
  m.kind === 'video' ? 'video' : m.kind === 'image' ? 'image' : null

export interface TargetProviders {
  /** Providers with a Slate adapter that can genuinely serve this model. */
  providers: ByokProviderId[]
  /** Why nothing can, when nothing can. */
  reason?: string
}

/**
 * Which of Slate's providers could serve a known model:
 *   - its own provider, when Slate has an adapter for it (Veo → Google);
 *   - OpenRouter, a gateway that lists models from many makers: whether it
 *     actually offers this one is only known after discovery with the key.
 * Never a provider that does not offer the model (Nano Banana Pro is never
 * offered through OpenAI), and never anything for a kind of model Slate has
 * no workflow for.
 */
export function providersFor(m: CatalogModel): TargetProviders {
  const op = operationFor(m)
  if (!op) {
    return { providers: [], reason: `Slate has no ${KIND_LABEL[m.kind].toLowerCase()} workflow yet, so no provider can run it here.` }
  }
  const native = m.byok ? [m.byok.providerId] : []
  const gateway = byokProvider('openrouter')!.operations.includes(op) ? (['openrouter'] as ByokProviderId[]) : []
  return { providers: [...new Set([...native, ...gateway])] }
}

/** Does a provider model id (as the provider listed it) correspond to this known model? */
export const matchesKnownModel = (m: CatalogModel, providerModelId: string): boolean =>
  Boolean(MATCH[m.id]?.test(providerModelId))

export const KIND_LABEL: Record<CatalogKind, string> = {
  video: 'Video',
  image: 'Image',
  edit: 'Video edit',
  'motion-transfer': 'Motion transfer',
}

export const liveModel = (id: string): CatalogModel | undefined =>
  LIVE_MODELS.find((m) => m.id === id)

/** A readable name for any stored model id: Slate's own, a user-key model, or the raw id. */
export const modelName = (id: string): string => liveModel(id)?.name ?? byokLabel(id) ?? id

export const catalogueModel = (id: string): CatalogModel | undefined =>
  CATALOGUE_MODELS.find((m) => m.id === id)

/**
 * How a known model is described, everywhere it is listed. It never claims
 * native integration: a configurable model names the provider that serves
 * it; anything else is an invitation to bring a provider, not a promise.
 */
export function catalogueStatus(m: CatalogModel): string {
  if (m.status === 'live') return 'Live'
  if (m.status === 'configurable' && m.byok) return `Configure with ${byokProvider(m.byok.providerId)?.label ?? 'your provider'}`
  if (m.kind !== 'video' && m.kind !== 'image') return 'No Slate workflow yet'
  return 'Use with your own provider'
}

/** What a stored generation is, derived from the model that made it. */
export const kindOfModel = (modelId: string): 'video' | 'image' =>
  modelId === IMAGE_MODEL_ID || byokKind(modelId) === 'image' ? 'image' : 'video'
