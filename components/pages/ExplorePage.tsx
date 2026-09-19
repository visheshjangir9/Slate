'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { dimensionsFor, getMotion } from '@/lib/engine'
import type { MotionId } from '@/lib/engine/types'
import {
  CATEGORIES, FEATURED, MOTION_DEMO_IMAGE, MOTION_SHOWCASE, RECIPES,
  type Category, type Preset, presetToParams,
} from '@/lib/presets'
import { MotionPreview } from '@/components/studio/MotionPreview'
import { ExploreImage } from './ExploreImage'

const matches = (p: Preset, q: string) =>
  !q ||
  [p.title, p.note, p.prompt, p.category, p.motion, ...p.tags]
    .join(' ').toLowerCase().includes(q)

function Meta({ p }: { p: Preset }) {
  const d = dimensionsFor(p.aspectRatio, p.resolution)
  return (
    <div className="tabular flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-ink-4">
      <span>{p.motion.replace(/_/g, ' ')}</span>
      <span>{p.durationS}s</span>
      <span>{p.aspectRatio}</span>
      <span>{d.width}&times;{d.height}</span>
      <span>{p.bitrate}</span>
    </div>
  )
}

function UsePreset({ p, block = false }: { p: Preset; block?: boolean }) {
  return (
    <Link
      href={`/studio?${presetToParams(p)}`}
      className={[
        'inline-flex items-center justify-center gap-1.5 rounded-md bg-ink px-3 py-2',
        'text-xs font-semibold text-ground transition-colors duration-150 hover:bg-white',
        block ? 'w-full' : '',
      ].join(' ')}
    >
      Use preset
      <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden>
        <path d="M4 2.5 L8 6 L4 9.5" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" />
      </svg>
    </Link>
  )
}

export function ExplorePage() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category | null>(null)
  const [demo, setDemo] = useState<HTMLImageElement | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)

  // One shared frame for every motion card, loaded once from a static file.
  useEffect(() => {
    let alive = true
    const img = new Image()
    img.onload = () => { if (alive) setDemo(img) }
    img.src = `/explore/${MOTION_DEMO_IMAGE}`
    return () => { alive = false }
  }, [])

  const q = query.trim().toLowerCase()
  const recipes = useMemo(
    () => RECIPES.filter((p) => (!category || p.category === category) && matches(p, q)),
    [q, category],
  )
  const featuredVisible = (!category || FEATURED.category === category) && matches(FEATURED, q)
  const motionsVisible = useMemo(() => {
    if (category) return []
    if (!q) return MOTION_SHOWCASE
    return MOTION_SHOWCASE.filter((id) => {
      const m = getMotion(id)
      return `${m.label} ${m.description} ${id}`.toLowerCase().includes(q)
    })
  }, [q, category])

  const nothing = !featuredVisible && !recipes.length && !motionsVisible.length

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6">
        <header className="mb-5">
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Explore</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-3">
            Starting points built by us, not a community feed. Every recipe carries a real
            prompt, camera move and output settings — Use preset loads them straight into Studio.
          </p>
        </header>

        {/* Search + category filters */}
        <div className="mb-6 flex flex-col gap-3">
          <div className="relative max-w-md">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search recipes, moves, subjects…"
              aria-label="Search Explore"
              className="w-full rounded-card border border-line bg-surface px-3 py-2 pr-16 text-sm
                text-ink placeholder:text-ink-4 transition-colors duration-150
                focus:border-line-strong focus:outline-none"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-1
                  text-[10px] uppercase tracking-[0.06em] text-ink-4 hover:text-ink-2">
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setCategory(null)} aria-pressed={category === null}
              className={[
                'rounded-full border px-3 py-1.5 text-xs transition-colors duration-150',
                category === null
                  ? 'border-line-strong bg-surface-2 text-ink'
                  : 'border-line text-ink-3 hover:border-line-strong hover:text-ink-2',
              ].join(' ')}>
              All
            </button>
            {CATEGORIES.map((c) => {
              const count = RECIPES.filter((p) => p.category === c).length +
                (FEATURED.category === c ? 1 : 0)
              return (
                <button key={c} type="button" aria-pressed={category === c}
                  onClick={() => setCategory(category === c ? null : c)}
                  className={[
                    'rounded-full border px-3 py-1.5 text-xs transition-colors duration-150',
                    category === c
                      ? 'border-line-strong bg-surface-2 text-ink'
                      : 'border-line text-ink-3 hover:border-line-strong hover:text-ink-2',
                  ].join(' ')}>
                  {c} <span className="tabular text-ink-4">{count}</span>
                </button>
              )
            })}
          </div>
        </div>

        {nothing && (
          <div className="rounded-card border border-line bg-surface px-6 py-14 text-center">
            <p className="text-sm text-ink-2">Nothing matches that</p>
            <button type="button" onClick={() => { setQuery(''); setCategory(null) }}
              className="mt-3 text-xs text-accent hover:underline">
              Clear search and filters
            </button>
          </div>
        )}

        {/* Featured */}
        {featuredVisible && (
          <section className="mb-9">
            <SectionHead title="Featured" note="One recipe, fully specified." />
            <article className="group grid overflow-hidden rounded-card border border-line bg-surface
              transition-colors duration-150 hover:border-line-strong lg:grid-cols-[1.45fr_1fr]">
              <div className="relative aspect-[21/9] overflow-hidden bg-surface-2 lg:aspect-auto lg:min-h-[280px]">
                <ExploreImage file={FEATURED.image} alt={FEATURED.title} priority
                  className="transition-transform duration-500 group-hover:scale-[1.02]" />
                <span className="absolute left-3 top-3 rounded bg-ground/85 px-2 py-1
                  text-[10px] uppercase tracking-[0.08em] text-ink-3">preview still</span>
              </div>
              <div className="flex flex-col justify-center gap-3 p-5 sm:p-6">
                <div>
                  <span className="text-[10px] uppercase tracking-[0.1em] text-accent">
                    {FEATURED.category}
                  </span>
                  <h3 className="mt-1.5 text-xl font-semibold tracking-[-0.02em]">{FEATURED.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-3">{FEATURED.note}</p>
                </div>
                <p className="rounded-md border border-line bg-ground/50 p-2.5 text-xs leading-relaxed text-ink-3">
                  &ldquo;{FEATURED.prompt}&rdquo;
                </p>
                <Meta p={FEATURED} />
                <div className="pt-1"><UsePreset p={FEATURED} /></div>
              </div>
            </article>
          </section>
        )}

        {/* Camera Motion */}
        {motionsVisible.length > 0 && (
          <section className="mb-9">
            <SectionHead
              title="Camera motion"
              note="Previews use the same transform function the encoder runs, over one shared frame."
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {motionsVisible.map((id) => (
                <MotionCard key={id} id={id} demo={demo}
                  active={hovered === id} onHover={setHovered} />
              ))}
            </div>
          </section>
        )}

        {/* Curated recipes */}
        {recipes.length > 0 && (
          <section>
            <SectionHead title="Curated recipes" note={`${recipes.length} shown`} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recipes.map((p) => {
                const d = dimensionsFor(p.aspectRatio, p.resolution)
                return (
                  <article key={p.id}
                    className="group flex flex-col overflow-hidden rounded-card border border-line
                      bg-surface transition-colors duration-150 hover:border-line-strong">
                    <div className="relative overflow-hidden bg-surface-2"
                      style={{ aspectRatio: d.width / d.height }}>
                      <ExploreImage file={p.image} alt={p.title}
                        className="transition-transform duration-500 group-hover:scale-[1.03]" />
                      <span className="absolute left-2 top-2 rounded bg-ground/85 px-1.5 py-0.5
                        text-[10px] text-ink-3">preview still</span>
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-3">
                      <div>
                        <span className="text-[10px] uppercase tracking-[0.1em] text-ink-4">
                          {p.category}
                        </span>
                        <h3 className="mt-0.5 text-sm font-medium">{p.title}</h3>
                        <p className="mt-1 text-xs leading-snug text-ink-3">{p.note}</p>
                      </div>
                      <Meta p={p} />
                      <div className="mt-auto pt-1"><UsePreset p={p} block /></div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function SectionHead({ title, note }: { title: string; note: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-sm font-medium uppercase tracking-[0.09em] text-ink-2">{title}</h2>
      <p className="text-xs text-ink-4">{note}</p>
    </div>
  )
}

function MotionCard({
  id, demo, active, onHover,
}: { id: MotionId; demo: HTMLImageElement | null; active: boolean; onHover: (v: string | null) => void }) {
  const m = getMotion(id)
  return (
    <article
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(id)}
      onBlur={() => onHover(null)}
      className="group overflow-hidden rounded-card border border-line bg-surface
        transition-colors duration-150 hover:border-line-strong"
    >
      <div className="relative aspect-video overflow-hidden bg-surface-2">
        {demo ? (
          <MotionPreview motion={id} source={demo} playing={active} />
        ) : (
          <ExploreImage file={MOTION_DEMO_IMAGE} alt={`${m.label} preview`} />
        )}
        {demo && !active && (
          <span className="absolute bottom-2 right-2 rounded bg-ground/85 px-1.5 py-0.5
            text-[10px] text-ink-3">hover to play</span>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium">{m.label}</h3>
        <p className="mt-1 line-clamp-2 text-xs leading-snug text-ink-3">{m.description}</p>
        <Link href={`/studio?motion=${id}`}
          className="mt-2.5 inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5
            text-xs text-ink-2 transition-colors duration-150 hover:border-line-strong hover:text-ink">
          Use in Create
        </Link>
      </div>
    </article>
  )
}
