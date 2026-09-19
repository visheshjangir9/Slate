'use client'

import { useEffect } from 'react'
import { generationManager } from './generationManager'

/**
 * Warn before a full page unload while a render is in flight.
 *
 * Route changes are safe -- the manager lives outside React and keeps going.
 * A real unload is not: the encoder dies with the page, and the job would be
 * swept to failed. The browser's own dialog is the only honest guard here,
 * since a page unload cannot be intercepted with custom UI.
 */
export function useUnloadGuard(): void {
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!generationManager.hasWork) return
      e.preventDefault()
      // Browsers show their own wording; returnValue is required by older ones.
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])
}
