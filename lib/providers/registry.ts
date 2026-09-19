import { cinematicProvider } from './cinematic'
import { ltxvProvider } from './ltxv'
import type { GenerationProvider, ModelDescriptor } from './types'

// LTX first: it is the real generative video model when configured.
const PROVIDERS: GenerationProvider[] = [ltxvProvider, cinematicProvider]

export const DEFAULT_PROVIDER_ID = 'cinematic'

/** Providers that this environment can actually run. */
export const availableProviders = (): GenerationProvider[] =>
  PROVIDERS.filter((p) => p.capabilities.configured)

/**
 * Resolve a provider, falling through to the free engine when the requested one
 * is missing or unconfigured. A missing API key degrades the product; it never
 * breaks it.
 */
export function getProvider(id?: string | null): GenerationProvider {
  const found = PROVIDERS.find((p) => p.capabilities.id === id)
  if (found?.capabilities.configured) return found
  return cinematicProvider
}

export function listModels(): ModelDescriptor[] {
  return PROVIDERS.flatMap((p) =>
    p.models().map((m) => ({
      ...m,
      available: m.available && p.capabilities.configured,
      unavailableReason: p.capabilities.configured
        ? m.unavailableReason
        : `${p.capabilities.label} is not configured in this environment`,
    })),
  )
}

/**
 * The provider that genuinely owns this model, configured or not.
 *
 * Deliberately does NOT fall through to the default: silently rendering on a
 * different engine than the user picked would misreport which provider made
 * the result. Callers check `available` and reject instead.
 */
export function providerForModel(modelId: string): GenerationProvider {
  return PROVIDERS.find((p) => p.models().some((m) => m.id === modelId)) ?? cinematicProvider
}

/** A model is usable only when its own provider is configured here. */
export function modelIsAvailable(modelId: string): boolean {
  const owner = PROVIDERS.find((p) => p.models().some((m) => m.id === modelId))
  return Boolean(owner?.capabilities.configured)
}

export const isKnownModel = (modelId: string): boolean =>
  PROVIDERS.some((p) => p.models().some((m) => m.id === modelId))
