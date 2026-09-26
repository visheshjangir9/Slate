import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { byokStore } from '@/lib/client/byok'
import { signOut } from '@/lib/client/auth'
import { createSubmitGuard } from '@/lib/client/submitGuard'
import { FAKE_GOOGLE_KEY } from '@/tests/fixtures'

const config = (userId: string) => ({
  userId, providerId: 'google' as const, model: 'gemini-2.5-flash-image',
  models: [{ id: 'gemini-2.5-flash-image', label: 'Nano Banana', capabilities: ['textToImage' as const], runs: { image: { aspectRatios: ['1:1' as const], quality: false, output: 'PNG' } } }],
})

afterEach(() => { byokStore.clear(); vi.unstubAllGlobals() })

describe('the in-tab key store', () => {
  it('never exposes the key through the snapshot components render from', () => {
    byokStore.activate(config('a'), FAKE_GOOGLE_KEY)
    expect(JSON.stringify(byokStore.getSnapshot())).not.toContain(FAKE_GOOGLE_KEY)
  })

  it('hands the key out only for the matching provider, as a request body with no user settings', () => {
    byokStore.activate(config('a'), FAKE_GOOGLE_KEY)
    expect(byokStore.credentialBody('google')).toEqual({ credential: { providerId: 'google', apiKey: FAKE_GOOGLE_KEY } })
    expect(byokStore.credentialBody('openai')).toBeNull()
  })

  it('drops the key when the session ends or switches to another account', () => {
    byokStore.activate(config('a'), FAKE_GOOGLE_KEY)
    byokStore.keepOnlyFor('a')
    expect(byokStore.credentialBody('google')).not.toBeNull()
    byokStore.keepOnlyFor('b') // user B signed in: A's key is gone before B can use it
    expect(byokStore.getSnapshot()).toBeNull()
    expect(byokStore.credentialBody('google')).toBeNull()

    byokStore.activate(config('a'), FAKE_GOOGLE_KEY)
    byokStore.keepOnlyFor(null) // signed out
    expect(byokStore.credentialBody('google')).toBeNull()
  })

  it('Sign Out clears the key before the logout request is even sent', async () => {
    byokStore.activate(config('a'), FAKE_GOOGLE_KEY)
    let keyAtLogout: unknown = 'unset'
    vi.stubGlobal('fetch', vi.fn(async () => {
      keyAtLogout = byokStore.credentialBody('google')
      return new Response('{}', { status: 200 })
    }))
    const assign = vi.fn()
    vi.stubGlobal('window', { location: { assign } })
    await signOut()
    expect(keyAtLogout).toBeNull()
    expect(byokStore.getSnapshot()).toBeNull()
    expect(assign).toHaveBeenCalled() // full reload: nothing in memory survives
  })

  it('a refresh loses the key: it lives only in module memory, never in storage', async () => {
    byokStore.activate(config('a'), FAKE_GOOGLE_KEY)
    vi.resetModules()
    const fresh = await import('@/lib/client/byok') // what a page load sees
    expect(fresh.byokStore.getSnapshot()).toBeNull()
    expect(fresh.byokStore.credentialBody('google')).toBeNull()

    // And there is no code path that could persist it.
    const src = readFileSync(join(process.cwd(), 'src/lib/client/byok.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
    expect(src).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB|history\.|location\./)
  })
})

describe('duplicate submission', () => {
  it('a double click starts one job, not two', async () => {
    const guard = createSubmitGuard()
    let calls = 0
    let release: () => void = () => {}
    const job = () => { calls++; return new Promise<void>((r) => { release = r }) }
    const first = guard.run(job)
    const second = guard.run(job) // second click while the first is in flight
    expect(calls).toBe(1)
    expect(await second).toBeUndefined()
    release()
    await first
    await guard.run(async () => { calls++ }) // after it settles, a new click works
    expect(calls).toBe(2)
  })

  it('releases after a failure, so the next click can try again', async () => {
    const guard = createSubmitGuard()
    await guard.run(async () => { throw new Error('boom') }).catch(() => {})
    expect(guard.busy).toBe(false)
  })
})
