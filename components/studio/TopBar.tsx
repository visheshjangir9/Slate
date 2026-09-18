'use client'

import type { Catalog } from '@/lib/client/api'
import { Badge } from './primitives'

export function TopBar({
  catalog, historyCount, onOpenHistory,
}: {
  catalog: Catalog | null
  historyCount?: number
  onOpenHistory?: () => void
}) {
  const engine = catalog?.engines[0]
  const durable = catalog?.persistence.durable

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4 sm:px-5">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          {/* Clapper mark: two bars at a slate angle. */}
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden className="text-accent">
            <rect x="1.5" y="6" width="17" height="12" rx="2" fill="currentColor" opacity="0.18" />
            <rect x="1.5" y="6" width="17" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" fill="none" />
            <path d="M2 6.5 L6.5 2.2 L9.5 2.2 L5 6.5 Z" fill="currentColor" />
            <path d="M8 6.5 L12.5 2.2 L15.5 2.2 L11 6.5 Z" fill="currentColor" />
          </svg>
          <span className="text-[15px] font-semibold tracking-[-0.01em]">Slate</span>
        </div>
        <span className="hidden text-xs text-ink-4 sm:inline">Cinematic AI video</span>
      </div>

      <div className="flex items-center gap-2">
        {engine && (
          <span className="hidden items-center gap-1.5 md:flex">
            <Badge tone="accent">{engine.label}</Badge>
          </span>
        )}
        {catalog && !durable && (
          <span title="History is kept in server memory and will not survive a restart">
            <Badge tone="danger">Ephemeral storage</Badge>
          </span>
        )}
        {/* Below lg the history lives in a sheet. Triggered here rather than from a
            floating button, which would sit on top of the Generate action. */}
        {onOpenHistory && (
          <button
            type="button"
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5
              text-xs text-ink-2 transition-colors duration-150 hover:border-line-strong hover:text-ink lg:hidden"
          >
            History
            {historyCount ? <span className="tabular text-ink-4">{historyCount}</span> : null}
          </button>
        )}
      </div>
    </header>
  )
}
