import { afterEach, describe, expect, it } from 'vitest'
import sitemap from '@/app/sitemap'
import robots from '@/app/robots'
import { pageMetadata } from '@/lib/metadata'
import { DISALLOWED_PATHS, PUBLIC_ROUTES, siteUrl } from '@/lib/site'

const ENV = { ...process.env }
afterEach(() => { process.env = { ...ENV } })

describe('site URL', () => {
  it('prefers NEXT_PUBLIC_SITE_URL, then the Vercel production domain, then the known address', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://slate.example/'
    expect(siteUrl()).toBe('https://slate.example')
    delete process.env.NEXT_PUBLIC_SITE_URL
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'slate.vercel.app'
    expect(siteUrl()).toBe('https://slate.vercel.app')
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL
    expect(siteUrl()).toMatch(/^https:\/\//)
  })
})

describe('sitemap.xml and robots.txt', () => {
  it('lists every public page once, with absolute URLs, and no private ones', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://slate.example'
    const urls = sitemap().map((e) => e.url)
    expect(urls).toContain('https://slate.example')
    expect(urls).toContain('https://slate.example/privacy')
    expect(urls).toContain('https://slate.example/terms')
    expect(new Set(urls).size).toBe(urls.length)
    expect(urls.some((u) => /\/(studio|assets|sign-in|api)/.test(u))).toBe(false)
  })

  it('robots.txt points at the sitemap and disallows private paths', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://slate.example'
    const r = robots()
    expect(r.sitemap).toBe('https://slate.example/sitemap.xml')
    expect(r.rules).toMatchObject({ userAgent: '*', allow: '/', disallow: DISALLOWED_PATHS })
  })

  it('no public route is also disallowed', () => {
    for (const r of PUBLIC_ROUTES) {
      expect(DISALLOWED_PATHS.some((d) => r.path !== '/' && r.path.startsWith(d))).toBe(false)
    }
  })
})

describe('page metadata', () => {
  it('sets title, description, canonical and matching social tags', () => {
    const m = pageMetadata({ title: 'Explore', description: 'd', path: '/explore' })
    expect(m.title).toBe('Explore')
    expect(m.alternates?.canonical).toBe('/explore')
    expect(m.openGraph).toMatchObject({ title: 'Explore — Slate', description: 'd', url: '/explore', siteName: 'Slate' })
    expect(m.twitter).toMatchObject({ card: 'summary_large_image', title: 'Explore — Slate' })
    expect(m.robots).toBeUndefined()
    expect(m.openGraph?.images).toEqual([expect.objectContaining({ url: '/og.jpg', width: 1200, height: 630 })])
  })

  it('marks private pages noindex and supports an absolute homepage title', () => {
    expect(pageMetadata({ title: 'Sign in', description: 'd', path: '/sign-in', noindex: true }).robots).toEqual({ index: false, follow: true })
    expect(pageMetadata({ title: 'Slate — X', absolute: true, description: 'd', path: '/' }).title).toEqual({ absolute: 'Slate — X' })
  })
})
