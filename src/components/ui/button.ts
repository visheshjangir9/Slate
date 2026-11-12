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
    'border border-white/[.17] bg-white/[.045] text-ink shadow-[inset_0_1px_0_rgba(255,255,255,.07)] backdrop-blur-md ' +
    'hover:border-white/35 hover:bg-white/[.085] disabled:text-ink-4 disabled:border-line',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink disabled:text-ink-4',
  danger: 'border border-danger/40 text-danger hover:bg-danger/10',
  // The silver face: a lit top edge and a soft drop, lifting a pixel on hover.
  contrast:
    'bg-[linear-gradient(180deg,#ffffff_0%,#dededb_100%)] text-ground ' +
    'shadow-[inset_0_1px_0_#fff,inset_0_-1px_0_rgba(0,0,0,.12),0_10px_30px_-8px_rgba(0,0,0,.6),0_0_0_1px_rgba(255,255,255,.12)] ' +
    'hover:-translate-y-px hover:brightness-[1.04] active:translate-y-0 active:scale-[.985] disabled:opacity-40',
}
const SIZE: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-3.5 text-[13px]',
  md: 'h-10 gap-2 px-4 text-[14px]',
  lg: 'h-12 gap-2.5 rounded-[12px] px-[22px] text-[15px]',
}

export const buttonClass = (variant: Variant = 'secondary', size: Size = 'md', extra = '') =>
  [
    'inline-flex shrink-0 items-center justify-center rounded-[var(--radius-ctl)] font-medium',
    'tracking-[-0.005em] transition-[color,background-color,border-color,transform,filter] duration-200 disabled:cursor-not-allowed',
    VARIANT[variant], SIZE[size], extra,
  ].join(' ')

