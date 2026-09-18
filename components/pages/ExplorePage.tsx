'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { dimensionsFor } from '@/lib/engine'
import { stillUrl } from '@/lib/client/api'
import { PRESETS, presetToParams } from '@/lib/presets'

/**
 * Preview frames are staggered rather than requested all at once.
 *
 * The upstream image service returns 500s under burst, so nine simultaneous
 * cold requests would leave broken cards on a first visit. They are cached
 * server-side after the first fetch, so this delay only ever applies once.
 */
function useStagger(count: number, stepMs = 500) {
  const [ready, setReady] = useState(0)
  useEffect(() => {
    if (ready >= count) return
    const t = setTimeout(() => setReady((n) => n + 1), ready === 0 ? 0 : stepMs)
    return () => clearTimeout(t)
  }, [ready, count, stepMs])
  return ready
}

export function ExplorePage() {
  const [tag, setTag] = useState<string | null>(null)
  const tags = [...new Set(PRESETS.flatMap((p) => p.tags))].sort()
  const shown = tag ? PRESETS.filter((p) => p.tags.includes(tag)) : PRESETS
  const ready = useStagger(shown.length)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6">
        <header className="mb-5">
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Explore</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-3">
            Starting points built by us, not a community feed. Each card is a complete
            recipe — prompt, camera move and output settings. The preview is the real
            frame that prompt and seed produce.
          </p>
        </header>

        <div className="mb-5 flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setTag(null)} aria-pressed={tag === null}
            className={[
              'rounded-full border px-3 py-1.5 text-xs transition-colors duration-150',
              tag === null ? 'border-line-strong bg-surface-2 text-ink' : 'border-line text-ink-3 hover:text-ink-2',
            ].join(' ')}>
            All
          </button>
          {tags.map((t) => (
            <button key={t} type="button" onClick={() => setTag(t === tag ? null : t)} aria-pressed={tag === t}
              className={[
                'rounded-full border px-3 py-1.5 text-xs transition-colors duration-150',
                tag === t ? 'border-line-strong bg-surface-2 text-ink' : 'border-line text-ink-3 hover:text-ink-2',
              ].join(' ')}>
              {t}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p, i) => {
            const d = dimensionsFor(p.aspectRatio, p.resolution)
            const loadable = i < ready
            return (
              <article key={p.id}
                className="group flex flex-col overflow-hidden rounded-card border border-line bg-surface
                  transition-colors duration-150 hover:border-line-strong">
                <div className="relative overflow-hidden bg-surface-2"
                  style={{ aspectRatio: d.width / d.height }}>
                  {/* Real still from this exact prompt + seed, via the same proxy the engine uses. */}
                  {!loadable && <div className="h-full w-full animate-pulse bg-surface-3" />}
                  {loadable && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={stillUrl({ prompt: p.prompt, width: 512, height: Math.round(512 / (d.width / d.height)), seed: p.seed, model: 'flux' })}
                      alt={p.title}
                      loading="lazy"
                      className="h-full w-full object-cover opacity-0 transition-all duration-500
                        group-hover:scale-[1.03]"
                      onLoad={(e) => { e.currentTarget.style.opacity = '1' }}
                    />
                  )}
                  <span className="absolute left-2 top-2 rounded bg-ground/80 px-1.5 py-0.5
                    text-[10px] text-ink-3">preview still</span>
                </div>
                <div className="flex flex-1 flex-col p-3">
                  <h2 className="text-sm font-medium">{p.title}</h2>
                  <p className="mt-1 text-xs leading-snug text-ink-3">{p.note}</p>
                  <div className="tabular mt-2.5 flex flex-wrap gap-x-2.5 text-[10px] text-ink-4">
                    <span>{p.motion}</span>
                    <span>{p.durationS}s</span>
                    <span>{p.aspectRatio}</span>
                    <span>{p.resolution}</span>
                  </div>
                  <Link href={`/studio?${presetToParams(p)}`}
                    className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-md bg-ink
                      px-3 py-2 text-xs font-semibold text-ground transition-colors duration-150 hover:bg-white">
                    Use preset
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}
