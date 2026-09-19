'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { generationManager } from '@/lib/client/generationManager'

/**
 * Global render indicator.
 *
 * The pipeline runs outside React and survives navigation, so a render started
 * in Studio keeps going while you browse Explore or Assets. This makes that
 * visible everywhere, with a real cancel -- otherwise work would continue with
 * no way to see or stop it.
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
  const queued = Math.max(0, snap.pending.length - 1)

  return (
    <div className="flex items-center gap-2 rounded-md border border-accent-dim bg-surface px-2 py-1.5">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent pulse-dot" />
      <Link href="/studio" className="text-[11px] text-ink-2 hover:text-ink">
        Rendering <span className="tabular text-accent">{pct}%</span>
        {queued > 0 && <span className="tabular text-ink-4"> +{queued}</span>}
      </Link>
      <button
        type="button"
        onClick={() => void generationManager.cancel(active)}
        className="rounded px-1 text-[10px] uppercase tracking-[0.06em] text-ink-4
          transition-colors duration-150 hover:text-danger"
        title="Cancel this render"
      >
        Cancel
      </button>
    </div>
  )
}
