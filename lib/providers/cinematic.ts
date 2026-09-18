import type { GenerationProvider, GenerationRequest, ModelDescriptor, Negotiation } from './types'

export const CINEMATIC_MODELS: ModelDescriptor[] = [
  {
    id: 'slate-cinematic-1',
    label: 'Slate Cinematic 1',
    description: 'Highest fidelity stills with full camera control. Best default.',
    providerId: 'cinematic',
    badge: 'TOP',
    available: true,
  },
  {
    id: 'slate-turbo',
    label: 'Slate Turbo',
    description: 'Roughly twice as fast, slightly softer detail. Good for iterating.',
    providerId: 'cinematic',
    badge: 'NEW',
    available: true,
  },
]

/** Image model passed through to the still service for each Slate model. */
export const STILL_MODEL: Record<string, string> = {
  'slate-cinematic-1': 'flux',
  'slate-turbo': 'turbo',
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
