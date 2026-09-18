import { describe, expect, it } from 'vitest'
import { EASINGS, clamp01, mix } from '../easing'

const SAMPLES = 201
const ts = Array.from({ length: SAMPLES }, (_, i) => i / (SAMPLES - 1))

describe('easing curves', () => {
  for (const [name, fn] of Object.entries(EASINGS)) {
    describe(name, () => {
      it('is normalised: f(0)=0 and f(1)=1', () => {
        expect(fn(0)).toBeCloseTo(0, 6)
        expect(fn(1)).toBeCloseTo(1, 6)
      })

      it('never leaves [0,1]', () => {
        for (const t of ts) {
          const v = fn(t)
          expect(Number.isFinite(v)).toBe(true)
          expect(v).toBeGreaterThanOrEqual(-1e-9)
          expect(v).toBeLessThanOrEqual(1 + 1e-9)
        }
      })

      it('is monotonically non-decreasing', () => {
        // A curve that backtracks reads as a stutter in the final clip.
        for (let i = 1; i < ts.length; i++) {
          expect(fn(ts[i])).toBeGreaterThanOrEqual(fn(ts[i - 1]) - 1e-9)
        }
      })

      it('clamps out-of-range input instead of extrapolating', () => {
        expect(fn(-5)).toBeCloseTo(0, 6)
        expect(fn(5)).toBeCloseTo(1, 6)
      })
    })
  }
})

describe('clamp01', () => {
  it('clamps both ends', () => {
    expect(clamp01(-1)).toBe(0)
    expect(clamp01(0.5)).toBe(0.5)
    expect(clamp01(2)).toBe(1)
  })
})

describe('mix', () => {
  it('hits both endpoints exactly', () => {
    expect(mix(10, 20, 0)).toBe(10)
    expect(mix(10, 20, 1)).toBe(20)
  })

  it('interpolates through the curve', () => {
    expect(mix(0, 10, 0.5)).toBeCloseTo(5, 6)
  })
})
