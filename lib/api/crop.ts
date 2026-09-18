import 'server-only'
import jpeg from 'jpeg-js'

/**
 * The upstream image service stamps a "pollinations.ai" watermark into the
 * bottom-right corner, inconsistently and regardless of the documented
 * nologo flag. Verified on real output: it was baked into shipped posters
 * and therefore into generated clips.
 *
 * So we over-fetch a taller frame and cut the strip off. Pure-JS codec on
 * purpose -- no native binary to fatten a serverless bundle.
 */
export const OVERFETCH = 1.18

/** Height to request upstream so that cropping back leaves the wanted height. */
export const overfetchHeight = (height: number): number =>
  Math.round(height * OVERFETCH)

export interface CropResult {
  bytes: Uint8Array
  contentType: 'image/jpeg'
}

/**
 * Crop `source` to exactly width x height, anchored at the top, dropping the
 * watermarked strip. Returns null if the image cannot be decoded, so callers
 * can fall back to the original rather than fail the request.
 */
export function cropWatermark(
  source: Uint8Array,
  width: number,
  height: number,
): CropResult | null {
  try {
    const img = jpeg.decode(source, { useTArray: true })
    if (!img?.data || img.width < 2 || img.height < 2) return null

    // Never crop to more than the source actually has.
    const outW = Math.min(width, img.width)
    const outH = Math.min(height, img.height)
    if (outW <= 0 || outH <= 0) return null

    const out = new Uint8Array(outW * outH * 4)
    for (let y = 0; y < outH; y++) {
      const src = y * img.width * 4
      out.set(img.data.subarray(src, src + outW * 4), y * outW * 4)
    }

    const encoded = jpeg.encode({ data: out, width: outW, height: outH }, 90)
    return { bytes: new Uint8Array(encoded.data), contentType: 'image/jpeg' }
  } catch {
    return null
  }
}
