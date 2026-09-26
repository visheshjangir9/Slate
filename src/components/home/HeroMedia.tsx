'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { HERO_MEDIA } from '@/lib/media'
import { useInView } from './useInView'
import { useReducedMotion } from './useReducedMotion'

type Mode = 'motion' | 'stills'

const N = HERO_MEDIA.length
/** Crossfade length; matches .hero-slide[data-state="active"] in globals.css. */
const FADE_MS = 1400

const subscribeVisibility = (fn: () => void) => {
  document.addEventListener('visibilitychange', fn)
  return () => document.removeEventListener('visibilitychange', fn)
}
const useDocumentHidden = () =>
  useSyncExternalStore(subscribeVisibility, () => document.hidden, () => false)

/**
 * The hero's media: four curated clips (Motion) or their four stills (Stills),
 * rotating every few seconds behind the headline.
 *
 * Every slide is always mounted with its still as the first paint, so the page
 * never waits on video and a clip that has not started yet shows its own frame
 * instead of a blank. The incoming slide fades in over the outgoing one (which
 * stays opaque underneath, so the crossfade never dips to black) while both
 * drift slightly in the same direction.
 *
 * Only the active clip plays; the next one preloads. Rotation pauses off
 * screen and in a background tab, and never runs automatically under reduced
 * motion, where Stills is the default and the numbered ticks step manually.
 */
export function HeroMedia() {
  const reduced = useReducedMotion()
  const hidden = useDocumentHidden()
  const [frameRef, inView] = useInView<HTMLDivElement>({ margin: '0px' })

  const [choice, setChoice] = useState<Mode | null>(null)
  const mode: Mode = choice ?? (reduced ? 'stills' : 'motion')
  const [index, setIndex] = useState(0)
  const [prev, setPrev] = useState<number | null>(null)
  /** Bumped on every change, so the timer and the progress tick restart together. */
  const [cycle, setCycle] = useState(0)
  const [playing, setPlaying] = useState<boolean[]>(() => HERO_MEDIA.map(() => false))
  // Hold the first slide until the intro has revealed the hero.
  const [started, setStarted] = useState(false)
  const videos = useRef<(HTMLVideoElement | null)[]>([])
  const lastMode = useRef<Mode>(mode)

  const rotating = started && !reduced && inView !== false && !hidden

  useEffect(() => {
    const intro = document.documentElement.getAttribute('data-intro')
    const t = setTimeout(() => setStarted(true), intro === 'full' ? 1800 : intro === 'short' ? 500 : 0)
    return () => clearTimeout(t)
  }, [])

  const go = useCallback((next: number) => {
    if (next === index) return
    setPrev(index)
    setIndex(next)
    setCycle((c) => c + 1)
  }, [index])

  // Once the crossfade has covered it, the outgoing slide goes idle: it
  // resets while hidden, so returning to it later fades in again.
  useEffect(() => {
    if (prev === null) return
    const t = setTimeout(() => setPrev(null), FADE_MS + 60)
    return () => clearTimeout(t)
  }, [prev, index])

  // Advance after the current item's hold.
  useEffect(() => {
    if (!rotating) return
    const t = setTimeout(() => go((index + 1) % N), HERO_MEDIA[index].hold)
    return () => clearTimeout(t)
  }, [rotating, index, cycle, go])

  // Playback: only the active clip plays. The outgoing one keeps playing under
  // the crossfade unless it is about to reach its end (then it holds its
  // frame); everything else is paused and rewound, ready for its turn.
  useEffect(() => {
    const enteringMotion = lastMode.current !== mode && mode === 'motion'
    lastMode.current = mode

    videos.current.forEach((v, i) => {
      if (!v) return
      v.muted = true // before play(), or autoplay is refused
      if (mode !== 'motion' || inView === false || hidden) { v.pause(); return }
      if (i === index) {
        if (enteringMotion && v.readyState > 0) v.currentTime = 0
        v.play().catch(() => { /* autoplay refused: the still stays */ })
      } else if (i === prev) {
        const left = (v.duration || 0) - v.currentTime
        if (left * 1000 < FADE_MS + 150) v.pause()
      } else {
        v.pause()
        if (v.readyState > 0) v.currentTime = 0
      }
    })
  }, [index, prev, mode, inView, hidden])

  const switchMode = (next: Mode) => {
    if (next === mode) return
    setChoice(next)
    setCycle((c) => c + 1)
  }

  const active = HERO_MEDIA[index]

  return (
    <>
      <div ref={frameRef} role="img" aria-label={active.label} className="hero-media absolute inset-0 isolate overflow-hidden bg-black">
        {HERO_MEDIA.map((m, i) => {
          const state = i === index ? 'active' : i === prev ? 'prev' : 'idle'
          const preload = mode !== 'motion' ? 'none' : i === index || i === (index + 1) % N ? 'auto' : 'none'
          return (
            <div key={m.src} className="hero-slide" data-state={state}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.poster} alt="" decoding="async" fetchPriority={i === 0 ? 'high' : 'low'}
                className="absolute inset-0 h-full w-full object-cover" />
              <video
                ref={(el) => { videos.current[i] = el }}
                src={m.src}
                muted
                loop
                playsInline
                disablePictureInPicture
                preload={preload}
                aria-hidden
                tabIndex={-1}
                onPlaying={() => setPlaying((p) => (p[i] ? p : p.map((x, j) => (j === i ? true : x))))}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ease-out
                  ${mode === 'motion' && playing[i] ? 'opacity-100' : 'opacity-0'}`}
              />
            </div>
          )
        })}
      </div>

      {/* The text-safe grade: the media itself dims and quietens toward the headline. */}
      <div aria-hidden className="hero-grade" />

      <div className="absolute right-3 top-3 z-10 flex items-center gap-3 sm:right-5 sm:top-4">
        <div className="flex items-center" role="group" aria-label="Hero media">
          {HERO_MEDIA.map((m, i) => (
            <button key={m.src} type="button" onClick={() => go(i)}
              aria-label={`Show ${i + 1} of ${N}`} aria-current={i === index ? 'true' : undefined}
              className="group flex h-7 w-6 items-center px-[3px]">
              <span className="relative block h-[2px] w-full overflow-hidden rounded-full bg-white/25 transition-colors group-hover:bg-white/45">
                {i === index && (
                  <span key={`${mode}-${cycle}-${rotating}`}
                    className={`absolute inset-0 bg-ink ${rotating ? 'shot-progress' : ''}`}
                    style={rotating ? { animationDuration: `${active.hold}ms` } : undefined} />
                )}
              </span>
            </button>
          ))}
        </div>

        <div className="relative grid grid-cols-2 rounded-full border border-white/15 bg-[#0b0b0c]/60 p-[3px] backdrop-blur-sm">
          <span aria-hidden
            className="absolute inset-y-[3px] left-[3px] w-[calc(50%-3px)] rounded-full bg-ink transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)]"
            style={{ transform: mode === 'motion' ? 'translateX(100%)' : 'none' }} />
          {(['stills', 'motion'] as const).map((m) => (
            <button key={m} type="button" onClick={() => switchMode(m)} aria-pressed={mode === m}
              className={`relative z-10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors duration-300
                ${mode === m ? 'text-ground' : 'text-ink-2 hover:text-ink'}`}>
              {m}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
