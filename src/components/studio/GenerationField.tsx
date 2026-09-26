'use client'

import type { ReactNode } from 'react'

/**
 * The output frame's generation state: a dim field of dots with a slow wave of
 * light moving through it, over a faint drifting glow. It lives inside the
 * frame only, so the result reads as developing here rather than the page
 * loading. It carries no progress claim of its own.
 *
 * `leaving` fades it out (used under a result that has just arrived);
 * `onLeft` fires once that fade ends so the caller can unmount it.
 */
export function GenerationField({
  kind, leaving = false, onLeft, children,
}: {
  kind: 'image' | 'video'
  leaving?: boolean
  onLeft?: () => void
  /** Rendered over the base, under the dots (e.g. the user's source image). */
  children?: ReactNode
}) {
  return (
    <div aria-hidden data-kind={kind} className={`gen-field ${leaving ? 'gen-field-out' : ''}`}
      onAnimationEnd={(e) => {
        // Only the field's own fade: the layers' animations bubble here too.
        if (leaving && e.target === e.currentTarget) onLeft?.()
      }}>
      {children}
      <div className="gen-field-glow" />
      <div className="gen-field-disc">
        <div className="gen-field-dots" />
        <div className="gen-field-wave" />
      </div>
    </div>
  )
}
