import 'server-only'
import jpeg from 'jpeg-js'

/**
 * Centre-crop a JPEG to exactly width x height. Pure JS on purpose: no native
 * binary to fatten the serverless bundle. Returns null if the bytes cannot be
 * decoded or are smaller than the crop, so the caller fails honestly instead
 * of shipping a frame at the wrong ratio.
 */
export function centerCropJpeg(source: Uint8Array, width: number, height: number, quality = 92): Uint8Array | null {
  try {
    const img = jpeg.decode(source, { useTArray: true, maxMemoryUsageInMB: 256 })
    if (!img?.data || img.width < width || img.height < height) return null
    if (img.width === width && img.height === height) return source

    const x0 = Math.floor((img.width - width) / 2)
    const y0 = Math.floor((img.height - height) / 2)
    const out = new Uint8Array(width * height * 4)
    for (let y = 0; y < height; y++) {
      const src = ((y0 + y) * img.width + x0) * 4
      out.set(img.data.subarray(src, src + width * 4), y * width * 4)
    }
    return new Uint8Array(jpeg.encode({ data: out, width, height }, quality).data)
  } catch {
    return null
  }
}
