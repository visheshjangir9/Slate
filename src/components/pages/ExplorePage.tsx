'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { dimensionsFor, getMotion } from '@/lib/engine'
import type { MotionId } from '@/lib/engine/types'
import {
  CATEGORIES, FEATURED, MOTION_SHOWCASE, RECIPES, motionStill,
  type Category, type Preset, presetToParams,
} from '@/lib/presets'
import { CATALOGUE_MODELS, KIND_LABEL, LIVE_MODELS, studioHrefFor } from '@/lib/catalog'
import { MotionPreview, useLoadedImage } from '@/components/studio/MotionPreview'
import { CatalogueCard } from '@/components/studio/ModelPicker'
import { WORKFLOWS } from '@/components/shell/nav'
import { ButtonLink, Spec, Tag } from '@/components/ui/primitives'
import { IconArrowRight, IconSearch } from '@/components/ui/icons'
import { ExploreImage } from './ExploreImage'

const matches = (p: Preset, q: string) =>
  !q || [p.title, p.note, p.prompt, p.category, p.motion, ...p.tags].join(' ').toLowerCase().includes(q)

// Every recipe is a camera move, so it opens in Camera Motion.
const presetHref = (p: Preset) => `/studio/motion?${presetToParams(p)}`

const specOf = (p: Preset) => {
  const d = dimensionsFor(p.aspectRatio, p.resolution)
  return [getMotion(p.motion).label, `${p.durationS}s`, p.aspectRatio, `${d.width}×${d.height}`]
}

export function ExplorePage() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category | null>(null)
  const q = query.trim().toLowerCase()
  const filtering = Boolean(q || category)

  // The featured recipe has the hero; it joins the grid only when filtering.
  const recipes = useMemo(
    () => (filtering ? [FEATURED, ...RECIPES] : RECIPES)
      .filter((p) => (!category || p.category === category) && matches(p, q)),
    [q, category, filtering],
  )
  const motions = useMemo(() => {
    if (category) return []
    return MOTION_SHOWCASE.filter((id) => {
      if (!q) return true
      const m = getMotion(id)
      return `${m.label} ${m.description} ${id}`.toLowerCase().includes(q)
    })
  }, [q, category])

  return (
    <div className="pb-24">
      {!filtering && <Hero />}

      {/* Filter bar */}
      <div className="sticky top-14 z-30 border-b border-line bg-ground/95 backdrop-blur-[2px]">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-3 sm:px-6 md:flex-row md:items-center lg:px-10">
          <div className="relative md:w-72">
            <IconSearch size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search Explore"
              placeholder="Search recipes, moves, subjects"
              className="h-9 w-full rounded-[var(--radius-ctl)] border border-line bg-surface pl-9 pr-14 text-[13px] text-ink
                placeholder:text-ink-4 focus:border-ink-4 focus:outline-none" />
            {query && (
              <button type="button" onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-1 font-mono text-[10px] uppercase text-ink-3 hover:text-ink">
                Clear
              </button>
            )}
          </div>
          <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
            {([null, ...CATEGORIES] as (Category | null)[]).map((c) => {
              const on = category === c
              const count = c ? [FEATURED, ...RECIPES].filter((p) => p.category === c).length : RECIPES.length + 1
              return (
                <button key={c ?? 'all'} type="button" aria-pressed={on} onClick={() => setCategory(on ? null : c)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors duration-150
                    ${on ? 'border-ink bg-ink text-ground' : 'border-line text-ink-2 hover:border-line-strong hover:text-ink'}`}>
                  {c ?? 'All'} <span className={`tabular ${on ? 'text-ground/60' : 'text-ink-4'}`}>{count}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        {/* Recipes */}
        <section className="pt-10">
          <SectionHead
            title={filtering ? `${recipes.length} ${recipes.length === 1 ? 'recipe' : 'recipes'}` : 'Recipes'}
            note="Each one is a full specification: prompt, camera move and output. Hover to watch the move; Use preset loads it into Camera Motion."
          />
          {recipes.length ? (
            <div className="columns-1 gap-3 sm:columns-2 lg:columns-3 2xl:columns-4">
              {recipes.map((p) => <RecipeTile key={p.id} p={p} />)}
            </div>
          ) : (
            <div className="rounded-card border border-line bg-surface px-6 py-16 text-center">
              <p className="text-sm text-ink-2">Nothing matches that.</p>
              <button type="button" onClick={() => { setQuery(''); setCategory(null) }}
                className="mt-3 text-xs text-signal hover:underline">Clear search and filters</button>
            </div>
          )}
        </section>

        {/* Camera motion */}
        {motions.length > 0 && (
          <section className="pt-20">
            <SectionHead title="Camera motion" note="Live previews over one shared frame, so the move itself is what you compare."
              action={<Link href="/motion" className="inline-flex items-center gap-1.5 text-xs text-ink-2 hover:text-ink">All 15 moves <IconArrowRight size={13} /></Link>} />
            <MotionRow ids={motions} />
          </section>
        )}

        {!filtering && (
          <>
            <section id="models" className="scroll-mt-32 pt-20">
              <SectionHead title="Models" note="Live models run on Slate. Known models are for discovery: each opens Bring your own AI with that model in view." action={<Link href="/byok" className="inline-flex items-center gap-1.5 text-xs text-ink-2 hover:text-ink">Bring your own AI <IconArrowRight size={13} /></Link>} />
              <div className="grid gap-3 lg:grid-cols-3">
                {LIVE_MODELS.map((m) => (
                  <article key={m.id} className="flex flex-col rounded-card border border-line bg-surface p-5">
                    <div className="flex items-center gap-2">
                      <Tag tone="live" dot>Live</Tag>
                      <span className="text-[11px] text-ink-3">{m.maker} · {KIND_LABEL[m.kind]}</span>
                    </div>
                    <h3 className="display display-s mt-4">{m.name}</h3>
                    <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{m.summary}</p>
                    <Spec className="mt-4" items={m.facts ?? []} />
                    <div className="mt-auto pt-5">
                      <ButtonLink size="sm" variant="secondary"
                        href={studioHrefFor(m)}>
                        Create with {m.name} <IconArrowRight size={13} />
                      </ButtonLink>
                    </div>
                  </article>
                ))}
              </div>
              <div className="mb-3 mt-8 flex flex-wrap items-baseline justify-between gap-2">
                <p className="eyebrow text-ink-3">Known models · {CATALOGUE_MODELS.length}</p>
                <p className="text-[11px] text-ink-3">Not integrated natively in Slate. Each opens Bring your own AI with that model in view.</p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                {CATALOGUE_MODELS.map((m) => <CatalogueCard key={m.id} m={m} />)}
              </div>
            </section>

            <section className="pt-20">
              <SectionHead title="Start from scratch" note="Three workflows, each backed by a real pipeline." />
              <div className="grid gap-3 md:grid-cols-3">
                {WORKFLOWS.map((w) => (
                  <Link key={w.id} href={w.href}
                    className="group relative block overflow-hidden rounded-card border border-line" style={{ aspectRatio: 4 / 3 }}>
                    <ExploreImage file={w.art} alt="" className="transition-transform duration-700 group-hover:scale-[1.04]" />
                    <div className="scrim-b absolute inset-x-0 bottom-0 h-2/3" />
                    <div className="absolute inset-x-0 bottom-0 p-5">
                      <p className="display display-s">{w.label}</p>
                      <p className="mt-1.5 max-w-xs text-[13px] leading-snug text-ink-2">{w.description}</p>
                      <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-signal">
                        Open <IconArrowRight size={13} />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

function SectionHead({ title, note, action }: { title: string; note: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-line pb-3">
      <h2 className="display display-m">{title}</h2>
      <div className="flex items-center gap-4">
        <p className="max-w-md text-xs leading-relaxed text-ink-3">{note}</p>
        {action}
      </div>
    </div>
  )
}

/* Featured: the recipe's own camera move, playing live over its still. */
function Hero() {
  const img = useLoadedImage(`/explore/${FEATURED.image}`)
  return (
    <section className="relative overflow-hidden border-b border-line">
      <div className="relative h-[min(78vh,760px)] min-h-[460px] w-full">
        <div className="absolute inset-0">
          {img ? (
            <MotionPreview motion={FEATURED.motion} source={img} aspect={21 / 9} longEdge={1920} durationMs={9000}
              className="h-full w-full object-cover" label={`${FEATURED.title}: live ${getMotion(FEATURED.motion).label} over the preview still`} />
          ) : (
            <ExploreImage file={FEATURED.image} alt="" priority />
          )}
        </div>
        <div className="scrim-b absolute inset-x-0 bottom-0 h-3/4" />
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-[1440px] px-4 pb-10 sm:px-6 lg:px-10 lg:pb-14">
            <div className="flex flex-wrap items-center gap-2">
              <Tag tone="signal" onMedia>Featured recipe</Tag>
              <span className="text-[11px] text-ink-2">Preview still with a live {getMotion(FEATURED.motion).label} · not a rendered clip</span>
            </div>
            <h1 className="display display-xl mt-5 max-w-5xl">{FEATURED.title}</h1>
            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="max-w-2xl">
                <p className="text-[15px] leading-relaxed text-ink-2">{FEATURED.note}</p>
                <p className="mt-3 text-[13px] italic leading-relaxed text-ink-3">&ldquo;{FEATURED.prompt}&rdquo;</p>
                <Spec className="mt-3" items={specOf(FEATURED)} />
              </div>
              <div className="flex gap-2">
                <ButtonLink href={presetHref(FEATURED)} variant="primary" size="lg">Use preset <IconArrowRight size={16} /></ButtonLink>
                <ButtonLink href={`/motion`} variant="secondary" size="lg">Motion library</ButtonLink>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function RecipeTile({ p }: { p: Preset }) {
  const [hover, setHover] = useState(false)
  // The frame loads only once someone shows interest, so the grid stays light.
  const img = useLoadedImage(hover ? `/explore/${p.image}` : null)
  const d = dimensionsFor(p.aspectRatio, p.resolution)
  const aspect = d.width / d.height

  return (
    <article className="group mb-3 break-inside-avoid" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <Link href={presetHref(p)} onFocus={() => setHover(true)} onBlur={() => setHover(false)}
        aria-label={`Use preset: ${p.title}`}
        className="relative block overflow-hidden rounded-[4px] border border-line bg-surface transition-colors duration-150
          group-hover:border-line-strong" style={{ aspectRatio: aspect }}>
        <ExploreImage file={p.image} alt={p.title} />
        {hover && img && (
          <div className="absolute inset-0">
            <MotionPreview motion={p.motion} source={img} aspect={aspect} longEdge={900} label={`${p.title} with ${getMotion(p.motion).label}`} />
          </div>
        )}
        <div className="absolute left-2.5 top-2.5 flex gap-1.5">
          <Tag tone="neutral" onMedia>{p.category}</Tag>
        </div>
        <div className="scrim-b absolute inset-x-0 bottom-0 h-2/3 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
        <div className="absolute inset-x-0 bottom-0 translate-y-2 p-3 opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100">
          <p className="line-clamp-2 text-xs leading-snug text-ink-2">&ldquo;{p.prompt}&rdquo;</p>
          <span className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-ctl)] bg-signal px-3 text-xs font-medium text-ground">
            Use preset <IconArrowRight size={13} />
          </span>
        </div>
      </Link>
      <div className="mt-2 flex items-start justify-between gap-3 px-0.5">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{p.title}</h3>
          <p className="mt-0.5 text-xs leading-snug text-ink-3">{p.note}</p>
        </div>
      </div>
      <Spec className="mt-1.5 px-0.5" items={specOf(p)} />
    </article>
  )
}

function MotionRow({ ids }: { ids: MotionId[] }) {
  const [hover, setHover] = useState<MotionId | null>(null)
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {ids.map((id) => <MotionCard key={id} id={id} hover={hover === id} setHover={setHover} />)}
    </div>
  )
}

function MotionCard({ id, hover, setHover }: { id: MotionId; hover: boolean; setHover: (id: MotionId | null) => void }) {
  const img = useLoadedImage(`/explore/${motionStill(id)}`)
  const m = getMotion(id)
  return (
    <Link href={`/studio/motion?motion=${id}`} className="group"
      onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover(null)}
      onFocus={() => setHover(id)} onBlur={() => setHover(null)}>
      <span className="relative block overflow-hidden rounded-[4px] border border-line transition-colors group-hover:border-line-strong"
        style={{ aspectRatio: 16 / 9 }}>
        <MotionPreview motion={id} source={img} aspect={16 / 9} longEdge={480} playing={hover} label={`${m.label} preview`} />
        {!hover && (
          <span className="absolute bottom-2 right-2 rounded-[3px] bg-ground/85 px-1.5 py-0.5 font-mono text-[10px] text-ink-2">
            hover to play
          </span>
        )}
      </span>
      <span className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[14px] font-semibold">{m.label}</span>
        <IconArrowRight size={14} className="text-ink-4 transition-colors group-hover:text-signal" />
      </span>
      <span className="mt-0.5 block line-clamp-2 text-xs leading-snug text-ink-3">{m.description}</span>
    </Link>
  )
}
