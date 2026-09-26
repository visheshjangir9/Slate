'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { generationManager } from '@/lib/client/generationManager'

/**
 * Global render indicator.
 *
 * The pipeline runs outside React and survives navigation, so a render started
 * in Studio keeps going while you browse Explore or Assets. This makes that
 * visible everywhere, with a real cancel.
 */
export function RenderIndicator() {
  const snap = useSyncExternalStore(
    generationManager.subscribe,
    generationManager.getSnapshot,
    generationManager.getServerSnapshot,
  )

  const active = snap.pending[snap.pending.length - 1]
  if (!active) return null

  const run = snap.runs[active]
  const pct = run ? Math.round(run.progress) : 0
  const STAGE: Record<string, string> = { image: run?.kind === 'image' ? 'generating' : 'frame', render: 'generating', encode: 'encoding', upload: 'saving' }
  const queued = Math.max(0, snap.pending.length - 1)
  const href = run?.kind === 'image' ? '/studio/image' : '/studio'

  return (
    <div className="flex h-8 items-center gap-2 rounded-[var(--radius-ctl)] border border-signal/40 bg-surface pl-2.5 pr-1">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-signal pulse-dot" />
      <Link href={href} className="text-[11px] text-ink-2 hover:text-ink">
        {run?.kind === 'image' ? 'Image' : 'Rendering'}{' '}
        <span className="tabular text-signal">{!run ? 'queued' : run.measurable ? `${pct}%` : STAGE[run.stage]}</span>
        {queued > 0 && <span className="tabular text-ink-3"> +{queued}</span>}
      </Link>
      <button type="button" onClick={() => void generationManager.cancel(active)} title="Cancel this render"
        className="rounded px-1.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-3
          transition-colors duration-150 hover:text-danger">
        Cancel
      </button>
    </div>
  )
}
