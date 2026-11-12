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

const REPLAY_EVENT = 'slate:intro-replay'
/** Set when the wordmark asks for the clap from another page: the homepage's next mount plays it. */
let replayRequested = false

/**
 * Play the short intro again: the wordmark is Home, and going home claps the
 * slate. On the homepage it plays at once; from another page it plays as the
 * homepage mounts. Reduced motion never sees it.
 */
export function replayIntro() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  replayRequested = true
  window.dispatchEvent(new Event(REPLAY_EVENT))
}

/** Restart the short timeline, page side included (the hero settles and its words rise again). */
function startShort() {
  const d = document.documentElement
  d.setAttribute('data-intro', 'none')
  void d.offsetWidth // the animations are removed for a frame, so setting the attribute restarts them
  d.setAttribute('data-intro', 'short')
  replayRequested = false
}

/**
 * When the homepage last unmounted in this page session. A remount long after
 * that is a return via in-app navigation and gets the short intro. React's
 * development double-mount remounts within the same tick, so it never counts.
 */
let lastUnmountAt = 0

export function Intro() {
  const [gone, setGone] = useState(false)
  /** Bumped on each replay: a fresh overlay, so its own timeline starts from zero. */
  const [run, setRun] = useState(0)

  // Before paint, so a return visit never flashes the start of the full timeline.
  useLayoutEffect(() => {
    const d = document.documentElement
    if (replayRequested) startShort()
    else if (lastUnmountAt && performance.now() - lastUnmountAt > 100 && d.getAttribute('data-intro') === 'full') {
      d.setAttribute('data-intro', 'short')
    }
    return () => { lastUnmountAt = performance.now() }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') skip() }
    // Once the timeline has run, take the overlay out of the page entirely.
    // The page attribute is left alone so the hero's own reveal can finish.
    const onEnd = (e: AnimationEvent) => { if (e.animationName === 'intro-done') setGone(true) }
    const onReplay = () => { startShort(); setGone(false); setRun((r) => r + 1) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('animationend', onEnd)
    window.addEventListener(REPLAY_EVENT, onReplay)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('animationend', onEnd)
      window.removeEventListener(REPLAY_EVENT, onReplay)
    }
  }, [])

  if (gone) return null
  return (
    <div key={run} className="intro" aria-label="Slate intro">
      <div className="intro-shutter" data-side="top" />
      <div className="intro-shutter" data-side="bottom" />
      <div className="intro-bloom" />
      <div className="intro-ring" />
      <div className="intro-flash" />
      <div className="intro-lockup">
        <span className="intro-mark inline-flex">
          <Mark size={84} armClassName="intro-arm" />
        </span>
        <span className="intro-wordset inline-flex">
          <span className="intro-word font-display text-[68px] font-semibold leading-none tracking-[-0.045em]">
            Slate
          </span>
        </span>
      </div>
      <button type="button" onClick={skip}
        className="intro-skip rounded-full border border-white/15 bg-ground/60 px-3.5 py-2 text-[12.5px] font-medium leading-none
          text-ink-2 backdrop-blur-md transition-colors hover:text-ink">
        Skip intro
      </button>
    </div>
  )
}
