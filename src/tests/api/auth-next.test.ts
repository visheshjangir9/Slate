import { describe, expect, it } from 'vitest'
import { safeNext, withQuery } from '@/lib/auth/next'

describe('safeNext', () => {
  it('keeps same-site paths, including their query', () => {
    expect(safeNext('/studio/image')).toBe('/studio/image')
    expect(safeNext('/studio?prompt=a+b&motion=dolly_in')).toBe('/studio?prompt=a+b&motion=dolly_in')
  })
  it('refuses off-site, protocol-relative and missing targets', () => {
    expect(safeNext('https://evil.example')).toBe('/studio')
    expect(safeNext('//evil.example')).toBe('/studio')
    expect(safeNext('/\\evil.example')).toBe('/studio')
    expect(safeNext(null)).toBe('/studio')
  })
  it('never returns to an auth page or the API', () => {
    expect(safeNext('/sign-in?next=/studio')).toBe('/studio')
    expect(safeNext('/login')).toBe('/studio')
    expect(safeNext('/api/auth/refresh')).toBe('/studio')
  })
})

describe('withQuery', () => {
  it('preserves a preset handed over from Explore', () => {
    expect(withQuery('/studio', { prompt: 'rain at night', motion: 'dolly_in' }))
      .toBe('/studio?prompt=rain+at+night&motion=dolly_in')
  })
  it('returns the bare path when there is no query', () => {
    expect(withQuery('/assets', {})).toBe('/assets')
  })
})
