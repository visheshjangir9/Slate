import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { HERO_MEDIA, SHOWCASE } from '@/lib/media'

/**
 * Checks each segment by its exact name. existsSync is case-insensitive on
 * macOS, so a "/Media/…" URL would pass locally and 404 on a Linux host.
 */
function existsExactly(url: string): boolean {
  let dir = join(process.cwd(), 'public')
  for (const part of url.split('/').filter(Boolean)) {
    if (!readdirSync(dir).includes(part)) return false
    dir = join(dir, part)
  }
  return true
}

describe('showcase media', () => {
  it('points only at files that exist, with exact filename case', () => {
    for (const m of [...Object.values(SHOWCASE), ...HERO_MEDIA]) {
      expect(existsExactly(m.src), m.src).toBe(true)
      expect(existsExactly(m.poster), m.poster).toBe(true)
    }
  })

  it('rotates the four hero clips, each paired with its own still, in order', () => {
    expect(HERO_MEDIA.map((m) => [m.src.split('/').pop(), m.poster.split('/').pop()])).toEqual([
      ['slate-hero.mp4', 'hero-still-01.jpg'],
      ['hero-02.mp4', 'hero-still-02.jpg'],
      ['hero-03.mp4', 'hero-still-03.jpg'],
      ['hero-04.mp4', 'hero-still-04.jpg'],
    ])
    for (const m of HERO_MEDIA) {
      expect(m.hold).toBeGreaterThanOrEqual(4500)
      expect(m.hold).toBeLessThanOrEqual(6000)
    }
  })

  it('keeps the sports car out of the hero', () => {
    expect(HERO_MEDIA.some((m) => m.src.includes('ferrari'))).toBe(false)
    expect(SHOWCASE.featured.src).toContain('red-ferrari.mp4')
  })
})
