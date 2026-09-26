import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { credentialSchema } from '@/lib/byok/schema'
import {
  BYOK_PROVIDERS, byokKind, byokLabel, byokModelId, byokProvider, byokProviderTag,
  isByokModelId, parseByokModelId, providerSummary,
} from '@/lib/byok/catalog'
import { ADAPTER_IDS } from '@/lib/byok/service'
import { CATALOGUE_MODELS, LIVE_MODELS, catalogueModel, catalogueStatus, kindOfModel, matchesKnownModel, modelName, providersFor } from '@/lib/catalog'
import { DEFAULTS, composerFromParams, forWorkflow } from '@/lib/client/useStudio'

describe('provider registry', () => {
  it('connectable providers are exactly the ones with a real adapter', () => {
    expect(BYOK_PROVIDERS.map((p) => p.id).sort()).toEqual([...ADAPTER_IDS].sort())
    for (const absent of ['xai', 'ollama', 'openai-compatible', 'acme']) {
      expect(byokProvider(absent), absent).toBeUndefined()
    }
  })

  it('states what each provider can do in Slate, without overclaiming', () => {
    expect(providerSummary(byokProvider('google')!)).toBe('Video · Image')
    expect(providerSummary(byokProvider('openai')!)).toBe('Video · Image')
    expect(providerSummary(byokProvider('openrouter')!)).toMatch(/depending on the model/)
    expect(providerSummary(byokProvider('anthropic')!)).toMatch(/Not usable/)
    expect(providerSummary(byokProvider('mistral')!)).toMatch(/Not usable/)
  })
})

describe('visible providers', () => {
  it('only providers with a real adapter are shown; unsupported ones are not listed at all', () => {
    expect(BYOK_PROVIDERS.map((p) => p.id)).toEqual(['google', 'openai', 'openrouter', 'anthropic', 'mistral'])
    for (const absent of ['xai', 'ollama', 'openai-compatible']) expect(byokProvider(absent)).toBeUndefined()
  })

  it('the server refuses every provider without an adapter', () => {
    for (const id of ['google', 'openai', 'openrouter', 'anthropic', 'mistral', 'xai', 'ollama', 'openai-compatible', 'acme']) {
      const ok = credentialSchema.safeParse({ providerId: id, apiKey: 'test-not-a-real-key-000000' }).success
      expect(ok, id).toBe(ADAPTER_IDS.includes(id as never))
    }
  })
})

describe('provider, model and capability are separate', () => {
  it('parses a stored id only when the provider documents that operation for that model', () => {
    expect(parseByokModelId(byokModelId('google', 'video', 'veo-3.1-generate-preview'))).toMatchObject({ providerId: 'google', op: 'video', runs: { video: { durations: [4, 6, 8] } } })
    expect(parseByokModelId(byokModelId('google', 'image', 'gemini-3-pro-image-preview'))).toMatchObject({ providerId: 'google', op: 'image' })
    expect(parseByokModelId(byokModelId('openai', 'video', 'sora-2'))).toMatchObject({ runs: { video: { durations: [4, 8, 12] } } })
    expect(byokProviderTag('openai')).toBe('byok:openai')
  })

  it('refuses provider/model and capability mismatches', () => {
    for (const bad of [
      'byok:openai:image:gemini-2.5-flash-image', // provider mismatch
      'byok:google:image:gpt-image-1',
      'byok:openai:video:gpt-image-1', // capability mismatch
      'byok:google:image:veo-3.1-generate-preview',
      'byok:google:video:gemini-2.5-flash-image',
      'byok:google:image:gemini-2.5-pro', // text model
      'byok:openai:image:whisper-1', // speech model
      'byok:anthropic:image:claude-opus-4-1', // discovery-only provider
      'byok:mistral:video:mistral-large-latest',
      'byok:acme:image:x', 'byok:google:image:../../etc', 'byok:google:gemini-2.5-flash-image', 'gpt-image-1',
    ]) {
      expect(parseByokModelId(bad), bad).toBeNull()
    }
  })

  it('a gateway defers to discovery: shape-checked, runs decided by the provider', () => {
    expect(parseByokModelId('byok:openrouter:video:google/veo-3.1')).toMatchObject({ providerId: 'openrouter', op: 'video', runs: null })
    expect(parseByokModelId('byok:openrouter:image:not a model')).toBeNull()
    expect(parseByokModelId('byok:openrouter:video:https://evil.example/x')).toBeNull()
  })
})

describe('known models', () => {
  it('Nano Banana Pro is configurable only with Google, as an image model', () => {
    const m = catalogueModel('nano-banana-pro')!
    expect(m.byok).toMatchObject({ providerId: 'google', op: 'image' })
    expect(catalogueStatus(m)).toBe('Configure with Google')
    expect(m.byok!.prefer.test('gemini-3-pro-image-preview')).toBe(true)
    expect(parseByokModelId(byokModelId('google', 'image', 'gemini-3-pro-image-preview'))).not.toBeNull()
  })

  it('Veo 3.1 and Sora 2 point at their own provider’s video operation', () => {
    expect(catalogueModel('veo-3-1')!.byok).toMatchObject({ providerId: 'google', op: 'video' })
    expect(catalogueModel('sora-2')!.byok).toMatchObject({ providerId: 'openai', op: 'video' })
    expect(catalogueModel('veo-3-1')!.byok!.prefer.test('veo-3.1-generate-preview')).toBe(true)
  })

  it('no catalogue model is configurable without its own provider and operation behind it', () => {
    for (const m of CATALOGUE_MODELS) {
      if (m.status === 'configurable') {
        const p = byokProvider(m.byok!.providerId)
        expect(p, m.id).toBeDefined()
        expect(p!.operations, m.id).toContain(m.byok!.op)
      } else {
        expect(m.status, m.id).toBe('catalogue')
        expect(m.byok).toBeUndefined()
        expect(catalogueStatus(m)).toBe(m.kind === 'video' || m.kind === 'image' ? 'Use with your own provider' : 'No Slate workflow yet')
      }
    }
    expect(CATALOGUE_MODELS.some((m) => m.status === 'live')).toBe(false)
    expect(LIVE_MODELS.every((m) => catalogueStatus(m) === 'Live')).toBe(true)
  })
})

describe('known model as a configuration target', () => {
  it('offers only providers that could genuinely serve the model', () => {
    expect(providersFor(catalogueModel('nano-banana-pro')!).providers).toEqual(['google', 'openrouter'])
    expect(providersFor(catalogueModel('veo-3-1')!).providers).toEqual(['google', 'openrouter'])
    expect(providersFor(catalogueModel('sora-2')!).providers).toEqual(['openai', 'openrouter'])
    // No Slate adapter for Kuaishou: only the gateway, and only if the account lists it.
    expect(providersFor(catalogueModel('kling-3')!).providers).toEqual(['openrouter'])
    // Nano Banana Pro is never offered through OpenAI; text-only providers never serve media models.
    for (const m of CATALOGUE_MODELS) {
      const ps = providersFor(m).providers
      expect(ps, m.id).not.toContain('anthropic')
      expect(ps, m.id).not.toContain('mistral')
      if (m.maker !== 'OpenAI') expect(ps, m.id).not.toContain('openai')
      if (m.maker !== 'Google') expect(ps, m.id).not.toContain('google')
    }
  })

  it('a kind of model Slate has no workflow for has no provider, with the reason', () => {
    for (const id of ['kling-3-motion', 'kling-3-omni-edit']) {
      const t = providersFor(catalogueModel(id)!)
      expect(t.providers, id).toEqual([])
      expect(t.reason, id).toMatch(/no .* workflow/)
    }
  })

  it('recognises a known model in provider listings, and nothing unrelated', () => {
    const kling = catalogueModel('kling-3')!
    expect(matchesKnownModel(kling, 'kwaivgi/kling-v3.0')).toBe(true)
    expect(matchesKnownModel(kling, 'kwaivgi/kling-3')).toBe(true)
    expect(matchesKnownModel(kling, 'kwaivgi/kling-v2.1')).toBe(false)
    expect(matchesKnownModel(kling, 'kwaivgi/kling-v3-motion-control')).toBe(false)
    expect(matchesKnownModel(kling, 'google/veo-3.1')).toBe(false)
    const veo = catalogueModel('veo-3-1')!
    expect(matchesKnownModel(veo, 'veo-3.1-generate-preview')).toBe(true)
    expect(matchesKnownModel(veo, 'google/veo-3.1')).toBe(true)
    expect(matchesKnownModel(veo, 'veo-3.0-generate-001')).toBe(false)
    const nano = catalogueModel('nano-banana-pro')!
    expect(matchesKnownModel(nano, 'gemini-3-pro-image-preview')).toBe(true)
    expect(matchesKnownModel(nano, 'gemini-2.5-flash-image')).toBe(false)
    const sora = catalogueModel('sora-2')!
    expect(matchesKnownModel(sora, 'sora-2')).toBe(true)
    expect(matchesKnownModel(sora, 'openai/sora-2')).toBe(true)
    expect(matchesKnownModel(sora, 'sora-2-pro')).toBe(false)
  })
})

describe('user-key models in Studio', () => {
  it('are the kind their operation says, everywhere the UI asks', () => {
    const img = byokModelId('google', 'image', 'gemini-3-pro-image-preview')
    const vid = byokModelId('google', 'video', 'veo-3.1-generate-preview')
    expect(isByokModelId(img)).toBe(true)
    expect(byokKind(img)).toBe('image')
    expect(kindOfModel(img)).toBe('image')
    expect(byokKind(vid)).toBe('video')
    expect(kindOfModel(vid)).toBe('video')
    expect(modelName(vid)).toBe(byokLabel(vid))
    expect(byokLabel(vid)).toBe('veo-3.1-generate-preview · your Google account')
  })

  it('each workflow keeps only models it can run; Motion is always Slate Cinematic', () => {
    const img = byokModelId('google', 'image', 'gemini-2.5-flash-image')
    const vid = byokModelId('google', 'video', 'veo-3.1-generate-preview')
    expect(composerFromParams(new URLSearchParams({ model: img })).model).toBe(img)
    expect(composerFromParams(new URLSearchParams({ model: vid })).model).toBe(vid)
    expect(forWorkflow('image', { ...DEFAULTS.image, model: img }).model).toBe(img)
    expect(forWorkflow('video', { ...DEFAULTS.video, model: vid }).model).toBe(vid)
    // Never crossed over, never a silent swap to a different provider's model.
    expect(forWorkflow('video', { ...DEFAULTS.video, model: img }).model).toBe('ltx-2-pro')
    expect(forWorkflow('image', { ...DEFAULTS.image, model: vid }).model).toBe('gpt-image-1')
    expect(forWorkflow('motion', { ...DEFAULTS.motion, model: vid }).model).toBe('slate-cinematic-1')
    expect(forWorkflow('image', { ...DEFAULTS.image, model: 'ltx-2-pro' }).model).toBe('gpt-image-1')
    // Malformed or cross-provider ids from a URL are ignored.
    expect(composerFromParams(new URLSearchParams({ model: 'byok:openai:image:gemini-2.5-flash-image' })).model).toBeUndefined()
  })
})

describe('homepage', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/home/HomePage.tsx'), 'utf8')

  it('has no model catalogue', () => {
    expect(src).not.toMatch(/CATALOGUE_MODELS|catalogueStatus|ModelsSection/)
    for (const name of ['Seedance', 'Kling', 'Veo', 'Sora', 'FLUX', 'Nano Banana', 'MiniMax', 'Wan 3', 'Grok', 'Seedream']) {
      expect(src, name).not.toContain(name)
    }
  })

  it('section 05 is Bring your own AI, opening /byok', () => {
    expect(src).toMatch(/<ByokSection \/>/)
    expect(src).toContain('href="/byok"')
    expect(src).toMatch(/>05<\/span>.*Bring your own AI/)
    expect(src).toContain('Use the models you already have.')
    expect(src).toContain('Connect your provider. Choose your model. Create inside Slate.')
    for (const line of ['Your model.', 'Your provider.', 'Your generation.']) expect(src).toContain(line)
  })
})
