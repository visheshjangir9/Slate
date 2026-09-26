import type { GenerationProvider, GenerationRequest, ModelDescriptor, Negotiation } from './types'
import type { Adjustment } from '@/lib/generation/types'
import { IMAGE_MODEL_ID } from '@/lib/catalog'
import { gptImageConfigured } from '@/lib/images/gptImage'
import { gptNativeSize, imageOutputDims } from '@/lib/images/dims'

/**
 * GPT Image, run server-side, persisted like any other generation.
 *
 * Image rows share the generations table. Columns that only mean something
 * for video (motion, duration, resolution) are normalised to fixed values the
 * schema accepts and are never shown for an image; `kindOfModel` tells the UI
 * which fields apply.
 */
export const imageProvider: GenerationProvider = {
  capabilities: {
    id: 'gpt-image',
    label: 'GPT Image',
    description: 'OpenAI image generation, cropped to your aspect ratio.',
    execution: 'server',
    requiresKey: true,
    configured: gptImageConfigured(),
    durations: 'continuous',
    aspectRatios: 'all',
    resolutions: 'all',
    supportsReference: false,
  },
  models: (): ModelDescriptor[] => [
    {
      id: IMAGE_MODEL_ID,
      label: 'GPT Image 1',
      description: 'Prompt to image, cropped to the frame you choose.',
      providerId: 'gpt-image',
      kind: 'image',
      available: gptImageConfigured(),
      unavailableReason: gptImageConfigured() ? undefined : 'GPT Image is not configured in this environment',
    },
  ],
  negotiate(req: GenerationRequest): Negotiation {
    const adjustments: Adjustment[] = []
    const native = gptNativeSize(req.aspectRatio)
    const out = imageOutputDims(req.aspectRatio)
    if (native.width !== out.width || native.height !== out.height) {
      adjustments.push({
        field: 'size',
        requested: req.aspectRatio,
        actual: `${out.width}×${out.height}`,
        reason: `GPT Image renders ${native.width}×${native.height}; Slate centre-crops it to ${req.aspectRatio}`,
      })
    }
    return {
      normalized: { ...req, motion: 'static', durationS: 4, resolution: '1080p', referenceUrl: null },
      adjustments,
    }
  },
}
