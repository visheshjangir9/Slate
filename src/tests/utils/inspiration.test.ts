import { describe, expect, it } from 'vitest'
import { ASPECT_RATIOS } from '@/lib/engine/types'
import { PROMPT_IDEAS, pickIdea } from '@/lib/inspiration'

describe('prompt inspiration', () => {
  it('has 10–15 specific ideas across the required categories', () => {
    expect(PROMPT_IDEAS.length).toBeGreaterThanOrEqual(10)
    expect(PROMPT_IDEAS.length).toBeLessThanOrEqual(15)
    const cats = PROMPT_IDEAS.map((p) => p.category.toLowerCase())
    for (const c of ['cinematic', 'product', 'portrait', 'automotive', 'architecture', 'fashion', 'landscape', 'documentary', 'night', 'action']) {
      expect(cats, c).toContain(c)
    }
    for (const p of PROMPT_IDEAS) {
      // Production-quality: several sentences, well within the composer's limit.
      expect(p.prompt.length, p.category).toBeGreaterThan(180)
      expect(p.prompt.length).toBeLessThanOrEqual(2000)
      expect([4, 6, 8]).toContain(p.durationS)
      expect(ASPECT_RATIOS).toContain(p.aspectRatio)
    }
    expect(new Set(PROMPT_IDEAS.map((p) => p.prompt)).size).toBe(PROMPT_IDEAS.length)
  })

  it('never repeats the idea on screen, and can reach every idea', () => {
    const n = PROMPT_IDEAS.length
    for (let exclude = 0; exclude < n; exclude++) {
      const seen = new Set<number>()
      for (let k = 0; k < n - 1; k++) {
        const i = pickIdea(exclude, () => (k + 0.5) / (n - 1))
        expect(i).not.toBe(exclude)
        expect(i).toBeGreaterThanOrEqual(0)
        expect(i).toBeLessThan(n)
        seen.add(i)
      }
      expect(seen.size).toBe(n - 1)
    }
    expect(pickIdea(null, () => 0.999)).toBe(n - 1)
  })
})
