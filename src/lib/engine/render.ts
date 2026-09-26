import type { Dimensions, Transform } from './types'
import { minimumScaleFor } from './motion'

export type FrameSource =
  | HTMLImageElement
  | HTMLCanvasElement
  | ImageBitmap
  | OffscreenCanvas

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

function sourceSize(src: FrameSource): Dimensions {
  if (src instanceof HTMLImageElement) {
    return { width: src.naturalWidth || src.width, height: src.naturalHeight || src.height }
  }
  return { width: src.width, height: src.height }
}

/**
 * Scale at which the source exactly covers the destination with no letterboxing.
 * Everything the camera does is expressed relative to this baseline.
 */
export function coverScale(src: Dimensions, dst: Dimensions): number {
  return Math.max(dst.width / src.width, dst.height / src.height)
}

/**
 * Draw one frame of the camera move.
 *
 * The transform's scale is clamped up to the covering minimum as a safety net.
 * Presets are authored to satisfy this already (and tests enforce it), but a
 * visible frame edge is bad enough that it is worth defending twice.
 */
export function drawFrame(
  ctx: Ctx2D,
  src: FrameSource,
  dst: Dimensions,
  transform: Transform,
): void {
  const s = sourceSize(src)
  const safeScale = Math.max(transform.scale, minimumScaleFor(transform.x, transform.y, transform.rotate))
  const base = coverScale(s, dst)
  const drawW = s.width * base * safeScale
  const drawH = s.height * base * safeScale

  ctx.save()
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, dst.width, dst.height)
  ctx.translate(dst.width / 2 + transform.x * dst.width, dst.height / 2 + transform.y * dst.height)
  if (transform.rotate) ctx.rotate((transform.rotate * Math.PI) / 180)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src as CanvasImageSource, -drawW / 2, -drawH / 2, drawW, drawH)
  ctx.restore()
}

/** Subtle corner falloff. Cheap, and it stops flat AI stills looking like wallpaper. */
export function applyVignette(ctx: Ctx2D, dst: Dimensions, strength = 0.28): void {
  if (strength <= 0) return
  const r = Math.hypot(dst.width, dst.height) / 2
  const g = ctx.createRadialGradient(
    dst.width / 2, dst.height / 2, r * 0.55,
    dst.width / 2, dst.height / 2, r,
  )
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, `rgba(0,0,0,${strength})`)
  ctx.save()
  ctx.fillStyle = g
  ctx.fillRect(0, 0, dst.width, dst.height)
  ctx.restore()
}

/** Offline placeholder so the pipeline can be exercised without a network call. */
export function drawTestPattern(ctx: Ctx2D, dst: Dimensions): void {
  const g = ctx.createLinearGradient(0, 0, dst.width, dst.height)
  g.addColorStop(0, '#1b2a4a')
  g.addColorStop(0.5, '#6d4aa6')
  g.addColorStop(1, '#c2503f')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, dst.width, dst.height)
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'
  ctx.lineWidth = Math.max(1, dst.width / 480)
  const step = dst.width / 16
  for (let i = 1; i < 16; i++) {
    ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, dst.height); ctx.stroke()
  }
  for (let i = 1; i < 16; i++) {
    const y = (i * dst.height) / 16
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(dst.width, y); ctx.stroke()
  }
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.font = `${Math.round(dst.width / 14)}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('SLATE', dst.width / 2, dst.height / 2)
}
