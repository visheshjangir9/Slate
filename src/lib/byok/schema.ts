import { z } from 'zod'
import { BYOK_PROVIDERS, BYOK_SETTINGS_BOUNDS, DEFAULT_BYOK_SETTINGS, type ByokProviderId } from './catalog'

const providerIds = BYOK_PROVIDERS.map((p) => p.id) as [ByokProviderId, ...ByokProviderId[]]

/**
 * A user's credential, as it may arrive in a request body.
 *
 * No whitespace or control characters: the key goes into a request header, so
 * anything that could split a header is refused. Validation messages are
 * fixed and never include the submitted value.
 */
export const credentialSchema = z.object({
  providerId: z.enum(providerIds, { message: 'Choose a supported provider' }),
  apiKey: z.string()
    .min(8, 'Enter the full API key')
    .max(512, 'That does not look like an API key')
    .regex(/^[\x21-\x7e]+$/, 'That does not look like an API key'),
})

export const settingsSchema = z.object({
  timeoutS: z.coerce.number().int()
    .min(BYOK_SETTINGS_BOUNDS.timeoutS.min).max(BYOK_SETTINGS_BOUNDS.timeoutS.max)
    .default(DEFAULT_BYOK_SETTINGS.timeoutS),
  maxRetries: z.coerce.number().int()
    .min(BYOK_SETTINGS_BOUNDS.maxRetries.min).max(BYOK_SETTINGS_BOUNDS.maxRetries.max)
    .default(DEFAULT_BYOK_SETTINGS.maxRetries),
})

/** Body of POST /api/byok/test and of a BYOK render. */
export const byokBodySchema = z.object({
  credential: credentialSchema,
  settings: settingsSchema.default(DEFAULT_BYOK_SETTINGS),
})

export type CredentialInput = z.infer<typeof credentialSchema>
export type ByokBody = z.infer<typeof byokBodySchema>
