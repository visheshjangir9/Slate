import type { Metadata } from 'next'
import { SITE } from './site'

/**
 * Per-page metadata with matching search and social tags.
 *
 * Next merges `openGraph` and `twitter` shallowly, so a page that set only a
 * title there would drop the site name and card type. This always sets the
 * full group, share image included (SITE.ogImage).
 */
export function pageMetadata({
  title, description, path, noindex = false, absolute = false,
}: {
  /** Page name; the root layout's template appends "— Slate". */
  title: string
  /** Use `title` exactly as given, without the template (the homepage). */
  absolute?: boolean
  description: string
  /** Canonical path, e.g. "/explore". */
  path: string
  /** Account-only and utility pages: keep them out of search results. */
  noindex?: boolean
}): Metadata {
  const full = absolute ? title : `${title} — ${SITE.name}`
  return {
    title: absolute ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', siteName: SITE.name, locale: 'en_US', title: full, description, url: path, images: [SITE.ogImage] },
    twitter: { card: 'summary_large_image', title: full, description, images: [SITE.ogImage] },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  }
}
