'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { MOTIONS } from '@/lib/engine/motion'
import { stillUrl } from '@/lib/client/api'
import { Badge } from './primitives'
import { MotionPreview } from './MotionPreview'

const DEMO_PROMPT = 'a cinematic wide shot of a coastal cliff at golden hour, volumetric light'
const DEMO_SEED = 4242

export function MotionLibrary() {
  const [source, setSource] = useState<HTMLImageElement | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [hovered, setHovered] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { if (alive) { setSource(img); setState('ready') } }
    img.onerror = () => { if (alive) setState('error') }
    // One real still, shared by every card. Same proxy the engine uses.
    img.src = stillUrl({ prompt: DEMO_PROMPT, width: 768, height: 432, seed: DEMO_SEED, model: 'flux' })
    return () => { alive = false }
  }, [])

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Motion Library</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-3">
            Every camera move Slate can render. Each preview animates a real generated frame
            through the <span className="text-ink-2">same transform function the encoder uses</span>,
            so what you see is what gets rendered — not an approximation.
          </p>
        </header>

        {state === 'error' && (
          <div className="mb-5 rounded-card border border-danger/40 bg-danger/10 px-4 py-3">
            <p className="text-xs text-danger">
              The preview frame could not be generated, so the moves are listed without animation.
              The moves themselves still work in Create Video.
            </p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MOTIONS.map((m) => (
            <article
              key={m.id}
              onMouseEnter={() => setHovered(m.id)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(m.id)}
              onBlur={() => setHovered(null)}
              className="group overflow-hidden rounded-card border border-line bg-surface
                transition-colors duration-150 hover:border-line-strong"
            >
              <div className="relative aspect-video overflow-hidden bg-surface-2">
                {state === 'loading' && <div className="h-full w-full animate-pulse bg-surface-3" />}
                {source && (
                  <MotionPreview motion={m.id} source={source} playing={hovered === m.id} />
                )}
                {state === 'ready' && hovered !== m.id && (
                  <span className="absolute bottom-2 right-2 rounded bg-ground/80 px-1.5 py-0.5
                    text-[10px] text-ink-3">
                    hover to play
                  </span>
                )}
              </div>
              <div className="p-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-medium">{m.label}</h2>
                  {m.badge && <Badge tone={m.badge === 'TOP' ? 'accent' : 'neutral'}>{m.badge}</Badge>}
                </div>
                <p className="mt-1 text-xs leading-snug text-ink-3">{m.description}</p>
                <Link
                  href={`/studio?motion=${m.id}`}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-line
                    px-2.5 py-1.5 text-xs text-ink-2 transition-colors duration-150
                    hover:border-line-strong hover:text-ink"
                >
                  Use in Create
                  <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden>
                    <path d="M4 2.5 L8 6 L4 9.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                  </svg>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
