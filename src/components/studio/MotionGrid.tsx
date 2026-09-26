'use client'

import { useState } from 'react'
import { MOTIONS } from '@/lib/engine/motion'
import type { MotionId } from '@/lib/engine/types'
import { MotionPreview } from './MotionPreview'

/**
 * Every real camera move as a tile. Tiles animate on hover (and the selected
 * one always), through the same transform the encoder uses. Idle tiles hold
 * a still frame so fifteen canvases are not all running at once.
 */
export function MotionGrid({
  value, onChange, source, aspect = 16 / 9, columns = 3,
}: {
  value: MotionId
  onChange: (id: MotionId) => void
  source: HTMLImageElement | null
  aspect?: number
  columns?: 2 | 3 | 4 | 5
}) {
  const [hover, setHover] = useState<MotionId | null>(null)
  const cols = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-3 sm:grid-cols-4', 5: 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-5' }[columns]

  return (
    <div role="radiogroup" aria-label="Camera move" className={`grid gap-1.5 ${cols}`}>
      {MOTIONS.map((m) => {
        const active = m.id === value
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(m.id)}
            onMouseEnter={() => setHover(m.id)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(m.id)}
            onBlur={() => setHover(null)}
            title={m.description}
            className={[
              'group overflow-hidden rounded-[5px] border text-left transition-colors duration-150',
              active ? 'border-signal' : 'border-line hover:border-line-strong',
            ].join(' ')}
          >
            <span className="relative block overflow-hidden bg-surface-2" style={{ aspectRatio: aspect }}>
              <MotionPreview motion={m.id} source={source} aspect={aspect} longEdge={240}
                playing={active || hover === m.id} label={`${m.label} preview`} />
            </span>
            <span className={`block truncate px-1.5 py-1 text-[11px] ${active ? 'bg-signal/10 text-ink' : 'text-ink-2'}`}>
              {m.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
