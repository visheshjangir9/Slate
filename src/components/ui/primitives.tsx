'use client'

import Link from 'next/link'
import {
  useCallback, useEffect, useId, useRef, useState,
  type ButtonHTMLAttributes, type ComponentProps, type MouseEvent, type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { IconClose } from './icons'

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

import { buttonClass, type Size, type Variant } from './button'

export { buttonClass }

export function Button({
  variant = 'secondary', size = 'md', className = '', ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...rest} />
}

export function ButtonLink({
  variant = 'secondary', size = 'md', className = '', ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />
}

/* ------------------------------------------------------------------ */
/* Labels and tags                                                     */
/* ------------------------------------------------------------------ */

export function FieldLabel({
  children, hint, htmlFor,
}: { children: ReactNode; hint?: ReactNode; htmlFor?: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-2">
      <label htmlFor={htmlFor} className="eyebrow text-ink-3">{children}</label>
      {hint && <span className="tabular text-[11px] text-ink-4">{hint}</span>}
    </div>
  )
}

type Tone = 'live' | 'catalogue' | 'signal' | 'neutral' | 'danger'
const TONE: Record<Tone, string> = {
  live: 'border-live/40 text-live',
  catalogue: 'border-line-strong text-ink-3',
  signal: 'border-signal/50 text-signal',
  neutral: 'border-line-strong text-ink-2',
  danger: 'border-danger/45 text-danger',
}

/** Status tag. Only for facts a user can act on: LIVE, CATALOGUE, VIDEO, FAILED. */
export function Tag({
  children, tone = 'neutral', dot = false, onMedia = false,
}: { children: ReactNode; tone?: Tone; dot?: boolean; onMedia?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-[3px] border px-1.5 py-[2px]
      font-mono text-[10px] font-medium uppercase leading-none tracking-[0.1em] ${TONE[tone]}
      ${onMedia ? 'bg-ground/85' : ''}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

/** A row of monospaced technical values. */
export function Spec({ items, className = '' }: { items: (ReactNode | null | false)[]; className?: string }) {
  return (
    <div className={`tabular flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-3 ${className}`}>
      {items.filter(Boolean).map((it, i) => <span key={i}>{it}</span>)}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Segmented control                                                   */
/* ------------------------------------------------------------------ */

export function Segmented<T extends string>({
  value, options, onChange, render, disabled, label, size = 'md',
}: {
  value: T
  options: readonly T[]
  onChange: (v: T) => void
  render?: (v: T) => ReactNode
  disabled?: (v: T) => boolean
  label?: string
  size?: 'sm' | 'md'
}) {
  return (
    <div role="radiogroup" aria-label={label}
      className="flex gap-0.5 rounded-[var(--radius-ctl)] border border-line bg-ground p-0.5">
      {options.map((o) => {
        const active = o === value
        const off = disabled?.(o) ?? false
        return (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={off}
            onClick={() => onChange(o)}
            className={[
              'tabular flex-1 rounded-[4px] transition-colors duration-150',
              size === 'sm' ? 'px-1.5 py-1 text-[11px]' : 'px-2 py-1.5 text-xs',
              active ? 'bg-surface-3 text-ink' : 'text-ink-3 hover:bg-surface-2 hover:text-ink',
              off && 'cursor-not-allowed opacity-35 hover:bg-transparent',
            ].filter(Boolean).join(' ')}
          >
            {render ? render(o) : o}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Popover: small anchored panel for a single setting                  */
/* ------------------------------------------------------------------ */

export function Popover({
  trigger, children, align = 'left', width = 260, label,
}: {
  trigger: (p: { open: boolean; toggle: (e: MouseEvent<HTMLElement>) => void; id: string }) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'left' | 'right'
  width?: number
  label: string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; bottom: number; width: number } | null>(null)
  const anchor = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const id = useId()

  // Rendered in a portal and positioned against the viewport, so a scrolling
  // parent (the composer rail) can never clip it.
  // Measured from the clicked trigger, so nothing is read during render.
  const toggle = useCallback((e: MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const w = Math.min(width, window.innerWidth - 16)
    const raw = align === 'right' ? r.right - w : r.left
    setPos({ left: Math.max(8, Math.min(raw, window.innerWidth - w - 8)), bottom: window.innerHeight - r.top + 8, width: w })
    setOpen((v) => !v)
  }, [align, width])

  useEffect(() => {
    if (!open) return
    const down = (e: globalThis.MouseEvent) => {
      const t = e.target as Node
      if (!anchor.current?.contains(t) && !panel.current?.contains(t)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const move = () => setOpen(false)
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    window.addEventListener('resize', move)
    window.addEventListener('scroll', move, true)
    return () => {
      document.removeEventListener('mousedown', down)
      document.removeEventListener('keydown', key)
      window.removeEventListener('resize', move)
      window.removeEventListener('scroll', move, true)
    }
  }, [open])

  return (
    <div ref={anchor} className="relative">
      {trigger({ open, toggle, id })}
      {open && pos && createPortal(
        <div
          ref={panel}
          id={id}
          role="dialog"
          aria-label={label}
          style={{ position: 'fixed', left: pos.left, bottom: pos.bottom, width: pos.width }}
          className="rise z-[60] rounded-card border border-line-strong bg-surface p-3 shadow-2xl shadow-black/70"
        >
          {children(() => setOpen(false))}
        </div>,
        document.body,
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sheet: modal panel (bottom sheet on phones, centred on desktop)     */
/* ------------------------------------------------------------------ */

export function Sheet({
  open, onClose, title, children, wide = false, action,
}: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean; action?: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', key)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = prev }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/70" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`rise relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-xl border
          border-line-strong bg-surface shadow-2xl shadow-black/70 outline-none sm:rounded-xl
          ${wide ? 'sm:max-w-4xl' : 'sm:max-w-lg'}`}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action && <div className="ml-auto">{action}</div>}
          <button type="button" onClick={onClose} aria-label="Close"
            className={`rounded p-1 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink ${action ? '' : 'ml-auto'}`}>
            <IconClose />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Drawer: non-modal side panel. The page stays scrollable and usable. */
/* ------------------------------------------------------------------ */

/**
 * For workspaces the user moves in and out of (configuration), not for
 * decisions that must block: no backdrop, no scroll lock, no focus trap.
 * Esc closes it only while focus is inside it, so Esc elsewhere on the page
 * keeps doing what it normally does.
 */
export function Drawer({
  open, onClose, title, children, action,
}: { open: boolean; onClose: () => void; title: string; children: ReactNode; action?: ReactNode }) {
  const panel = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open) return
    panel.current?.focus()
  }, [open])

  if (!open) return null
  return (
    <aside
      ref={panel}
      role="dialog"
      aria-modal="false"
      aria-label={title}
      tabIndex={-1}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }}
      className="rise fixed inset-x-0 bottom-0 z-40 flex max-h-[78dvh] flex-col rounded-t-xl border border-line-strong bg-surface
        shadow-2xl shadow-black/70 outline-none sm:inset-x-auto sm:bottom-0 sm:right-0 sm:top-14 sm:max-h-none sm:w-[440px]
        sm:rounded-none sm:border-y-0 sm:border-r-0"
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-line px-5 py-3.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action && <div className="ml-auto">{action}</div>}
        <button type="button" onClick={onClose} aria-label={`Close ${title}`}
          className={`rounded p-1 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink ${action ? '' : 'ml-auto'}`}>
          <IconClose />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </aside>
  )
}
