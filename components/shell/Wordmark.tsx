export function Wordmark({ size = 20 }: { size?: number }) {
  return (
    <>
      {/* Clapperboard: hinged bar over a slate body. Slate's own mark. */}
      <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden className="text-accent">
        <rect x="1.5" y="6" width="17" height="12" rx="2" fill="currentColor" opacity="0.16" />
        <rect x="1.5" y="6" width="17" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" fill="none" />
        <path d="M2 6.5 L6.5 2.2 L9.5 2.2 L5 6.5 Z" fill="currentColor" />
        <path d="M8 6.5 L12.5 2.2 L15.5 2.2 L11 6.5 Z" fill="currentColor" />
      </svg>
      <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Slate</span>
      <span className="sr-only">Slate — cinematic AI video</span>
    </>
  )
}
