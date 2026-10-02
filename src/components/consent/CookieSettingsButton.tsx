'use client'

import { openCookieSettings } from '@/lib/client/consent'

/** "Cookie settings": reopens the consent banner so the choice can change. */
export function CookieSettingsButton({ className = '', label = 'Cookie settings' }: { className?: string; label?: string }) {
  return (
    <button type="button" onClick={openCookieSettings} className={className}>
      {label}
    </button>
  )
}
