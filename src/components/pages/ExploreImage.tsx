'use client'

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
  file, alt, className = '', priority = false,
}: { file: string; alt: string; className?: string; priority?: boolean }) {
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

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/explore/${file}`}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      onError={() => setFailed(true)}
      className={`h-full w-full object-cover ${className}`}
    />
  )
}
