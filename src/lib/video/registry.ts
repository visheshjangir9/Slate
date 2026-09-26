import 'server-only'
import type { VideoProvider } from './types'

/**
 * Server-side video providers.
 *
 * Empty until a provider adapter is added. While empty, Create Video uses the
 * in-browser cinematic engine, which is why the product still works with no
 * video credentials at all.
 */
const PROVIDERS: VideoProvider[] = []

export const videoProviders = (): VideoProvider[] => PROVIDERS.filter((p) => p.configured())

export const primaryVideoProvider = (): VideoProvider | null => videoProviders()[0] ?? null

export const getVideoProvider = (id: string): VideoProvider | null =>
  videoProviders().find((p) => p.id === id) ?? null

export const hasServerVideo = (): boolean => videoProviders().length > 0
