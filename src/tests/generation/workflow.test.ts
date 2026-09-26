import { describe, expect, it } from 'vitest'
import { DEFAULTS, composerFromParams, forWorkflow } from '@/lib/client/useStudio'
import { CINEMATIC_MODEL_ID, LIVE_MODELS, LTX_MODEL_ID, studioHrefFor } from '@/lib/catalog'

describe('Video workflow is generative video only', () => {
  it('defaults to LTX-2 Pro at an LTX duration', () => {
    expect(DEFAULTS.video.model).toBe(LTX_MODEL_ID)
    expect(DEFAULTS.video.motion).toBe('static')
    expect([4, 6, 8]).toContain(DEFAULTS.video.durationS)
  })

  it('runs LTX-2 Pro whatever a link or an older clip carried in', () => {
    const fromLink = { ...DEFAULTS.video, ...composerFromParams(new URLSearchParams('model=slate-cinematic-1&duration=13&motion=orbit_left')) }
    const c = forWorkflow('video', fromLink)
    expect(c.model).toBe(LTX_MODEL_ID)
    expect(c.durationS).toBe(8)
    expect(c.motion).toBe('static')
    expect(forWorkflow('video', { ...DEFAULTS.video, durationS: 5 }).durationS).toBe(4)
  })

  it('leaves Camera Motion and Image untouched', () => {
    const motion = { ...DEFAULTS.motion, durationS: 13 }
    expect(forWorkflow('motion', motion)).toBe(motion)
    expect(forWorkflow('image', DEFAULTS.image)).toBe(DEFAULTS.image)
    expect(DEFAULTS.motion.model).toBe(CINEMATIC_MODEL_ID)
  })

  it('sends each live model to the workflow that runs it', () => {
    const href = Object.fromEntries(LIVE_MODELS.map((m) => [m.id, studioHrefFor(m)]))
    expect(href[CINEMATIC_MODEL_ID]).toBe('/studio/motion')
    expect(href[LTX_MODEL_ID]).toBe('/studio')
    expect(href['gpt-image-1']).toBe('/studio/image')
  })
})
