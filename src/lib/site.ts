/**
 * Public facts about the site: its address, name and indexable pages.
 *
 * Read by metadata, the sitemap, robots.txt and the legal pages, so the
 * canonical URL is defined once. Nothing here is secret.
 */

const FALLBACK_URL = 'https://slate-tawny-one.vercel.app'

/**
 * The canonical origin, without a trailing slash. NEXT_PUBLIC_SITE_URL wins;
 * on Vercel the project's production domain is used; otherwise the known
 * production address, so canonical links never point at a preview build.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
  const raw = explicit || (vercel ? `https://${vercel}` : FALLBACK_URL)
  return raw.replace(/\/+$/, '')
}

export const SITE = {
  name: 'Slate',
  tagline: 'AI video, image and camera motion',
  description:
    'Slate is a creative studio for AI video and images. Write the shot, choose a real camera move, and keep every render in your library.',
  /** Shown on the legal pages. Update both dates whenever either page changes. */
  legalUpdated: '2 October 2026',
  contactEmail: 'visheshjangir026@gmail.com',
  owner: 'Vishesh Jangir',
  /** The social preview card, made by scripts/generate-og-image.mjs. */
  ogImage: {
    url: '/og.jpg',
    width: 1200,
    height: 630,
    alt: 'Slate: Imagine. Create. Move. AI video, images and real camera motion in one studio.',
  },
}

export interface PublicRoute {
  path: string
  changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  priority: number
}

/**
 * Pages a search engine should index. Account-only routes (/studio, /assets)
 * and the sign-in form are deliberately absent: they are disallowed in
 * robots.txt and marked noindex.
 */
export const PUBLIC_ROUTES: PublicRoute[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/explore', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/motion', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/byok', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/developers', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/contact', changeFrequency: 'yearly', priority: 0.5 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
]

/** Prefixes crawlers are asked to skip: private, per-user or machine-only. */
export const DISALLOWED_PATHS = ['/api/', '/studio', '/assets', '/sign-in', '/login']
