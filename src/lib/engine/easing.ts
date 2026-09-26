/**
 * Easing curves.
 *
 * Every curve here is a normalised easing: f(0) === 0, f(1) === 1, and
 * monotonically non-decreasing in between. Camera moves that ease outside
 * [0,1] read as glitches rather than cinematography, so the invariant is
 * enforced by tests rather than left to trust.
 */

export type Easing = (t: number) => number

export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t)

export const linear: Easing = (t) => clamp01(t)

export const easeInOutSine: Easing = (t) => {
  const c = clamp01(t)
  return -(Math.cos(Math.PI * c) - 1) / 2
}

export const easeInOutCubic: Easing = (t) => {
  const c = clamp01(t)
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2
}

export const easeOutExpo: Easing = (t) => {
  const c = clamp01(t)
  return c === 1 ? 1 : 1 - Math.pow(2, -10 * c)
}

export const easeOutQuart: Easing = (t) => {
  const c = clamp01(t)
  return 1 - Math.pow(1 - c, 4)
}

export const easeInQuad: Easing = (t) => {
  const c = clamp01(t)
  return c * c
}

export const EASINGS = {
  linear,
  easeInOutSine,
  easeInOutCubic,
  easeOutExpo,
  easeOutQuart,
  easeInQuad,
} satisfies Record<string, Easing>

/** Interpolate a to b through an easing curve. */
export const mix = (a: number, b: number, t: number, ease: Easing = linear): number =>
  a + (b - a) * ease(t)
