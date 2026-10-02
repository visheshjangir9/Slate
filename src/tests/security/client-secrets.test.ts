import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Secrets stay off the front end.
 *
 * Next inlines any NEXT_PUBLIC_* variable into the browser bundle, and a
 * client component that reads process.env ships whatever it reads. These
 * checks fail the build's test step before either can happen.
 */
const SRC = join(__dirname, '../..')

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return e.name === 'tests' ? [] : files(p)
    return /\.(ts|tsx)$/.test(e.name) ? [p] : []
  })
}

const sources = files(SRC).map((p) => ({ path: relative(SRC, p), text: readFileSync(p, 'utf8') }))
const isClient = (text: string) => /^\s*['"]use client['"]/.test(text)

describe('secrets stay on the server', () => {
  it('no client component reads process.env (beyond NODE_ENV)', () => {
    const offenders = sources
      .filter((f) => isClient(f.text))
      .filter((f) => /process\.env\.(?!NODE_ENV\b)\w+/.test(f.text))
      .map((f) => f.path)
    expect(offenders).toEqual([])
  })

  it('no client component imports a server-only module', () => {
    const offenders = sources
      .filter((f) => isClient(f.text))
      .filter((f) => /from ['"](server-only|@\/lib\/env|@\/lib\/device|@\/lib\/auth\/server|@\/lib\/store[^'"]*)['"]/.test(f.text))
      .map((f) => f.path)
    expect(offenders).toEqual([])
  })

  it('every module that reads a secret is marked server-only', () => {
    const SECRET = /process\.env\.(\w*(SECRET|API_KEY|API_TOKEN|SERVICE_ROLE)\w*)/
    const offenders = sources
      .filter((f) => SECRET.test(f.text) && !/import ['"]server-only['"]/.test(f.text))
      .map((f) => `${f.path}: ${f.text.match(SECRET)![1]}`)
    expect(offenders).toEqual([])
  })

  it('no NEXT_PUBLIC_ variable is named like a secret', () => {
    const names = new Set(sources.flatMap((f) => f.text.match(/NEXT_PUBLIC_\w+/g) ?? []))
    // The Supabase anon key is public by design; anything else secret-shaped is a leak.
    const leaks = [...names].filter((n) => /SECRET|SERVICE_ROLE|PRIVATE|TOKEN|API_KEY/.test(n))
    expect(leaks).toEqual([])
  })
})
