import { describe, expect, it } from 'vitest'
import jpeg from 'jpeg-js'
import { centerCropJpeg } from '@/lib/images/centerCrop'

/** A frame whose left half is black and right half white. */
function split(width: number, height: number): Uint8Array {
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = x < width / 2 ? 0 : 255
      data.set([v, v, v, 255], (y * width + x) * 4)
    }
  }
  return new Uint8Array(jpeg.encode({ data, width, height }, 95).data)
}

describe('centerCropJpeg', () => {
  it('returns a JPEG of exactly the requested size', () => {
    const out = centerCropJpeg(split(320, 200), 200, 200)!
    const img = jpeg.decode(out, { useTArray: true })
    expect([img.width, img.height]).toEqual([200, 200])
  })

  it('crops from the centre, keeping both halves', () => {
    const out = centerCropJpeg(split(320, 200), 200, 200)!
    const img = jpeg.decode(out, { useTArray: true })
    const px = (x: number) => img.data[(100 * img.width + x) * 4]
    expect(px(10)).toBeLessThan(40)
    expect(px(190)).toBeGreaterThan(215)
  })

  it('refuses a crop larger than the source instead of padding', () => {
    expect(centerCropJpeg(split(100, 100), 200, 100)).toBeNull()
  })

  it('refuses bytes that are not a JPEG', () => {
    expect(centerCropJpeg(new Uint8Array([1, 2, 3]), 10, 10)).toBeNull()
  })
})
