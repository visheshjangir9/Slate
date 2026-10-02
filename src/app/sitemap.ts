import type { MetadataRoute } from 'next'
import { PUBLIC_ROUTES, siteUrl } from '@/lib/site'

/** /sitemap.xml: every public, indexable page. Built once at build time. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl()
  const lastModified = new Date()
  return PUBLIC_ROUTES.map((r) => ({
    url: `${base}${r.path === '/' ? '' : r.path}`,
    lastModified,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }))
}
