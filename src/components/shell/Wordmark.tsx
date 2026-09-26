/**
 * Slate's mark: a slate board, drawn as a body with the clapper arm cut on the
 * diagonal. The arm is its own group, hinged at its left end, so the homepage
 * intro can close it like a real clapperboard.
 */
export function Mark({ size = 22, armClassName }: { size?: number; armClassName?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden overflow="visible">
      <rect x="2" y="8.5" width="20" height="13" rx="1.5" fill="var(--color-ink)" />
      <rect x="5" y="12" width="7" height="1.6" rx=".8" fill="var(--color-ground)" />
      <rect x="5" y="15.4" width="11" height="1.6" rx=".8" fill="var(--color-ground)" opacity=".55" />
      <g className={armClassName}>
        <path d="M2.4 3.2 21.6 3.2 21.6 7 2.4 7Z" fill="var(--color-signal)" />
        <path d="M6 3.2 9.4 7M12 3.2 15.4 7M18 3.2 21.4 7" stroke="var(--color-ground)" strokeWidth="1.6" />
      </g>
    </svg>
  )
}

export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2">
      <Mark size={size} />
      <span className="font-display text-[19px] font-extrabold tracking-[-0.04em] text-ink">Slate</span>
    </span>
  )
}
