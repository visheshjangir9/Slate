import { z } from 'zod'
import {
  ASPECT_RATIOS, BITRATES, RESOLUTIONS, MAX_DURATION_S, MIN_DURATION_S,
} from '@/lib/engine/types'
import { MOTION_IDS } from '@/lib/engine/motion'

export const PROMPT_MIN = 3
export const PROMPT_MAX = 2000

/** The shape a client may submit. Anything outside this is rejected at the edge. */
export const createGenerationSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(PROMPT_MIN, `Prompt must be at least ${PROMPT_MIN} characters`)
    .max(PROMPT_MAX, `Prompt must be ${PROMPT_MAX} characters or fewer`),
  model: z.string().min(1),
  motion: z.enum(MOTION_IDS as [string, ...string[]]),
  durationS: z.coerce
    .number()
    .int('Duration must be a whole number of seconds')
    .min(MIN_DURATION_S)
    .max(MAX_DURATION_S),
  aspectRatio: z.enum(ASPECT_RATIOS),
  resolution: z.enum(RESOLUTIONS),
  bitrate: z.enum(BITRATES),
  referenceUrl: z.string().url().optional().nullable(),
  seed: z.coerce.number().int().min(0).max(2_147_483_647).optional(),
  /** Which Studio workflow is asking. Recorded so History can be per workflow. */
  workflow: z.enum(['video', 'image', 'motion']).optional(),
})

export type CreateGenerationInput = z.infer<typeof createGenerationSchema>

/** Client-reported progress during a client-executed render. */
export const progressSchema = z.object({
  stage: z.enum(['image', 'render', 'encode', 'upload']),
  progress: z.coerce.number().int().min(0).max(100),
})

export const failSchema = z.object({
  code: z.string().min(1).max(64),
  message: z.string().min(1).max(500),
})

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
})

export const stillQuerySchema = z.object({
  prompt: z.string().trim().min(PROMPT_MIN).max(PROMPT_MAX),
  width: z.coerce.number().int().min(64).max(2560),
  height: z.coerce.number().int().min(64).max(2560),
  seed: z.coerce.number().int().min(0).max(2_147_483_647).default(0),
})

export const randomSeed = (): number => Math.floor(Math.random() * 2_147_483_647)
