import { describe, expect, it } from 'vitest'
import { DEFAULT_PROVIDER_ID, availableProviders, getProvider, isKnownModel, listModels, providerForModel } from '../registry'
import { cinematicProvider } from '../cinematic'
import { ASPECT_RATIOS, RESOLUTIONS } from '@/lib/engine/types'

describe('registry', () => {
  it('always has at least one configured provider, so the product cannot be keyless-broken', () => {
    expect(availableProviders().length).toBeGreaterThan(0)
  })

  it('falls through to the free engine for unknown or unconfigured ids', () => {
    expect(getProvider('does-not-exist').capabilities.id).toBe(DEFAULT_PROVIDER_ID)
    expect(getProvider(null).capabilities.id).toBe(DEFAULT_PROVIDER_ID)
    expect(getProvider(undefined).capabilities.id).toBe(DEFAULT_PROVIDER_ID)
  })

  it('maps every listed model back to a provider', () => {
    for (const m of listModels()) {
      expect(providerForModel(m.id).capabilities.id).toBe(m.providerId)
    }
  })

  it('recognises its own models and rejects others', () => {
    expect(isKnownModel('slate-cinematic-1')).toBe(true)
    expect(isKnownModel('sora-2')).toBe(false)
  })

  it('exposes models with the metadata the selector needs', () => {
    const models = listModels()
    expect(models.length).toBeGreaterThan(0)
    for (const m of models) {
      expect(m.label.length).toBeGreaterThan(0)
      expect(m.description.length).toBeGreaterThan(0)
      expect(typeof m.available).toBe('boolean')
    }
    expect(models.some((m) => m.badge === 'TOP')).toBe(true)
  })
})

describe('cinematic provider', () => {
  const req = {
    prompt: 'p', model: 'slate-cinematic-1', motion: 'dolly_in' as const,
    durationS: 12, aspectRatio: '21:9' as const, resolution: '1080p' as const,
    bitrate: 'high' as const, seed: 5, referenceUrl: null,
  }

  it('runs in the browser and needs no key', () => {
    expect(cinematicProvider.capabilities.execution).toBe('client')
    expect(cinematicProvider.capabilities.requiresKey).toBe(false)
    expect(cinematicProvider.capabilities.configured).toBe(true)
  })

  it('has no sunset date, unlike the external providers it will sit beside', () => {
    expect(cinematicProvider.capabilities.sunsetAt).toBeUndefined()
  })

  it('negotiates every setting without coercion', () => {
    // The whole reason the settings feel honest: nothing is silently changed.
    for (const aspectRatio of ASPECT_RATIOS) {
      for (const resolution of RESOLUTIONS) {
        const n = cinematicProvider.negotiate({ ...req, aspectRatio, resolution })
        expect(n.adjustments).toEqual([])
        expect(n.normalized.aspectRatio).toBe(aspectRatio)
        expect(n.normalized.resolution).toBe(resolution)
      }
    }
  })

  it('preserves duration exactly across the whole range', () => {
    for (const durationS of [4, 7, 15, 30]) {
      expect(cinematicProvider.negotiate({ ...req, durationS }).normalized.durationS).toBe(durationS)
    }
  })
})
