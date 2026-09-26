'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Whether an element is on screen. Starts as `null` (unknown), which callers
 * treat as visible, so server-rendered content is never hidden if JavaScript
 * does not run. State is only set from the observer callback.
 */
export function useInView<T extends Element>(opts: { once?: boolean; margin?: string } = {}) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState<boolean | null>(null)
  const { once = false, margin = '0px 0px -12% 0px' } = opts

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting)
      if (once && entry.isIntersecting) io.disconnect()
    }, { rootMargin: margin })
    io.observe(el)
    return () => io.disconnect()
  }, [once, margin])

  return [ref, inView] as const
}
