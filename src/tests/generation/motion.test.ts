import { describe, expect, it } from 'vitest'
import { MOTION_IDS, covers, getMotion, minimumScaleFor } from '@/lib/engine/motion'

const SAMPLES = 241
const ts = Array.from({ length: SAMPLES }, (_, i) => i / (SAMPLES - 1))

describe('minimumScaleFor', () => {
  it('is 1 when the frame is centred and unrotated', () => {
    expect(minimumScaleFor(0, 0, 0)).toBeCloseTo(1, 9)
  })

  it('grows with translation on either axis', () => {
    expect(minimumScaleFor(0.1, 0, 0)).toBeCloseTo(1.2, 9)
    expect(minimumScaleFor(0, 0.1, 0)).toBeCloseTo(1.2, 9)
  })

  it('grows with rotation', () => {
    expect(minimumScaleFor(0, 0, 5)).toBeGreaterThan(minimumScaleFor(0, 0, 0))
  })

  it('is symmetric in sign', () => {
    expect(minimumScaleFor(-0.07, 0, -3)).toBeCloseTo(minimumScaleFor(0.07, 0, 3), 9)
  })
})

describe('every motion preset', () => {
  for (const id of MOTION_IDS) {
    describe(id, () => {
      const preset = getMotion(id, 12345)

      it('COVERS THE FRAME AT EVERY INSTANT', () => {
        // The headline invariant. If this fails the clip shows background
        // through a corner mid-pan, which instantly reads as amateur.
        for (const t of ts) {
          const tr = preset.at(t)
          expect(
            covers(tr),
            `${id} exposes an edge at t=${t.toFixed(3)}: scale ${tr.scale.toFixed(4)} < required ${minimumScaleFor(tr.x, tr.y, tr.rotate).toFixed(4)}`,
          ).toBe(true)
        }
      })

      it('never scales below 1', () => {
        for (const t of ts) expect(preset.at(t).scale).toBeGreaterThanOrEqual(1)
      })

      it('produces only finite values', () => {
        for (const t of ts) {
          const tr = preset.at(t)
          for (const [k, v] of Object.entries(tr)) {
            expect(Number.isFinite(v), `${id}.${k} at t=${t}`).toBe(true)
          }
        }
      })

      it('clamps time outside [0,1] rather than extrapolating', () => {
        expect(preset.at(-1)).toEqual(preset.at(0))
        expect(preset.at(2)).toEqual(preset.at(1))
      })

      it('is deterministic for a fixed seed', () => {
        const a = getMotion(id, 999)
        const b = getMotion(id, 999)
        for (const t of ts) expect(a.at(t)).toEqual(b.at(t))
      })

      it('carries presentable metadata', () => {
        expect(preset.label.length).toBeGreaterThan(0)
        expect(preset.description.length).toBeGreaterThan(0)
      })
    })
  }
})

describe('preset behaviour', () => {
  it('static really is static', () => {
    const s = getMotion('static')
    for (const t of ts) expect(s.at(t)).toEqual({ scale: 1, x: 0, y: 0, rotate: 0 })
  })

  it('dolly_in ends closer than it starts, dolly_out the reverse', () => {
    expect(getMotion('dolly_in').at(1).scale).toBeGreaterThan(getMotion('dolly_in').at(0).scale)
    expect(getMotion('dolly_out').at(1).scale).toBeLessThan(getMotion('dolly_out').at(0).scale)
  })

  it('crash_zoom_in is more aggressive than dolly_in', () => {
    const crash = getMotion('crash_zoom_in')
    const dolly = getMotion('dolly_in')
    const travel = (p: typeof crash) => Math.abs(p.at(1).scale - p.at(0).scale)
    expect(travel(crash)).toBeGreaterThan(travel(dolly))
  })

  it('crash_zoom_in front-loads its movement', () => {
    const p = getMotion('crash_zoom_in')
    const covered = (p.at(0.25).scale - p.at(0).scale) / (p.at(1).scale - p.at(0).scale)
    expect(covered).toBeGreaterThan(0.5)
  })

  it('pan_left and pan_right travel in opposite directions', () => {
    const l = getMotion('pan_left')
    const r = getMotion('pan_right')
    expect(Math.sign(l.at(1).x - l.at(0).x)).toBe(-Math.sign(r.at(1).x - r.at(0).x))
  })

  it('orbit presets actually rotate', () => {
    for (const id of ['orbit_left', 'orbit_right'] as const) {
      const p = getMotion(id)
      expect(Math.abs(p.at(1).rotate - p.at(0).rotate)).toBeGreaterThan(1)
    }
  })

  it('handheld varies with seed but stays bounded', () => {
    const a = getMotion('handheld', 1)
    const b = getMotion('handheld', 2)
    const differs = ts.some((t) => a.at(t).x !== b.at(t).x)
    expect(differs).toBe(true)
    for (const t of ts) {
      expect(Math.abs(a.at(t).x)).toBeLessThan(0.02)
      expect(Math.abs(a.at(t).rotate)).toBeLessThan(1)
    }
  })
})
