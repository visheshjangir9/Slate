'use client'

import Image from 'next/image'
import { useState } from 'react'

/**
 * Static Explore artwork.
 *
 * Explore deliberately makes no live image API calls -- browsing must be
 * instant and free. Until the real files land in /public/explore, a missing
 * asset renders an unmistakable pending marker rather than anything that could
 * be mistaken for generated output.
 */
export function ExploreImage({
  file, alt, className = '', priority = false, sizes = '(min-width: 1536px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw',
}: {
  file: string
  alt: string
  className?: string
  /** The page's largest image: fetched eagerly with high priority. */
  priority?: boolean
  /** How wide the image is drawn at each breakpoint, so the browser picks the smallest file that is still sharp. */
  sizes?: string
}) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div
        className={`flex h-full w-full flex-col items-center justify-center gap-1.5
          bg-[repeating-linear-gradient(45deg,var(--color-surface-2)_0_10px,var(--color-surface)_10px_20px)]
          ${className}`}
        role="img"
        aria-label={`Artwork pending: ${alt}`}
      >
        <span className="rounded border border-line-strong bg-ground/80 px-2 py-1
          text-[10px] font-medium uppercase tracking-[0.1em] text-ink-3">
          Asset pending
        </span>
        <span className="tabular px-3 text-center text-[10px] text-ink-4">{file}</span>
      </div>
    )
  }

  // Resized and re-encoded (WebP) per screen by the image optimizer; the
  // container is always positioned and sized, so `fill` never shifts layout.
  return (
    <Image
      src={`/explore/${file}`}
      alt={alt}
      fill
      sizes={sizes}
      preload={priority}
      loading={priority ? 'eager' : 'lazy'}
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  )
}
