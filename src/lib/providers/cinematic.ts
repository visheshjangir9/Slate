import type { GenerationProvider, GenerationRequest, ModelDescriptor, Negotiation } from './types'

export const CINEMATIC_MODELS: ModelDescriptor[] = [
  {
    id: 'slate-cinematic-1',
    label: 'Slate Cinematic 1',
    description: 'A generated still driven by a real camera move. Renders in your browser.',
    providerId: 'cinematic',
    available: true,
  },
]

/**
 * Image model passed through to the still service.
 *
 * Only one entry, deliberately. A second "turbo" model was removed after
 * testing showed the upstream ignores the model parameter: flux and turbo
 * returned byte-identical files for the same seed, so the choice was cosmetic
 * and the "twice as fast" claim was unverifiable. A second model returns here
 * only when it is proven to produce different output.
 */
export const STILL_MODEL: Record<string, string> = {
  'slate-cinematic-1': 'flux',
}

/**
 * The shipped default. Real AI still, real eased camera move, real H.264 encode.
 *
 * It natively supports every setting the product exposes, so negotiate() never
 * has anything to coerce -- which is precisely why the settings feel honest
 * here and would not against a hosted video API with a fixed menu of sizes.
 */
export const cinematicProvider: GenerationProvider = {
  capabilities: {
    id: 'cinematic',
    label: 'Slate Cinematic Engine',
    description: 'AI still plus a real camera move, encoded in your browser.',
    execution: 'client',
    requiresKey: false,
    configured: true,
    durations: 'continuous',
    aspectRatios: 'all',
    resolutions: 'all',
    supportsReference: true,
  },
  models: () => CINEMATIC_MODELS,
  negotiate(req: GenerationRequest): Negotiation {
    return { normalized: req, adjustments: [] }
  },
}
