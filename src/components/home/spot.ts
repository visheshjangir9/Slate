import type { PointerEvent } from 'react'

/**
 * Pointer handlers for `.spot` cards: the light follows the cursor and the
 * card leans a few degrees toward it. Mouse only; touch keeps the card still.
 */
const TILT = 3.5

export const spot = {
  onPointerMove(e: PointerEvent<HTMLElement>) {
    if (e.pointerType !== 'mouse') return
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`)
    el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`)
    el.style.setProperty('--rx', `${((x - 0.5) * TILT).toFixed(2)}deg`)
    el.style.setProperty('--ry', `${((0.5 - y) * TILT).toFixed(2)}deg`)
  },
  onPointerLeave(e: PointerEvent<HTMLElement>) {
    e.currentTarget.style.setProperty('--rx', '0deg')
    e.currentTarget.style.setProperty('--ry', '0deg')
  },
}
