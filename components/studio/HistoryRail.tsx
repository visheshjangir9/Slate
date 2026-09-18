'use client'

import { dimensionsFor } from '@/lib/engine'
import type { Generation } from '@/lib/generation/types'

const AGO = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

const DOT: Record<Generation['status'], string> = {
  queued: 'bg-ink-4',
  generating: 'bg-accent pulse-dot',
  completed: 'bg-success',
  failed: 'bg-danger',
}

export function HistoryRail({
  items, selectedId, onSelect, onDelete, loading, layout = 'rail',
}: {
  items: Generation[]
  selectedId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  loading: boolean
  layout?: 'rail' | 'strip'
}) {
  if (loading) {
    return (
      <div className={layout === 'rail' ? 'flex flex-col gap-2 p-3' : 'flex gap-2 p-3'}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 w-full min-w-40 animate-pulse rounded-card bg-surface-2" />
        ))}
      </div>
    )
  }

  if (!items.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1.5 p-6 text-center">
        <p className="text-xs font-medium text-ink-3">No renders yet</p>
        <p className="max-w-[16rem] text-[11px] leading-relaxed text-ink-4">
          Everything you generate is kept here on this device.
        </p>
      </div>
    )
  }

  return (
    <div
      className={
        layout === 'rail'
          ? 'flex flex-col gap-1.5 overflow-y-auto p-3'
          : 'flex gap-2 overflow-x-auto p-3'
      }
    >
      {items.map((g) => {
        const active = g.id === selectedId
        const dims = dimensionsFor(g.aspectRatio, g.resolution)
        return (
          <div
            key={g.id}
            className={[
              'group relative shrink-0 rounded-card border transition-all duration-150',
              layout === 'strip' ? 'w-56' : 'w-full',
              active ? 'border-line-strong bg-surface-2' : 'border-line bg-surface hover:border-line-strong',
            ].join(' ')}
          >
            <button
              type="button"
              onClick={() => onSelect(g.id)}
              className="flex w-full items-start gap-2.5 p-2.5 text-left"
            >
              <span
                className="relative w-14 shrink-0 overflow-hidden rounded bg-surface-3"
                style={{ aspectRatio: dims.width / dims.height }}
              >
                {g.posterUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.posterUrl} alt="" className="h-full w-full object-cover" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[g.status]}`} />
                  <span className="truncate text-xs text-ink-2">{g.prompt}</span>
                </span>
                <span className="tabular mt-1 block truncate text-[10px] text-ink-4">
                  {g.durationS}s &middot; {g.aspectRatio} &middot; {AGO(g.createdAt)}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => onDelete(g.id)}
              aria-label="Delete generation"
              className="absolute right-1.5 top-1.5 rounded p-1 text-ink-4 opacity-0 transition-opacity
                duration-150 hover:bg-surface-3 hover:text-ink-2 group-hover:opacity-100 focus-visible:opacity-100"
            >
              <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
                <path d="M3 3 L9 9 M9 3 L3 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )
      })}
    </div>
  )
}
