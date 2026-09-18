import { easeInOutSine, easeOutExpo, easeOutQuart, mix, clamp01 } from './easing'
import type { MotionId, MotionPreset, Transform } from './types'

const DEG = Math.PI / 180

/**
 * Smallest scale at which a transformed frame still fully covers the canvas.
 *
 * Translation of `x` (as a fraction of width) exposes an edge unless the image
 * is at least `1 + 2|x|` wide, and rotation needs a further `|cos| + |sin|`.
 * The bound is deliberately conservative: showing background through a corner
 * during a pan is the single most obvious way this engine could look cheap.
 */
export function minimumScaleFor(x: number, y: number, rotateDeg: number): number {
  const r = Math.abs(rotateDeg) * DEG
  const rotationFactor = Math.abs(Math.cos(r)) + Math.abs(Math.sin(r))
  return Math.max(1 + 2 * Math.abs(x), 1 + 2 * Math.abs(y)) * rotationFactor
}

/** Does this transform cover the frame? Used as a test invariant and a render guard. */
export const covers = (t: Transform): boolean =>
  t.scale >= minimumScaleFor(t.x, t.y, t.rotate) - 1e-9

const T = (scale: number, x = 0, y = 0, rotate = 0): Transform => ({ scale, x, y, rotate })

/** Deterministic smooth noise in [-1,1]; two incommensurate sines, seeded phases. */
function wobble(t: number, seed: number, channel: number): number {
  const p1 = ((seed * 9301 + channel * 49297) % 233280) / 233280
  const p2 = ((seed * 4021 + channel * 71237) % 233280) / 233280
  return (
    0.62 * Math.sin(2 * Math.PI * (1.7 * t + p1)) +
    0.38 * Math.sin(2 * Math.PI * (2.9 * t + p2))
  )
}

interface Spec {
  label: string
  description: string
  badge?: 'TOP' | 'NEW'
  at: (t: number, seed: number) => Transform
}

const SPECS: Record<MotionId, Spec> = {
  static: {
    label: 'Static',
    description: 'Locked off. No camera movement.',
    at: () => T(1),
  },
  dolly_in: {
    label: 'Dolly In',
    description: 'Camera pushes steadily toward the subject.',
    badge: 'TOP',
    at: (t) => T(mix(1, 1.18, t, easeInOutSine)),
  },
  dolly_out: {
    label: 'Dolly Out',
    description: 'Camera pulls back to reveal the scene.',
    at: (t) => T(mix(1.18, 1, t, easeInOutSine)),
  },
  pan_left: {
    label: 'Pan Left',
    description: 'Camera sweeps horizontally to the left.',
    at: (t) => T(1.14, mix(0.06, -0.06, t, easeInOutSine)),
  },
  pan_right: {
    label: 'Pan Right',
    description: 'Camera sweeps horizontally to the right.',
    at: (t) => T(1.14, mix(-0.06, 0.06, t, easeInOutSine)),
  },
  tilt_up: {
    label: 'Tilt Up',
    description: 'Camera pivots upward through the frame.',
    at: (t) => T(1.14, 0, mix(0.06, -0.06, t, easeInOutSine)),
  },
  tilt_down: {
    label: 'Tilt Down',
    description: 'Camera pivots downward through the frame.',
    at: (t) => T(1.14, 0, mix(-0.06, 0.06, t, easeInOutSine)),
  },
  crash_zoom_in: {
    label: 'Crash Zoom In',
    description: 'Violent snap toward the subject. Front-loaded and abrupt.',
    badge: 'TOP',
    at: (t) => T(mix(1.02, 1.5, t, easeOutExpo)),
  },
  crash_zoom_out: {
    label: 'Crash Zoom Out',
    description: 'Violent snap away from the subject.',
    at: (t) => T(mix(1.5, 1.02, t, easeOutExpo)),
  },
  orbit_left: {
    label: 'Orbit Left',
    description: 'Arcs around the subject counter-clockwise.',
    badge: 'NEW',
    at: (t) => T(1.16, mix(0.05, -0.05, t, easeInOutSine), 0, mix(1.5, -1.5, t, easeInOutSine)),
  },
  orbit_right: {
    label: 'Orbit Right',
    description: 'Arcs around the subject clockwise.',
    at: (t) => T(1.16, mix(-0.05, 0.05, t, easeInOutSine), 0, mix(-1.5, 1.5, t, easeInOutSine)),
  },
  crane_up: {
    label: 'Crane Up',
    description: 'Camera rises while easing back. Reveals scale.',
    at: (t) => T(mix(1.22, 1.12, t, easeOutQuart), 0, mix(0.05, -0.05, t, easeOutQuart)),
  },
  handheld: {
    label: 'Handheld',
    description: 'Operator drift. Organic, never perfectly still.',
    badge: 'NEW',
    at: (t, seed) =>
      T(1.08, 0.012 * wobble(t, seed, 1), 0.012 * wobble(t, seed, 2), 0.6 * wobble(t, seed, 3)),
  },
}

export const MOTION_IDS = Object.keys(SPECS) as MotionId[]

/** Bind a preset to a seed. Seed only affects handheld; every other move is fixed. */
export function getMotion(id: MotionId, seed = 0): MotionPreset {
  const spec = SPECS[id]
  return {
    id,
    label: spec.label,
    description: spec.description,
    badge: spec.badge,
    at: (t: number) => spec.at(clamp01(t), seed),
  }
}

export const MOTIONS: MotionPreset[] = MOTION_IDS.map((id) => getMotion(id))
