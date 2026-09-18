import { describe, expect, it } from 'vitest'
import { bitrateFor, dimensionsFor, frameCount, ratioOf, roundEven } from '../geometry'
import { ASPECT_RATIOS, BITRATES, RESOLUTIONS } from '../types'

describe('roundEven', () => {
  it('always returns an even number >= 2', () => {
    for (const n of [0, 0.4, 1, 1.5, 2, 3, 719, 720, 721, 1079.6]) {
      const r = roundEven(n)
      expect(r % 2).toBe(0)
      expect(r).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('dimensionsFor', () => {
  it('produces even dimensions for every aspect x resolution pair', () => {
    // H.264 rejects odd dimensions, so all 18 combinations must be even.
    for (const aspect of ASPECT_RATIOS) {
      for (const resolution of RESOLUTIONS) {
        const d = dimensionsFor(aspect, resolution)
        expect(d.width % 2, `${aspect} ${resolution} width`).toBe(0)
        expect(d.height % 2, `${aspect} ${resolution} height`).toBe(0)
        expect(d.width).toBeGreaterThan(0)
        expect(d.height).toBeGreaterThan(0)
      }
    }
  })

  it('matches the conventional labels', () => {
    expect(dimensionsFor('16:9', '720p')).toEqual({ width: 1280, height: 720 })
    expect(dimensionsFor('16:9', '1080p')).toEqual({ width: 1920, height: 1080 })
    expect(dimensionsFor('9:16', '720p')).toEqual({ width: 720, height: 1280 })
    expect(dimensionsFor('9:16', '1080p')).toEqual({ width: 1080, height: 1920 })
    expect(dimensionsFor('1:1', '480p')).toEqual({ width: 480, height: 480 })
    expect(dimensionsFor('4:3', '720p')).toEqual({ width: 960, height: 720 })
  })

  it('pins the minor axis to the resolution tier', () => {
    for (const aspect of ASPECT_RATIOS) {
      const d = dimensionsFor(aspect, '720p')
      expect(Math.min(d.width, d.height)).toBe(720)
    }
  })

  it('preserves the requested ratio within rounding tolerance', () => {
    for (const aspect of ASPECT_RATIOS) {
      for (const resolution of RESOLUTIONS) {
        const d = dimensionsFor(aspect, resolution)
        expect(d.width / d.height).toBeCloseTo(ratioOf(aspect), 1)
      }
    }
  })
})

describe('bitrateFor', () => {
  it('high is strictly richer than standard at the same size', () => {
    for (const aspect of ASPECT_RATIOS) {
      for (const resolution of RESOLUTIONS) {
        const d = dimensionsFor(aspect, resolution)
        expect(bitrateFor(d, 'high')).toBeGreaterThan(bitrateFor(d, 'standard'))
      }
    }
  })

  it('scales with pixel count', () => {
    const small = dimensionsFor('16:9', '480p')
    const large = dimensionsFor('16:9', '1080p')
    expect(bitrateFor(large, 'standard')).toBeGreaterThan(bitrateFor(small, 'standard'))
  })

  it('stays inside encoder-sane bounds for every combination', () => {
    for (const aspect of ASPECT_RATIOS) {
      for (const resolution of RESOLUTIONS) {
        for (const tier of BITRATES) {
          const b = bitrateFor(dimensionsFor(aspect, resolution), tier)
          expect(b).toBeGreaterThanOrEqual(500_000)
          expect(b).toBeLessThanOrEqual(40_000_000)
          expect(Number.isInteger(b)).toBe(true)
        }
      }
    }
  })
})

describe('frameCount', () => {
  it('matches duration x fps', () => {
    expect(frameCount(4, 30)).toBe(120)
    expect(frameCount(30, 30)).toBe(900)
    expect(frameCount(8, 24)).toBe(192)
  })

  it('never returns zero frames', () => {
    expect(frameCount(0, 30)).toBe(1)
  })
})
