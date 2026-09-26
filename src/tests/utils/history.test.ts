import { describe, expect, it } from 'vitest'
import { belongsTo } from '@/lib/client/useStudio'

const img = { model: 'gpt-image-1', workflow: 'image' as const }
const clip = { model: 'slate-cinematic-1', workflow: 'video' as const }
const motionClip = { model: 'slate-cinematic-1', workflow: 'motion' as const }
const ltx = { model: 'ltx-2-pro', workflow: 'video' as const }
const legacyClip = { model: 'slate-cinematic-1', workflow: null }

describe('History is scoped to the open workflow', () => {
  it('Image shows only images', () => {
    expect([img, clip, motionClip, ltx, legacyClip].filter((g) => belongsTo('image', g))).toEqual([img])
  })
  it('Camera Motion shows only clips made in Camera Motion', () => {
    expect([img, clip, motionClip, ltx, legacyClip].filter((g) => belongsTo('motion', g))).toEqual([motionClip])
  })
  it('Video shows its own clips, including ones made before workflows were recorded', () => {
    expect([img, clip, motionClip, ltx, legacyClip].filter((g) => belongsTo('video', g))).toEqual([clip, ltx, legacyClip])
  })
})
