import { describe, expect, it } from 'vitest'
import { ASPECT_RATIOS } from '@/lib/engine/types'
import { gptNativeSize, imageOutputDims } from '@/lib/images/dims'

describe('GPT Image geometry', () => {
  it('only ever asks the model for a size it supports', () => {
    const allowed = ['1024x1024', '1536x1024', '1024x1536']
    for (const a of ASPECT_RATIOS) {
      const n = gptNativeSize(a)
      expect(allowed).toContain(`${n.width}x${n.height}`)
    }
  })

  it('crops to the requested ratio within one pixel of rounding', () => {
    for (const a of ASPECT_RATIOS) {
      const [w, h] = a.split(':').map(Number)
      const out = imageOutputDims(a)
      expect(Math.abs(out.width / out.height - w / h)).toBeLessThan(0.01)
    }
  })

  it('never crops to more pixels than the model rendered', () => {
    for (const a of ASPECT_RATIOS) {
      const n = gptNativeSize(a)
      const out = imageOutputDims(a)
      expect(out.width).toBeLessThanOrEqual(n.width)
      expect(out.height).toBeLessThanOrEqual(n.height)
    }
  })

  it('produces the expected frames for the common ratios', () => {
    expect(imageOutputDims('1:1')).toEqual({ width: 1024, height: 1024 })
    expect(imageOutputDims('16:9')).toEqual({ width: 1536, height: 864 })
    expect(imageOutputDims('9:16')).toEqual({ width: 864, height: 1536 })
    expect(imageOutputDims('4:5')).toEqual({ width: 1024, height: 1280 })
  })
})
