'use client'

import { useEffect, useRef, useState } from 'react'
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
  motion, source, aspect = 16 / 9, longEdge = 640, durationMs = 3200, playing = true, className = '', label,
}: {
  motion: MotionId
  source: HTMLImageElement | null
  /** Frame width / height. The canvas is sized to it, so the crop is exact. */
  aspect?: number
  longEdge?: number
  durationMs?: number
  playing?: boolean
  className?: string
  label?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const width = Math.round(aspect >= 1 ? longEdge : longEdge * aspect)
  const height = Math.round(aspect >= 1 ? longEdge / aspect : longEdge)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !source) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    const dims = { width: canvas.width, height: canvas.height }
    const preset = getMotion(motion, 7)
    const still = () => {
      drawFrame(ctx, source, dims, preset.at(0.35))
      applyVignette(ctx, dims, 0.22)
    }

    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!playing || reduce) { still(); return }

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
  }, [motion, source, durationMs, playing, width, height])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={`block h-full w-full bg-surface-2 object-cover ${className}`}
      role="img"
      aria-label={label ?? `${motion.replace(/_/g, ' ')} camera move preview`}
    />
  )
}

/**
 * Load an image element once for canvas previews. Same-origin static art or a
 * CORS-enabled storage URL, so the canvas is never tainted.
 */
export function useLoadedImage(src: string | null | undefined): HTMLImageElement | null {
  const [loaded, setLoaded] = useState<{ src: string; img: HTMLImageElement } | null>(null)

  useEffect(() => {
    if (!src) return
    let alive = true
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => { if (alive) setLoaded({ src, img }) }
    img.src = src
    return () => { alive = false }
  }, [src])

  // Derived, so a changed src never shows the previous image's frame.
  return loaded && loaded.src === src ? loaded.img : null
}
