import { describe, expect, it } from 'vitest'
import { CONSENT_VERSION, parseConsent } from '@/lib/client/consent'

describe('cookie consent storage', () => {
  it('reads a stored choice', () => {
    const c = { v: CONSENT_VERSION, analytics: true, at: '2026-10-02T00:00:00.000Z' }
    expect(parseConsent(JSON.stringify(c))).toEqual(c)
  })

  it('treats missing, corrupt, malformed or outdated values as "not chosen yet"', () => {
    expect(parseConsent(null)).toBeNull()
    expect(parseConsent('{oops')).toBeNull()
    expect(parseConsent(JSON.stringify({ v: CONSENT_VERSION, analytics: 'yes', at: 'x' }))).toBeNull()
    expect(parseConsent(JSON.stringify({ v: CONSENT_VERSION - 1, analytics: true, at: 'x' }))).toBeNull()
  })
})
