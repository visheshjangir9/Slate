'use client'

import type { ReactNode } from 'react'
import { useInView } from './useInView'

/** Rises into place the first time it scrolls into view. */
export function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const [ref, inView] = useInView<HTMLDivElement>({ once: true })
  return (
    <div ref={ref} className={`reveal ${className}`} data-in={inView === null ? undefined : String(inView)}
      style={{ ['--d' as string]: `${delay}ms` }}>
      {children}
    </div>
  )
}
