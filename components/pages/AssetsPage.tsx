'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { dimensionsFor } from '@/lib/engine'
import { ERROR_COPY } from '@/lib/generation/state'
import type { Generation, GenerationStatus } from '@/lib/generation/types'
import { deleteGeneration, listGenerations } from '@/lib/client/api'

const FILTERS: { id: 'all' | GenerationStatus; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'completed', label: 'Completed' },
  { id: 'generating', label: 'In progress' },
  { id: 'failed', label: 'Failed' },
]

const fmtBytes = (n: number | null) =>
  n === null ? '—' : n < 1e6 ? `${(n / 1e3).toFixed(0)} KB` : `${(n / 1e6).toFixed(2)} MB`

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

export function AssetsPage() {
  const params = useSearchParams()
  const [items, setItems] = useState<Generation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState(() => params?.get('q') ?? '')
  const [filter, setFilter] = useState<'all' | GenerationStatus>('all')
  const [open, setOpen] = useState<Generation | null>(null)

  useEffect(() => {
    let alive = true
    listGenerations(50)
      .then((r) => { if (alive) setItems(r.generations) })
      .catch(() => { if (alive) setError('Could not load your assets.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((g) => {
      if (filter !== 'all' && g.status !== filter) return false
      if (!q) return true
      return (
        g.prompt.toLowerCase().includes(q) ||
        g.motion.toLowerCase().includes(q) ||
        g.aspectRatio.includes(q) ||
        g.resolution.includes(q)
      )
    })
  }, [items, query, filter])

  const remove = async (id: string) => {
    setItems((p) => p.filter((g) => g.id !== id))
    setOpen((o) => (o?.id === id ? null : o))
    try { await deleteGeneration(id) } catch { setError('Could not delete that asset.') }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length }
    for (const g of items) c[g.status] = (c[g.status] ?? 0) + 1
    return c
  }, [items])

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.02em]">Assets</h1>
            <p className="mt-1.5 text-sm text-ink-3">
              Everything generated on this device. Stored durably, not in your browser.
            </p>
          </div>
          <span className="tabular text-xs text-ink-4">{items.length} total</span>
        </header>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search prompt, motion, format…"
              aria-label="Search assets"
              className="w-full rounded-card border border-line bg-surface px-3 py-2 text-sm text-ink
                placeholder:text-ink-4 focus:border-line-strong focus:outline-none"
            />
          </div>
          <div className="flex gap-1 rounded-lg bg-surface p-1 hairline">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                aria-pressed={filter === f.id}
                className={[
                  'rounded-md px-2.5 py-1.5 text-xs transition-colors duration-150',
                  filter === f.id ? 'bg-surface-3 text-ink' : 'text-ink-3 hover:text-ink-2',
                ].join(' ')}
              >
                {f.label}
                {counts[f.id] ? <span className="tabular ml-1.5 text-ink-4">{counts[f.id]}</span> : null}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-card border border-danger/40 bg-danger/10 px-4 py-2.5">
            <p className="text-xs text-danger">{error}</p>
          </div>
        )}

        {loading && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="aspect-video animate-pulse rounded-card bg-surface-2" />
            ))}
          </div>
        )}

        {!loading && !items.length && (
          <div className="flex flex-col items-center justify-center rounded-card border border-line
            bg-surface px-6 py-16 text-center">
            <p className="text-sm font-medium text-ink-2">Nothing generated yet</p>
            <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-ink-3">
              Clips and frames you create appear here, with the exact settings used.
            </p>
            <Link href="/studio"
              className="mt-5 rounded-card bg-ink px-4 py-2 text-xs font-semibold text-ground hover:bg-white">
              Open Studio
            </Link>
          </div>
        )}

        {!loading && items.length > 0 && !shown.length && (
          <div className="rounded-card border border-line bg-surface px-6 py-12 text-center">
            <p className="text-sm text-ink-2">No assets match that</p>
            <button type="button" onClick={() => { setQuery(''); setFilter('all') }}
              className="mt-3 text-xs text-accent hover:underline">
              Clear filters
            </button>
          </div>
        )}

        {!loading && shown.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((g) => {
              const d = dimensionsFor(g.aspectRatio, g.resolution)
              return (
                <article key={g.id}
                  className="group overflow-hidden rounded-card border border-line bg-surface
                    transition-colors duration-150 hover:border-line-strong">
                  <button type="button" onClick={() => setOpen(g)}
                    className="relative block w-full overflow-hidden bg-surface-2"
                    style={{ aspectRatio: d.width / d.height }}>
                    {g.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.posterUrl} alt="" className="h-full w-full object-cover
                        transition-transform duration-300 group-hover:scale-[1.03]" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-[11px] text-ink-4">
                        {g.status === 'failed' ? 'failed' : 'no preview'}
                      </span>
                    )}
                    {g.status === 'completed' && (
                      <span className="absolute inset-0 flex items-center justify-center opacity-0
                        transition-opacity duration-150 group-hover:opacity-100">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full
                          bg-ground/80 text-ink">▶</span>
                      </span>
                    )}
                  </button>
                  <div className="p-3">
                    <p className="truncate text-xs text-ink-2">{g.prompt}</p>
                    <div className="tabular mt-1.5 flex flex-wrap items-center gap-x-2.5 text-[10px] text-ink-4">
                      <span>{d.width}&times;{d.height}</span>
                      <span>{g.durationS}s</span>
                      <span>{g.motion}</span>
                      <span>{fmtBytes(g.fileBytes)}</span>
                    </div>
                    <div className="mt-2.5 flex items-center gap-2">
                      {g.outputUrl && (
                        <a href={g.outputUrl} download={`slate-${g.motion}-${g.id.slice(0, 8)}.mp4`}
                          className="rounded border border-line px-2 py-1 text-[11px] text-ink-2
                            transition-colors duration-150 hover:border-line-strong hover:text-ink">
                          Download
                        </a>
                      )}
                      <Link href={`/studio?prompt=${encodeURIComponent(g.prompt)}&motion=${g.motion}&duration=${g.durationS}&aspect=${encodeURIComponent(g.aspectRatio)}&resolution=${g.resolution}&bitrate=${g.bitrate}`}
                        className="rounded border border-line px-2 py-1 text-[11px] text-ink-2
                          transition-colors duration-150 hover:border-line-strong hover:text-ink">
                        Reuse
                      </Link>
                      <button type="button" onClick={() => remove(g.id)}
                        className="ml-auto rounded px-1.5 py-1 text-[11px] text-ink-4
                          transition-colors duration-150 hover:text-danger">
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close" onClick={() => setOpen(null)}
            className="absolute inset-0 bg-black/80" />
          <div className="rise relative max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-card
            border border-line bg-ground">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="truncate pr-4 text-sm text-ink-2">{open.prompt}</p>
              <button type="button" onClick={() => setOpen(null)}
                className="shrink-0 text-xs text-ink-3 hover:text-ink">Close</button>
            </div>
            <div className="bg-black">
              {open.outputUrl ? (
                <video src={open.outputUrl} poster={open.posterUrl ?? undefined} controls autoPlay loop
                  className="max-h-[60vh] w-full object-contain" />
              ) : (
                <div className="px-6 py-12 text-center">
                  <p className="text-sm text-ink-2">
                    {open.status === 'failed' ? 'This render failed' : 'Still in progress'}
                  </p>
                  {open.errorCode && (
                    <p className="mt-1.5 text-xs text-ink-3">
                      {ERROR_COPY[open.errorCode] ?? open.errorMessage}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="tabular flex flex-wrap gap-x-3 text-[11px] text-ink-4">
                <span>{open.resolution}</span>
                <span>{open.aspectRatio}</span>
                <span>{open.bitrate}</span>
                <span>{open.durationS}s</span>
                <span>seed {open.seed}</span>
                <span>{fmtDate(open.createdAt)}</span>
              </div>
              {open.outputUrl && (
                <a href={open.outputUrl} download={`slate-${open.motion}-${open.id.slice(0, 8)}.mp4`}
                  className="rounded-card bg-ink px-3 py-2 text-xs font-semibold text-ground hover:bg-white">
                  Download
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
