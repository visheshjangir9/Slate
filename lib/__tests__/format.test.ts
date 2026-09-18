import { describe, expect, it } from 'vitest'
import { fileSize, timeAgo, timecode } from '../format'

describe('timecode', () => {
  it('formats minutes and seconds', () => {
    expect(timecode(0)).toBe('0:00')
    expect(timecode(5)).toBe('0:05')
    expect(timecode(59)).toBe('0:59')
    expect(timecode(60)).toBe('1:00')
    expect(timecode(125)).toBe('2:05')
  })

  it('floors partial seconds rather than rounding up past the end', () => {
    // A player at 5.9s of a 6s clip must not read 0:06 before it has ended.
    expect(timecode(5.9)).toBe('0:05')
  })

  it('clamps values a media element can genuinely produce', () => {
    // duration is NaN until metadata loads, and Infinity while streaming.
    expect(timecode(NaN)).toBe('0:00')
    expect(timecode(Infinity)).toBe('0:00')
    expect(timecode(-4)).toBe('0:00')
  })
})

describe('fileSize', () => {
  it('scales units', () => {
    expect(fileSize(512)).toBe('512 B')
    expect(fileSize(60_000)).toBe('60 KB')
    expect(fileSize(1_623_508)).toBe('1.62 MB')
  })
  it('handles absent values', () => {
    expect(fileSize(null)).toBe('—')
    expect(fileSize(undefined)).toBe('—')
  })
})

describe('timeAgo', () => {
  const now = new Date('2026-09-18T12:00:00Z').getTime()
  const at = (s: number) => new Date(now - s * 1000).toISOString()

  it('describes recency', () => {
    expect(timeAgo(at(5), now)).toBe('just now')
    expect(timeAgo(at(300), now)).toBe('5m ago')
    expect(timeAgo(at(7200), now)).toBe('2h ago')
    expect(timeAgo(at(172_800), now)).toBe('2d ago')
  })

  it('never renders a negative age from clock skew', () => {
    expect(timeAgo(at(-30), now)).toBe('just now')
  })
})
