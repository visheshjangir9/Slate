import { describe, expect, it } from 'vitest'
import { PROMPT_MAX, PROMPT_MIN, createGenerationSchema, stillQuerySchema } from '../schema'
import { ASPECT_RATIOS, BITRATES, MAX_DURATION_S, MIN_DURATION_S, RESOLUTIONS } from '@/lib/engine/types'
import { MOTION_IDS } from '@/lib/engine/motion'

const valid = {
  prompt: 'a neon-lit alley in the rain',
  model: 'slate-cinematic-1',
  motion: 'dolly_in',
  durationS: 8,
  aspectRatio: '16:9',
  resolution: '720p',
  bitrate: 'standard',
}

describe('createGenerationSchema', () => {
  it('accepts a well-formed request', () => {
    expect(createGenerationSchema.parse(valid).prompt).toBe(valid.prompt)
  })

  it('trims the prompt', () => {
    expect(createGenerationSchema.parse({ ...valid, prompt: '   spaced out   ' }).prompt)
      .toBe('spaced out')
  })

  it('enforces both prompt bounds', () => {
    expect(() => createGenerationSchema.parse({ ...valid, prompt: 'a'.repeat(PROMPT_MIN - 1) })).toThrow()
    expect(() => createGenerationSchema.parse({ ...valid, prompt: 'a'.repeat(PROMPT_MAX + 1) })).toThrow()
    expect(() => createGenerationSchema.parse({ ...valid, prompt: '   ' })).toThrow()
  })

  it('accepts every duration in range and rejects either side', () => {
    for (const d of [MIN_DURATION_S, 10, MAX_DURATION_S]) {
      expect(createGenerationSchema.parse({ ...valid, durationS: d }).durationS).toBe(d)
    }
    expect(() => createGenerationSchema.parse({ ...valid, durationS: MIN_DURATION_S - 1 })).toThrow()
    expect(() => createGenerationSchema.parse({ ...valid, durationS: MAX_DURATION_S + 1 })).toThrow()
    expect(() => createGenerationSchema.parse({ ...valid, durationS: 7.5 })).toThrow()
  })

  it('accepts every declared aspect / resolution / bitrate', () => {
    for (const aspectRatio of ASPECT_RATIOS) {
      expect(createGenerationSchema.parse({ ...valid, aspectRatio }).aspectRatio).toBe(aspectRatio)
    }
    for (const resolution of RESOLUTIONS) {
      expect(createGenerationSchema.parse({ ...valid, resolution }).resolution).toBe(resolution)
    }
    for (const bitrate of BITRATES) {
      expect(createGenerationSchema.parse({ ...valid, bitrate }).bitrate).toBe(bitrate)
    }
  })

  it('rejects values outside the declared sets', () => {
    expect(() => createGenerationSchema.parse({ ...valid, aspectRatio: '3:2' })).toThrow()
    expect(() => createGenerationSchema.parse({ ...valid, resolution: '4k' })).toThrow()
    expect(() => createGenerationSchema.parse({ ...valid, bitrate: 'ultra' })).toThrow()
    expect(() => createGenerationSchema.parse({ ...valid, motion: 'barrel_roll' })).toThrow()
  })

  it('accepts every real motion id', () => {
    for (const motion of MOTION_IDS) {
      expect(createGenerationSchema.parse({ ...valid, motion }).motion).toBe(motion)
    }
  })

  it('rejects a non-URL reference', () => {
    expect(() => createGenerationSchema.parse({ ...valid, referenceUrl: 'not a url' })).toThrow()
    expect(createGenerationSchema.parse({ ...valid, referenceUrl: 'https://x.test/a.png' })
      .referenceUrl).toBe('https://x.test/a.png')
  })

  it('coerces numeric strings, since query and form values arrive as text', () => {
    const p = createGenerationSchema.parse({ ...valid, durationS: '12', seed: '77' })
    expect(p.durationS).toBe(12)
    expect(p.seed).toBe(77)
  })
})

describe('stillQuerySchema', () => {
  // NB: the prompt must be valid here, or these assertions pass for the wrong
  // reason -- throwing on a 2-character prompt instead of on the dimensions.
  const P = 'a valid prompt'

  it('rejects absurd dimensions rather than proxying them upstream', () => {
    expect(() => stillQuerySchema.parse({ prompt: P, width: 9999, height: 720 })).toThrow()
    expect(() => stillQuerySchema.parse({ prompt: P, width: 10, height: 720 })).toThrow()
    expect(() => stillQuerySchema.parse({ prompt: P, width: 1280, height: 9999 })).toThrow()
  })

  it('accepts dimensions the engine actually produces', () => {
    for (const [w, h] of [[1280, 720], [720, 1280], [1120, 480], [1920, 1080]]) {
      expect(stillQuerySchema.parse({ prompt: P, width: w, height: h }).width).toBe(w)
    }
  })

  it('defaults the seed', () => {
    expect(stillQuerySchema.parse({ prompt: P, width: 1280, height: 720 }).seed).toBe(0)
  })

  it('still enforces the prompt bounds', () => {
    expect(() => stillQuerySchema.parse({ prompt: 'ok', width: 1280, height: 720 })).toThrow()
  })
})
