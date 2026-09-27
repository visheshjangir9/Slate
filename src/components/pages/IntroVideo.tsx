'use client'

import { useEffect, useRef, useState, type PointerEvent } from 'react'

const SRC = '/media/videos/intro.mp4'
const POSTER = '/media/videos/posters/intro.jpg'

const clock = (s: number) => {
  if (!Number.isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

/**
 * The maker's intro, as part of the page rather than an embed.
 *
 * Nothing loads until the visitor presses play (preload="none"), and it never
 * starts on its own. Controls are Slate's own: play/pause, sound, a seekable
 * amber progress line and the time. It pauses when scrolled out of view, and
 * offers a replay at the end.
 */
export function IntroVideo() {
  const box = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const [started, setStarted] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [ended, setEnded] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [loading, setLoading] = useState(false)

  // Scrolled away: pause, so it never talks from off screen.
  useEffect(() => {
    const el = box.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => { if (!e.isIntersecting) video.current?.pause() }, { threshold: 0.25 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const toggle = () => {
    const v = video.current
    if (!v) return
    if (v.paused || v.ended) {
      if (v.ended) v.currentTime = 0
      setStarted(true); setEnded(false); setLoading(v.readyState < 3)
      void v.play().catch(() => setLoading(false))
    } else {
      v.pause()
    }
  }

  const seek = (e: PointerEvent<HTMLDivElement>) => {
    const v = video.current, b = bar.current
    if (!v || !b || !duration) return
    const r = b.getBoundingClientRect()
    v.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duration
  }

  const pct = duration ? (time / duration) * 100 : 0

  return (
    <div ref={box} className="intro-player group/intro relative">
      <div className="intro-glow" aria-hidden />
      <div className="relative overflow-hidden rounded-[14px] border border-line-strong bg-ground shadow-[0_40px_120px_-50px_rgba(0,0,0,.95)]">
        <video
          ref={video}
          src={SRC}
          poster={POSTER}
          preload="none"
          playsInline
          muted={muted}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onWaiting={() => setLoading(true)}
          onPlaying={() => setLoading(false)}
          onCanPlay={() => setLoading(false)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onEnded={() => { setPlaying(false); setEnded(true) }}
          onClick={toggle}
          className="block aspect-video w-full cursor-pointer bg-ground object-cover"
          aria-label="Intro video from Vishesh Jangir"
        />

        {/* Cover: a large play button until the first play, and again at the end. */}
        {(!started || ended) && (
          <button type="button" onClick={toggle}
            className="intro-cover absolute inset-0 flex items-end justify-start gap-6 p-6 text-left text-ink sm:p-7"
            aria-label={ended ? 'Watch the intro again' : 'Play the intro, with sound'}>
            <span className="intro-play flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-signal text-ground sm:h-16 sm:w-16">
              {ended
                ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4" /></svg>
                : <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" /></svg>}
            </span>
            <span className="flex flex-col gap-1 pb-1">
              <span className="font-display text-[17px] font-bold leading-none tracking-[-0.02em] text-ink sm:text-[19px]">
                {ended ? 'Watch again' : 'Watch my intro'}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-3">1 min · sound on</span>
            </span>
          </button>
        )}

        {loading && playing && (
          <span className="pointer-events-none absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 animate-spin rounded-full border-2 border-white/20 border-t-signal" aria-hidden />
        )}

        {/* Controls: shown while playing on hover or focus, and whenever paused mid-way. */}
        {started && !ended && (
          <div className={`intro-controls absolute inset-x-0 bottom-0 flex flex-col gap-2.5 px-4 pb-3.5 pt-10 sm:px-5
            ${playing ? 'opacity-0 group-hover/intro:opacity-100 group-focus-within/intro:opacity-100' : 'opacity-100'}`}>
            <div ref={bar} role="slider" aria-label="Seek" aria-valuemin={0} aria-valuemax={Math.round(duration)} aria-valuenow={Math.round(time)} tabIndex={0}
              onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); seek(e) }}
              onPointerMove={(e) => { if (e.buttons) seek(e) }}
              onKeyDown={(e) => {
                const v = video.current; if (!v) return
                if (e.key === 'ArrowRight') v.currentTime = Math.min(duration, v.currentTime + 5)
                if (e.key === 'ArrowLeft') v.currentTime = Math.max(0, v.currentTime - 5)
              }}
              className="group/bar relative h-4 cursor-pointer">
              <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white/20" />
              <span className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-signal" style={{ width: `${pct}%` }} />
              <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full bg-signal transition-transform group-hover/bar:scale-100"
                style={{ left: `${pct}%` }} />
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-ink backdrop-blur-sm transition-colors hover:bg-white/20">
                {playing
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" /></svg>}
              </button>
              <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Unmute' : 'Mute'} aria-pressed={muted}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-ink backdrop-blur-sm transition-colors hover:bg-white/20">
                {muted
                  ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4H4z" /><path d="m16 9.5 5 5M21 9.5l-5 5" /></svg>
                  : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4H4z" /><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" /></svg>}
              </button>
              <span className="tabular text-[12px] text-ink-2">{clock(time)} <span className="text-ink-4">/ {clock(duration)}</span></span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
