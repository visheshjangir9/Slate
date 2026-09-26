'use client'

import type { Generation, GenerationStatus } from '@/lib/generation/types'
import { kindOfModel } from '@/lib/catalog'
import { timeAgo } from '@/lib/format'
import { IconImage, IconPlay, IconTrash, IconVideo } from '@/components/ui/icons'
import { aspectOf } from './Stage'

const STATUS: Record<GenerationStatus, { dot: string; label: string }> = {
  queued: { dot: 'bg-ink-4', label: 'Queued' },
  generating: { dot: 'bg-signal pulse-dot', label: 'Rendering' },
  completed: { dot: 'bg-live', label: 'Ready' },
  failed: { dot: 'bg-danger', label: 'Failed' },
}

/** The thumbnail cell: a fixed box, with the media sized to its real ratio inside it. */
const CELL_W = 88
const CELL_H = 64

/**
 * A thumbnail that keeps the asset's real aspect ratio: a portrait image stays
 * portrait, a 21:9 clip stays letterboxed wide. It is fitted inside a fixed
 * cell, so rows align, and never cropped to a different shape.
 */
function Thumb({ g }: { g: Generation }) {
  const aspect = aspectOf(g)
  const w = aspect >= CELL_W / CELL_H ? CELL_W : Math.round(CELL_H * aspect)
  const h = aspect >= CELL_W / CELL_H ? Math.round(CELL_W / aspect) : CELL_H
  const isVideo = kindOfModel(g.model) === 'video'
  const still = isVideo ? g.posterUrl : g.outputUrl ?? g.posterUrl

  return (
    <span className="flex shrink-0 items-center justify-center rounded-[4px] bg-[#0e0e0f]" style={{ width: CELL_W, height: CELL_H }}>
      <span className="relative overflow-hidden rounded-[3px] bg-surface-3 ring-1 ring-white/5" style={{ width: w, height: h }}>
        {still ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={still} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : isVideo && g.status === 'completed' && g.outputUrl ? (
          // No poster (e.g. a provider video): the clip's own first frame.
          <video src={g.outputUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-ink-4">
            {g.status === 'failed' ? '—' : <span className="h-1.5 w-1.5 rounded-full bg-signal pulse-dot" />}
          </span>
        )}
        {isVideo && (still || (g.status === 'completed' && g.outputUrl)) && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0c0c0d]/70 text-ink"><IconPlay size={10} /></span>
          </span>
        )}
      </span>
    </span>
  )
}

/**
 * Everything this account has made in the open workflow, as a compact media
 * list. Selecting an item restores that real result to the stage; nothing is
 * ever loaded onto the stage unasked.
 */
export function HistoryRail({
  items, currentId, onOpen, onDelete, loading, kind, compact = false,
}: {
  items: Generation[]
  currentId: string | null
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  loading: boolean
  kind: 'video' | 'image'
  /** The modal variant sizes to its content instead of filling a column. */
  compact?: boolean
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-1.5 p-2">
        {[0, 1, 2].map((i) => <div key={i} className="h-[76px] animate-pulse rounded-[6px] bg-surface-2" />)}
      </div>
    )
  }

  if (!items.length) {
    return (
      <div className={`flex flex-col items-center justify-center gap-1.5 px-6 text-center ${compact ? 'py-10' : 'h-full py-10'}`}>
        <span className="mb-1 text-ink-4">{kind === 'image' ? <IconImage size={20} /> : <IconVideo size={20} />}</span>
        <p className="text-[13px] font-medium text-ink-2">No {kind === 'image' ? 'images' : 'clips'} yet</p>
        <p className="max-w-[16rem] text-xs leading-relaxed text-ink-3">
          What you generate here appears in this list and in Assets.
        </p>
      </div>
    )
  }

  return (
    <ul className={`flex flex-col gap-1 p-2 ${compact ? '' : 'h-full overflow-y-auto'}`}>
      {items.map((g) => {
        const active = g.id === currentId
        const st = STATUS[g.status]
        const isVideo = kindOfModel(g.model) === 'video'
        return (
          <li key={g.id} className={`group relative rounded-[6px] transition-colors duration-150
            ${active ? 'bg-surface-3 ring-1 ring-signal/60' : 'hover:bg-surface-2'}`}>
            <button type="button" onClick={() => onOpen(g.id)} aria-current={active ? 'true' : undefined}
              className="flex w-full items-center gap-3 p-1.5 pr-8 text-left">
              <Thumb g={g} />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-[13px] leading-snug text-ink">{g.prompt}</span>
                <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="inline-flex items-center gap-1 rounded-[3px] border border-line-strong px-1 py-px font-mono text-[9px]
                    uppercase tracking-[0.1em] text-ink-2">
                    {isVideo ? <IconVideo size={10} /> : <IconImage size={10} />}{isVideo ? `Video · ${g.durationS}s` : 'Image'}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                    <span className={`text-[11px] ${g.status === 'failed' ? 'text-danger' : 'text-ink-3'}`}>{st.label}</span>
                  </span>
                  <span className="tabular text-[11px] text-ink-3">{g.aspectRatio}</span>
                  <span className="tabular text-[11px] text-ink-4">{timeAgo(g.createdAt)}</span>
                </span>
              </span>
            </button>
            <button type="button" onClick={() => onDelete(g.id)} aria-label={`Delete: ${g.prompt.slice(0, 40)}`}
              className="absolute right-1.5 top-1.5 rounded p-1 text-ink-3 opacity-0 transition-opacity duration-150
                hover:bg-surface-3 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100">
              <IconTrash size={13} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
