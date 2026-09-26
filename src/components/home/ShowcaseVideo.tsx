'use client'

import { useEffect, useState } from 'react'
import type { ShowcaseMedia } from '@/lib/media'
import { useInView } from './useInView'
import { useReducedMotion } from './useReducedMotion'

/**
 * A muted, looping showcase clip that fills its (already sized) container.
 *
 * The still is a real image underneath, part of the first paint, so there is
 * no layout shift and never a blank box. The video fades in over it only once
 * it is actually playing: a clip that opens on black, an autoplay refusal,
 * reduced motion or a failed load all simply leave the still in place.
 * Playback starts only when the clip is on screen, and nothing waits on it.
 */
export function ShowcaseVideo({
  media, priority = false, className = '',
}: { media: ShowcaseMedia; priority?: boolean; className?: string }) {
  const [ref, inView] = useInView<HTMLVideoElement>({ margin: '200px 0px' })
  const reduced = useReducedMotion()
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.muted = true // must be set before play() for autoplay to be allowed
    if (reduced || inView !== true) { v.pause(); return }
    v.play().catch(() => { /* autoplay refused: the still remains */ })
  }, [ref, inView, reduced])

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={media.poster} alt="" aria-hidden
        loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'}
        className={`absolute inset-0 h-full w-full object-cover ${className}`} />
      <video
        ref={ref}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-out
          ${playing && !reduced ? 'opacity-100' : 'opacity-0'} ${className}`}
        src={media.src}
        muted
        loop
        playsInline
        disablePictureInPicture
        preload={priority ? 'auto' : 'metadata'}
        aria-label={media.label}
        onPlaying={() => setPlaying(true)}
        onError={() => setPlaying(false)}
      />
    </>
  )
}
