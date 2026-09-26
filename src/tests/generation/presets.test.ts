import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ALL_PRESETS, MOTION_DEMO_IMAGE, MOTION_SHOWCASE, motionStill, presetToParams } from '@/lib/presets'
import { composerFromParams } from '@/lib/client/useStudio'
import { MOTION_IDS } from '@/lib/engine/motion'

describe('Explore presets', () => {
  it('have unique ids', () => {
    const ids = ALL_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('each ship a real static image, never a live call', () => {
    for (const p of ALL_PRESETS) {
      expect(existsSync(join(process.cwd(), 'public', 'explore', p.image)), p.image).toBe(true)
    }
  })

  it('give every motion card a still that exists, falling back to the shared frame', () => {
    for (const m of MOTION_IDS) {
      expect(existsSync(join(process.cwd(), 'public', 'explore', motionStill(m))), motionStill(m)).toBe(true)
    }
    expect(motionStill('dolly_in')).toBe('motion-dolly-in.jpg')
    expect(motionStill('whip_pan')).toBe(MOTION_DEMO_IMAGE)
  })

  it('carry only settings the engine really supports', () => {
    for (const p of ALL_PRESETS) {
      expect(MOTION_IDS).toContain(p.motion)
      expect(p.prompt.trim().length).toBeGreaterThanOrEqual(3)
      expect(p.durationS).toBeGreaterThanOrEqual(4)
      expect(p.durationS).toBeLessThanOrEqual(30)
    }
    for (const m of MOTION_SHOWCASE) expect(MOTION_IDS).toContain(m)
  })

  it('Use preset hands every field to Studio intact', () => {
    for (const p of ALL_PRESETS) {
      const c = composerFromParams(new URLSearchParams(presetToParams(p)))
      expect(c).toEqual({
        prompt: p.prompt, motion: p.motion, durationS: p.durationS,
        aspectRatio: p.aspectRatio, resolution: p.resolution, bitrate: p.bitrate,
      })
    }
  })
})
