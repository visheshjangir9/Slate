/**
 * Validate returned image bytes before anything is stored: the signature must
 * be a real PNG or JPEG and the header must carry sane dimensions. A provider
 * returning HTML, JSON or a truncated file fails here, not in someone's
 * library.
 */
export interface ImageInfo {
  mime: 'image/png' | 'image/jpeg' | 'image/webp'
  ext: 'png' | 'jpg' | 'webp'
  width: number
  height: number
}

const MAX_SIDE = 8192

export function inspectImage(b: Uint8Array): ImageInfo | null {
  if (b.length < 32) return null

  // PNG: signature, then the IHDR chunk's width and height (big-endian).
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) {
    const isIHDR = b[12] === 0x49 && b[13] === 0x48 && b[14] === 0x44 && b[15] === 0x52
    if (!isIHDR) return null
    const width = ((b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19]) >>> 0
    const height = ((b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23]) >>> 0
    return sane(width, height) ? { mime: 'image/png', ext: 'png', width, height } : null
  }

  // WebP: RIFF container; the size lives in the first chunk (VP8X, VP8 or VP8L).
  const tag = (o: number) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3])
  if (tag(0) === 'RIFF' && tag(8) === 'WEBP') {
    const chunk = tag(12)
    let width = 0, height = 0
    if (chunk === 'VP8X') {
      width = 1 + (b[24] | (b[25] << 8) | (b[26] << 16))
      height = 1 + (b[27] | (b[28] << 8) | (b[29] << 16))
    } else if (chunk === 'VP8 ' && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) {
      width = (b[26] | (b[27] << 8)) & 0x3fff
      height = (b[28] | (b[29] << 8)) & 0x3fff
    } else if (chunk === 'VP8L' && b[20] === 0x2f) {
      width = 1 + (((b[22] & 0x3f) << 8) | b[21])
      height = 1 + (((b[24] & 0x0f) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6))
    }
    return sane(width, height) ? { mime: 'image/webp', ext: 'webp', width, height } : null
  }

  // JPEG: walk the markers to the first start-of-frame.
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    let i = 2
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null
      const marker = b[i + 1]
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { i += 2; continue }
      const len = (b[i + 2] << 8) | b[i + 3]
      const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
      if (isSOF) {
        const height = (b[i + 5] << 8) | b[i + 6]
        const width = (b[i + 7] << 8) | b[i + 8]
        return sane(width, height) ? { mime: 'image/jpeg', ext: 'jpg', width, height } : null
      }
      if (len < 2) return null
      i += 2 + len
    }
  }
  return null
}

const sane = (w: number, h: number) => w > 0 && h > 0 && w <= MAX_SIDE && h <= MAX_SIDE
