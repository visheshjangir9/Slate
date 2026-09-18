'use client'

import { useCallback, useRef, useState } from 'react'
import { timecode } from '@/lib/format'

/**
 * Transport for generated clips.
 *
 * Native controls work, but they look like a browser rather than a cutting
 * room, and they cannot be styled. This is a real transport over the same
 * media element: scrubbing, keyboard, loop and fullscreen all drive the video
 * directly, so nothing here is decorative.
 */
export function VideoPlayer({
  src, poster, className = '',
}: { src: string; poster?: string; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [loop, setLoop] = useState(true)
  const [muted, setMuted] = useState(true)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  // NB: state is reset by REMOUNTING, not by an effect -- the parent passes
  // key={src}, so loading a different clip gives a genuinely fresh player.

  const toggle = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) void v.play().catch(() => {})
    else v.pause()
  }, [])

  const seekBy = useCallback((delta: number) => {
    const v = videoRef.current
    if (!v || !Number.isFinite(v.duration)) return
    v.currentTime = Math.min(Math.max(0, v.currentTime + delta), v.duration)
  }, [])

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case ' ': case 'k': e.preventDefault(); toggle(); break
      case 'ArrowLeft': e.preventDefault(); seekBy(-1); break
      case 'ArrowRight': e.preventDefault(); seekBy(1); break
      case 'm': setMuted((m) => !m); break
      case 'l': setLoop((l) => !l); break
      default: break
    }
  }, [toggle, seekBy])

  const pct = duration > 0 ? (current / duration) * 100 : 0

  return (
    <div
      ref={wrapRef}
      className={`group relative isolate overflow-hidden bg-black ${className}`}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="group"
      aria-label="Video player. Space to play or pause, arrow keys to seek."
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        loop={loop}
        muted={muted}
        playsInline
        autoPlay
        preload="metadata"
        onLoadedMetadata={(e) => { setDuration(e.currentTarget.duration); setReady(true) }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => setFailed(true)}
        onClick={toggle}
        className="h-full w-full cursor-pointer object-contain"
      />

      {!ready && !failed && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="h-2 w-2 rounded-full bg-accent pulse-dot" />
        </div>
      )}

      {failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface px-6 text-center">
          <p className="text-sm text-ink">This clip could not be played</p>
          <p className="text-xs text-ink-3">The file may still be uploading. Try reloading.</p>
        </div>
      )}

      {/* Transport. Always reachable by keyboard; revealed on hover/focus by pointer. */}
      <div
        className="absolute inset-x-0 bottom-0 translate-y-1 bg-gradient-to-t from-black/90
          via-black/55 to-transparent px-3 pb-2.5 pt-8 opacity-0 transition-all duration-200
          group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0
          group-focus-within:opacity-100"
      >
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.01}
          value={current}
          aria-label="Seek"
          onChange={(e) => {
            const v = videoRef.current
            if (v) { v.currentTime = Number(e.target.value); setCurrent(Number(e.target.value)) }
          }}
          className="h-1 w-full cursor-pointer appearance-none rounded-full outline-none
            [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-ink [&::-webkit-slider-thumb]:opacity-0
            group-hover:[&::-webkit-slider-thumb]:opacity-100"
          style={{ background: `linear-gradient(90deg, var(--color-accent) ${pct}%, rgba(255,255,255,0.22) ${pct}%)` }}
        />

        <div className="mt-2 flex items-center gap-2.5">
          <button type="button" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}
            className="rounded p-0.5 text-ink transition-opacity duration-150 hover:opacity-80">
            {playing ? (
              <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
                <rect x="3.5" y="2.5" width="3.2" height="11" rx="1" fill="currentColor" />
                <rect x="9.3" y="2.5" width="3.2" height="11" rx="1" fill="currentColor" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
                <path d="M4 2.6 L13 8 L4 13.4 Z" fill="currentColor" />
              </svg>
            )}
          </button>

          <span className="tabular text-[11px] text-ink-2">
            {timecode(current)} <span className="text-ink-4">/ {timecode(duration)}</span>
          </span>

          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={() => setLoop((l) => !l)} aria-pressed={loop}
              title="Loop (L)"
              className={`rounded px-1.5 py-1 text-[10px] font-medium uppercase tracking-[0.06em]
                transition-colors duration-150 ${loop ? 'text-accent' : 'text-ink-4 hover:text-ink-2'}`}>
              Loop
            </button>
            <button type="button" onClick={() => setMuted((m) => !m)} aria-pressed={!muted}
              title="Mute (M)"
              className={`rounded px-1.5 py-1 text-[10px] font-medium uppercase tracking-[0.06em]
                transition-colors duration-150 ${muted ? 'text-ink-4 hover:text-ink-2' : 'text-accent'}`}>
              {muted ? 'Muted' : 'Sound'}
            </button>
            <button
              type="button"
              onClick={() => {
                const el = wrapRef.current
                if (!el) return
                if (document.fullscreenElement) void document.exitFullscreen()
                else void el.requestFullscreen?.().catch(() => {})
              }}
              aria-label="Fullscreen"
              className="rounded p-1 text-ink-4 transition-colors duration-150 hover:text-ink-2"
            >
              <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden>
                <path d="M1 5 V1 H5 M9 1 H13 V5 M13 9 V13 H9 M5 13 H1 V9"
                  stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
