import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Colour contrast, checked against the real design tokens in globals.css:
 * every text colour must clear WCAG AA (4.5:1) on every surface it can sit on.
 */
const css = readFileSync(join(__dirname, '../../app/globals.css'), 'utf8')
const token = (name: string) => {
  const m = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, 'i'))
  if (!m) throw new Error(`token --color-${name} not found`)
  return m[1]
}

const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const TEXT = ['ink', 'ink-2', 'ink-3', 'ink-4', 'signal', 'danger', 'live']
const SURFACES = ['ground', 'surface', 'surface-2', 'surface-3']

describe('colour contrast (WCAG AA)', () => {
  for (const t of TEXT) {
    it(`${t} is readable on every surface`, () => {
      for (const s of SURFACES) {
        const r = ratio(token(t), token(s))
        expect(r, `${t} on ${s} is ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
      }
    })
  }

  it('dark text on the filled buttons is readable', () => {
    expect(ratio(token('ground'), token('signal'))).toBeGreaterThanOrEqual(4.5)
    expect(ratio(token('ground'), token('ink'))).toBeGreaterThanOrEqual(4.5)
  })
})
