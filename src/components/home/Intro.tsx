'use client'

import { useEffect, useLayoutEffect, useState } from 'react'
import { Mark } from '@/components/shell/Wordmark'

/**
 * Identity intro: wordmark exits, the clapper claps, and the clap opens a
 * shutter onto the hero. The timeline is CSS (globals.css, "Home: identity
 * intro"), chosen before first paint by INTRO_SCRIPT. This component only adds
 * the skip control and decides what the next visit sees.
 */
export const INTRO_SCRIPT = `(function(){var d=document.documentElement;try{var r=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;var seen=window.localStorage.getItem('slate_intro_seen');d.setAttribute('data-intro',r?'none':seen?'short':'full');window.localStorage.setItem('slate_intro_seen','1')}catch(e){d.setAttribute('data-intro','none')}})();`

const skip = () => document.documentElement.setAttribute('data-intro', 'none')

/**
 * When the homepage last unmounted in this page session. A remount long after
 * that is a return via in-app navigation and gets the short intro. React's
 * development double-mount remounts within the same tick, so it never counts.
 */
let lastUnmountAt = 0

export function Intro() {
  const [gone, setGone] = useState(false)

  // Before paint, so a return visit never flashes the start of the full timeline.
  useLayoutEffect(() => {
    const d = document.documentElement
    if (lastUnmountAt && performance.now() - lastUnmountAt > 100 && d.getAttribute('data-intro') === 'full') {
      d.setAttribute('data-intro', 'short')
    }
    return () => { lastUnmountAt = performance.now() }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') skip() }
    // Once the timeline has run, take the overlay out of the page entirely.
    // The page attribute is left alone so the hero's own reveal can finish.
    const onEnd = (e: AnimationEvent) => { if (e.animationName === 'intro-done') setGone(true) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('animationend', onEnd)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('animationend', onEnd)
    }
  }, [])

  if (gone) return null
  return (
    <div className="intro" aria-label="Slate intro">
      <div className="intro-shutter" data-side="top" />
      <div className="intro-shutter" data-side="bottom" />
      <div className="intro-flash" />
      <div className="intro-lockup">
        <span className="intro-mark inline-flex">
          <Mark size={76} armClassName="intro-arm" />
        </span>
        <span className="intro-wordset inline-flex">
          <span className="intro-word font-display text-[64px] font-extrabold leading-none tracking-[-0.05em] text-ink">
            Slate
          </span>
        </span>
      </div>
      <button type="button" onClick={skip}
        className="intro-skip rounded-[var(--radius-ctl)] border border-line-strong bg-ground/80 px-3 py-1.5 font-mono text-[11px]
          uppercase tracking-[0.12em] text-ink-2 transition-colors hover:text-ink">
        Skip intro
      </button>
    </div>
  )
}
