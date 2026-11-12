'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react'
import { HERO_MEDIA } from '@/lib/media'
import { useInView } from './useInView'
import { useReducedMotion } from './useReducedMotion'

type Mode = 'motion' | 'stills'

/** A clip's first playable moment: its own best passage, or its first frame. */
const startOf = (i: number) => HERO_MEDIA[i].start ?? 0

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
 *
 * `parallaxRef` is the wrapper the hero moves on scroll; the controls sit
 * outside it, pinned to the hero's bottom-right corner.
 */
export function HeroMedia({ parallaxRef }: { parallaxRef?: RefObject<HTMLDivElement | null> }) {
  const reduced = useReducedMotion()
  const hidden = useDocumentHidden()
  const [frameRef, inView] = useInView<HTMLDivElement>({ margin: '0px' })

  // Motion by default; under reduced motion the stills stand in and the ticks step by hand.
  const mode: Mode = reduced ? 'stills' : 'motion'
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
        if (v.readyState > 0 && (enteringMotion || v.currentTime < startOf(i))) v.currentTime = startOf(i)
        v.play().catch(() => { /* autoplay refused: the still stays */ })
      } else if (i === prev) {
        const left = (v.duration || 0) - v.currentTime
        if (left * 1000 < FADE_MS + 150) v.pause()
      } else {
        v.pause()
        if (v.readyState > 0) v.currentTime = startOf(i)
      }
    })
  }, [index, prev, mode, inView, hidden])

  const active = HERO_MEDIA[index]

  return (
    <>
      <div ref={parallaxRef} className="hero-parallax">
      <div ref={frameRef} role="img" aria-label={active.label} className="hero-media absolute inset-0 isolate overflow-hidden bg-black">
        {HERO_MEDIA.map((m, i) => {
          const state = i === index ? 'active' : i === prev ? 'prev' : 'idle'
          const preload = mode !== 'motion' ? 'none' : i === index || i === (index + 1) % N ? 'auto' : 'none'
          return (
            <div key={m.src} className="hero-slide" data-state={state} data-crop={m.crop}>
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
                onLoadedMetadata={(e) => { if (e.currentTarget.currentTime < startOf(i)) e.currentTarget.currentTime = startOf(i) }}
                onPlaying={() => setPlaying((p) => (p[i] ? p : p.map((x, j) => (j === i ? true : x))))}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ease-out
                  ${mode === 'motion' && playing[i] ? 'opacity-100' : 'opacity-0'}`}
              />
            </div>
          )
        })}
      </div>

      </div>

      {/* Two grades: a short fall from the top for the bar, a long rise from the base for the headline. */}
      <div aria-hidden className="hero-scrim" data-edge="top" />
      <div aria-hidden className="hero-scrim" data-edge="bottom" />

      <div className="hero-controls hero-rise z-10 flex items-center gap-0.5" style={{ ['--d' as string]: '240ms' }}
        role="group" aria-label="Hero media">
        <span className="meta mr-3" aria-hidden>
          {String(index + 1).padStart(2, '0')} / {String(N).padStart(2, '0')}
        </span>
        {HERO_MEDIA.map((m, i) => (
          <button key={m.src} type="button" onClick={() => go(i)}
            aria-label={`Show ${i + 1} of ${N}`} aria-current={i === index ? 'true' : undefined}
            className="flex h-11 items-center px-[3px]">
            <span className="hero-tick">
              {i < index && <span className="absolute inset-0 bg-ink/45" />}
              {i === index && (
                <span key={`${mode}-${cycle}-${rotating}`}
                  className={`absolute inset-0 bg-ink ${rotating ? 'shot-progress' : ''}`}
                  style={rotating ? { animationDuration: `${active.hold}ms` } : undefined} />
              )}
            </span>
          </button>
        ))}
      </div>
    </>
  )
}
