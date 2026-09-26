import type { GenerationProvider, GenerationRequest, ModelDescriptor, Negotiation } from './types'
import { LTXV_DURATIONS, ltxvConfigured, nearestLtxvDuration } from '@/lib/video/ltxv'
import type { Adjustment } from '@/lib/generation/types'

export const LTXV_MODEL_ID = 'ltx-2-pro'

/**
 * LTX-2 Pro, run server-side.
 *
 * Declares only what the API genuinely supports. Durations are 4/6/8 because
 * LTX is synchronous and a 4s clip already takes ~26s -- longer requests do not
 * fit inside one serverless invocation, so offering them would be a setting the
 * product cannot honour.
 */
export const ltxvProvider: GenerationProvider = {
  capabilities: {
    id: 'ltxv',
    label: 'LTX-2 Pro',
    description: 'True generative video from Lightricks LTX-2.',
    execution: 'server',
    requiresKey: true,
    configured: ltxvConfigured(),
    durations: [...LTXV_DURATIONS],
    aspectRatios: 'all',
    resolutions: 'all',
    supportsReference: true,
  },
  models: (): ModelDescriptor[] => [
    {
      id: LTXV_MODEL_ID,
      label: 'LTX-2 Pro',
      description: 'Generative video with real motion, not a camera move over a still.',
      providerId: 'ltxv',
      badge: 'TOP',
      available: ltxvConfigured(),
      unavailableReason: ltxvConfigured() ? undefined : 'LTX is not configured in this environment',
    },
  ],
  negotiate(req: GenerationRequest): Negotiation {
    const adjustments: Adjustment[] = []
    const duration = nearestLtxvDuration(req.durationS)
    if (duration !== req.durationS) {
      adjustments.push({
        field: 'duration',
        requested: `${req.durationS}s`,
        actual: `${duration}s`,
        reason: 'LTX-2 renders 4, 6 or 8 second clips',
      })
    }
    return { normalized: { ...req, durationS: duration }, adjustments }
  },
}
