/**
 * Button styling, as a plain module so server components can use it too.
 */
export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'contrast'
export type Size = 'sm' | 'md' | 'lg'

const VARIANT: Record<Variant, string> = {
  // The signal fill is the 10%: one primary action per view.
  primary:
    'bg-signal text-ground hover:bg-signal-hi disabled:bg-surface-3 disabled:text-ink-4',
  secondary:
    'border border-line-strong bg-surface text-ink hover:border-ink-4 hover:bg-surface-2 disabled:text-ink-4 disabled:border-line',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink disabled:text-ink-4',
  danger: 'border border-danger/40 text-danger hover:bg-danger/10',
  // Light on dark; inverts on hover so the contrast visibly flips.
  contrast:
    'border border-ink bg-ink text-ground hover:bg-ground hover:text-ink disabled:opacity-40',
}
const SIZE: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-3 text-xs',
  md: 'h-10 gap-2 px-4 text-[13px]',
  lg: 'h-12 gap-2 px-5 text-sm',
}

export const buttonClass = (variant: Variant = 'secondary', size: Size = 'md', extra = '') =>
  [
    'inline-flex shrink-0 items-center justify-center rounded-[var(--radius-ctl)] font-medium',
    'transition-colors duration-150 disabled:cursor-not-allowed',
    VARIANT[variant], SIZE[size], extra,
  ].join(' ')

