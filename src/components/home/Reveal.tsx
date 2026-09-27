'use client'

import type { ReactNode } from 'react'
import { useInView } from './useInView'

/** Rises into place the first time it scrolls into view. */
export function Reveal({ children, delay = 0, className = '', variant }: {
  children: ReactNode; delay?: number; className?: string
  /** head: parts arrive in order (rv-bar, rv-title, rv-aside). media: curtain wipe with the photo settling. */
  variant?: 'head' | 'media'
}) {
  const [ref, inView] = useInView<HTMLDivElement>({ once: true })
  return (
    <div ref={ref} className={`reveal ${className}`} data-in={inView === null ? undefined : String(inView)} data-variant={variant}
      style={{ ['--d' as string]: `${delay}ms` }}>
      {children}
    </div>
  )
}
