import { cinematicProvider } from './cinematic'
import type { GenerationProvider, ModelDescriptor } from './types'

const PROVIDERS: GenerationProvider[] = [cinematicProvider]

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

export function providerForModel(modelId: string): GenerationProvider {
  const owner = PROVIDERS.find((p) => p.models().some((m) => m.id === modelId))
  return getProvider(owner?.capabilities.id)
}

export const isKnownModel = (modelId: string): boolean =>
  PROVIDERS.some((p) => p.models().some((m) => m.id === modelId))
