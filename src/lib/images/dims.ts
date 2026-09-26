import type { AspectRatio } from '@/lib/engine/types'

/**
 * GPT Image output geometry. Pure, so the composer can show the exact pixel
 * size before anything is generated and the server crops to the same numbers.
 *
 * gpt-image-1 renders only 1024x1024, 1536x1024 or 1024x1536. Slate asks for
 * the nearest of those, then centre-crops to the ratio you chose, so a 9:16
 * request really is 9:16 rather than the model's 2:3.
 */
export interface Size { width: number; height: number }

const ratioOf = (a: AspectRatio): number => {
  const [w, h] = a.split(':').map(Number)
  return w / h
}

export function gptNativeSize(aspect: AspectRatio): Size {
  const r = ratioOf(aspect)
  if (r > 1.2) return { width: 1536, height: 1024 }
  if (r < 0.83) return { width: 1024, height: 1536 }
  return { width: 1024, height: 1024 }
}

const even = (n: number) => Math.max(2, Math.floor(n / 2) * 2)

/** The largest centred crop of the native frame at the requested ratio. */
export function imageOutputDims(aspect: AspectRatio): Size {
  const native = gptNativeSize(aspect)
  const r = ratioOf(aspect)
  const nativeR = native.width / native.height
  if (Math.abs(nativeR - r) < 1e-6) return native
  return nativeR > r
    ? { width: even(native.height * r), height: native.height }
    : { width: native.width, height: even(native.width / r) }
}

export const IMAGE_QUALITY = { standard: 'medium', high: 'high' } as const
