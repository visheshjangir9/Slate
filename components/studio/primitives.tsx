'use client'

import type { ReactNode } from 'react'

export function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between">
      <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-ink-3">{children}</span>
      {hint && <span className="tabular text-[11px] text-ink-4">{hint}</span>}
    </div>
  )
}

export function Badge({
  children, tone = 'neutral',
}: { children: ReactNode; tone?: 'neutral' | 'accent' | 'danger' | 'success' }) {
  const tones = {
    neutral: 'border-line text-ink-3',
    accent: 'border-accent-dim text-accent',
    danger: 'border-danger/40 text-danger',
    success: 'border-success/40 text-success',
  }
  return (
    <span className={`rounded border px-1.5 py-px text-[10px] font-medium uppercase tracking-[0.08em] ${tones[tone]}`}>
      {children}
    </span>
  )
}

/** Segmented control. Used for every small enumerated setting. */
export function Segmented<T extends string>({
  value, options, onChange, render,
}: {
  value: T
  options: readonly T[]
  onChange: (v: T) => void
  render?: (v: T) => ReactNode
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-surface p-1 hairline">
      {options.map((o) => {
        const active = o === value
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            aria-pressed={active}
            className={[
              'tabular flex-1 rounded-md px-2 py-1.5 text-xs transition-colors duration-150',
              active
                ? 'bg-surface-3 text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                : 'text-ink-3 hover:text-ink-2 hover:bg-surface-2',
            ].join(' ')}
          >
            {render ? render(o) : o}
          </button>
        )
      })}
    </div>
  )
}

export function Slider({
  value, min, max, onChange, suffix = '',
}: { value: number; min: number; max: number; onChange: (n: number) => void; suffix?: string }) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-full cursor-pointer appearance-none rounded-full outline-none
          [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-ink [&::-webkit-slider-thumb]:transition-transform
          [&::-webkit-slider-thumb]:hover:scale-110"
        style={{
          background: `linear-gradient(90deg, var(--color-accent) ${pct}%, var(--color-line) ${pct}%)`,
        }}
      />
      <span className="tabular w-10 shrink-0 text-right text-xs text-ink-2">
        {value}{suffix}
      </span>
    </div>
  )
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-card border border-line bg-surface ${className}`}>{children}</div>
  )
}
