'use client'

import { useEffect, useRef } from 'react'
import { drawFrame, applyVignette, getMotion } from '@/lib/engine'
import type { MotionId } from '@/lib/engine/types'

/**
 * Live preview of a camera move.
 *
 * Deliberately calls getMotion(id).at(t) -- the exact function the encoder
 * calls -- and renders through the same drawFrame path. So this is a truthful
 * preview of the real transform, not a lookalike CSS animation that could
 * drift from what actually gets rendered.
 */
export function MotionPreview({
  motion, source, durationMs = 3200, playing = true, className = '',
}: {
  motion: MotionId
  source: HTMLImageElement | null
  durationMs?: number
  playing?: boolean
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !source) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    const dims = { width: canvas.width, height: canvas.height }
    const preset = getMotion(motion, 7)

    if (!playing) {
      drawFrame(ctx, source, dims, preset.at(0.35))
      applyVignette(ctx, dims, 0.22)
      return
    }

    const reduce =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      drawFrame(ctx, source, dims, preset.at(0.35))
      applyVignette(ctx, dims, 0.22)
      return
    }

    const start = performance.now()
    const tick = (now: number) => {
      // Ping-pong so the move reads in both directions without a hard cut.
      const cycle = (now - start) % (durationMs * 2)
      const t = cycle < durationMs ? cycle / durationMs : 2 - cycle / durationMs
      drawFrame(ctx, source, dims, preset.at(t))
      applyVignette(ctx, dims, 0.22)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [motion, source, durationMs, playing])

  return (
    <canvas
      ref={canvasRef}
      width={384}
      height={216}
      className={`h-full w-full bg-surface-2 object-cover ${className}`}
      aria-label={`${motion} camera move preview`}
    />
  )
}
