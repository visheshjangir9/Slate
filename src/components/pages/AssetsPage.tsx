'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { dimensionsFor, getMotion } from '@/lib/engine'
import { ERROR_COPY } from '@/lib/generation/state'
import type { Generation, GenerationStatus } from '@/lib/generation/types'
import { kindOfModel, modelName } from '@/lib/catalog'
import { imageOutputDims } from '@/lib/images/dims'
import { deleteGeneration, listGenerations } from '@/lib/client/api'
import { useAuth } from '@/lib/client/auth'
import { currentStore } from '@/lib/client/current'
import { generationManager } from '@/lib/client/generationManager'
import { downloadHref, fileSize, timeAgo } from '@/lib/format'
import { DOWNLOAD_CLS, aspectOf, downloadName } from '@/components/studio/Stage'
import { VideoPlayer } from '@/components/studio/VideoPlayer'
import { Button, Segmented, Sheet, Tag, buttonClass } from '@/components/ui/primitives'
import { IconArrowRight, IconDownload, IconRemix, IconSearch, IconTrash } from '@/components/ui/icons'

type Kind = 'all' | 'video' | 'image'
type Status = 'any' | 'ready' | 'running' | 'failed'

const STATUS_MATCH: Record<Status, (s: GenerationStatus) => boolean> = {
  any: () => true,
  ready: (s) => s === 'completed',
  running: (s) => s === 'queued' || s === 'generating',
  failed: (s) => s === 'failed',
}

const dimsOf = (g: Generation) =>
  kindOfModel(g.model) === 'image' ? imageOutputDims(g.aspectRatio) : dimensionsFor(g.aspectRatio, g.resolution)

/** Studio link that reloads these exact settings as a new creation. */
function remixHref(g: Generation): string {
  const p = new URLSearchParams({ prompt: g.prompt, aspect: g.aspectRatio, bitrate: g.bitrate })
  if (kindOfModel(g.model) === 'image') return `/studio/image?${p}`
  p.set('motion', g.motion); p.set('duration', String(g.durationS)); p.set('resolution', g.resolution); p.set('model', g.model)
  return `/studio?${p}`
}

export function AssetsPage() {
  const params = useSearchParams()
  const router = useRouter()
  const auth = useAuth()
  const [items, setItems] = useState<Generation[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [more, setMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState(() => params?.get('q') ?? '')
  const [kind, setKind] = useState<Kind>('all')
  const [status, setStatus] = useState<Status>('any')
  const [open, setOpen] = useState<Generation | null>(null)

  useEffect(() => {
    let alive = true
    listGenerations(50)
      .then((r) => { if (alive) { setItems(r.generations); setCursor(r.nextCursor) } })
      .catch(() => { if (alive) setError('Could not load your assets.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const loadMore = async () => {
    if (!cursor) return
    setMore(true)
    try {
      const r = await fetch(`/api/generations?limit=50&cursor=${encodeURIComponent(cursor)}`).then((x) => x.json())
      setItems((p) => [...p, ...(r.generations as Generation[])])
      setCursor(r.nextCursor)
    } catch { setError('Could not load more.') } finally { setMore(false) }
  }

  const counts = useMemo(() => ({
    video: items.filter((g) => kindOfModel(g.model) === 'video').length,
    image: items.filter((g) => kindOfModel(g.model) === 'image').length,
  }), [items])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((g) => {
      if (kind !== 'all' && kindOfModel(g.model) !== kind) return false
      if (!STATUS_MATCH[status](g.status)) return false
      if (!q) return true
      const hay = [g.prompt, g.motion.replace(/_/g, ' '), g.aspectRatio, modelName(g.model)].join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [items, query, kind, status])

  const remove = async (id: string) => {
    setItems((p) => p.filter((g) => g.id !== id))
    setOpen(null)
    currentStore.forget(id)
    try { await deleteGeneration(id) } catch { setError('Could not delete that asset.') }
  }

  const openInStudio = (g: Generation) => {
    const wf = kindOfModel(g.model) === 'image' ? 'image' : 'video'
    generationManager.remember(g)
    currentStore.set(wf, g.id)
    router.push(wf === 'image' ? '/studio/image' : '/studio')
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-24 pt-10 sm:px-6 lg:px-10">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow text-signal">Library</p>
          <h1 className="display display-l mt-3">Assets</h1>
          <p className="tabular mt-3 text-[13px] text-ink-2">
            {loading ? 'Loading…' : `${counts.video} videos · ${counts.image} images${cursor ? ' · more below' : ''}`}
          </p>
        </div>
        <p className="max-w-sm text-xs leading-relaxed text-ink-3">
          Everything you have made, stored in your account{auth.user?.email ? <> ({auth.user.email})</> : null}.
        </p>
      </header>

      <div className="sticky top-14 z-20 -mx-4 mt-8 border-y border-line bg-ground/95 px-4 py-3 backdrop-blur-[2px] sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative md:w-80">
            <IconSearch size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search your assets"
              placeholder="Search prompts, moves, models"
              className="h-9 w-full rounded-[var(--radius-ctl)] border border-line bg-surface pl-9 pr-3 text-[13px] text-ink
                placeholder:text-ink-4 focus:border-ink-4 focus:outline-none" />
          </div>
          <div className="w-full md:w-60">
            <Segmented<Kind> label="Type" value={kind} options={['all', 'video', 'image']} onChange={setKind}
              render={(k) => (k === 'all' ? 'All' : k === 'video' ? 'Video' : 'Image')} />
          </div>
          <div className="w-full md:w-80">
            <Segmented<Status> label="Status" value={status} options={['any', 'ready', 'running', 'failed']} onChange={setStatus}
              render={(s) => ({ any: 'Any', ready: 'Ready', running: 'Running', failed: 'Failed' })[s]} />
          </div>
          <span className="tabular text-xs text-ink-3 md:ml-auto">{shown.length} shown</span>
        </div>
      </div>

      {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}

      <div className="mt-6">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-video animate-pulse rounded-[4px] bg-surface-2" />)}
          </div>
        ) : !items.length ? (
          <div className="rounded-card border border-line bg-surface px-6 py-20 text-center">
            <p className="display display-s">Nothing here yet.</p>
            <p className="mx-auto mt-3 max-w-sm text-sm text-ink-3">Every video and image you generate lands here automatically.</p>
            <div className="mt-6 flex justify-center gap-2">
              <Link href="/studio" className={buttonClass('primary', 'md')}>Make a clip</Link>
              <Link href="/studio/image" className={buttonClass('secondary', 'md')}>Make an image</Link>
            </div>
          </div>
        ) : !shown.length ? (
          <div className="rounded-card border border-line bg-surface px-6 py-14 text-center">
            <p className="text-sm text-ink-2">No assets match these filters.</p>
            <button type="button" onClick={() => { setQuery(''); setKind('all'); setStatus('any') }}
              className="mt-3 text-xs text-signal hover:underline">Reset filters</button>
          </div>
        ) : (
          <div className="columns-2 gap-3 md:columns-3 xl:columns-4 2xl:columns-5">
            {shown.map((g) => <AssetTile key={g.id} g={g} onOpen={() => setOpen(g)} />)}
          </div>
        )}
        {cursor && !loading && (
          <div className="mt-8 flex justify-center">
            <Button variant="secondary" onClick={() => void loadMore()} disabled={more}>{more ? 'Loading…' : 'Load more'}</Button>
          </div>
        )}
      </div>

      {open && (
        <AssetSheet g={open} onClose={() => setOpen(null)} onDelete={() => void remove(open.id)}
          onOpenInStudio={() => openInStudio(open)} />
      )}
    </div>
  )
}

function AssetTile({ g, onOpen }: { g: Generation; onOpen: () => void }) {
  const [hover, setHover] = useState(false)
  const isVideo = kindOfModel(g.model) === 'video'
  const d = dimsOf(g)
  const ready = g.status === 'completed'
  // Same rule as History: an image is its own still; a clip shows its poster.
  const still = isVideo ? g.posterUrl : g.outputUrl ?? g.posterUrl
  const pending = g.status === 'queued' || g.status === 'generating'

  return (
    <article className="group mb-3 break-inside-avoid">
      <button type="button" onClick={onOpen} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        aria-label={`Open ${isVideo ? 'video' : 'image'}: ${g.prompt.slice(0, 60)}`}
        className="relative block w-full overflow-hidden rounded-[4px] border border-line bg-surface text-left transition-colors
          duration-150 group-hover:border-line-strong" style={{ aspectRatio: aspectOf(g) }}>
        {still ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={still} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        ) : isVideo && ready && g.outputUrl ? (
          // No poster (e.g. a provider video): the clip's own first frame.
          <video src={g.outputUrl} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] text-ink-4">
            {pending ? 'rendering…' : g.status === 'failed' ? 'no output' : 'no preview'}
          </span>
        )}
        {/* Hovering a finished clip plays the real file, muted. */}
        {isVideo && ready && hover && g.outputUrl && (
          <video src={g.outputUrl} muted loop autoPlay playsInline className="absolute inset-0 h-full w-full object-cover" />
        )}
        <span className="absolute left-2 top-2 flex gap-1">
          <Tag tone="neutral" onMedia>{isVideo ? `Video · ${g.durationS}s` : 'Image'}</Tag>
        </span>
        {g.status !== 'completed' && (
          <span className="absolute right-2 top-2">
            <Tag tone={g.status === 'failed' ? 'danger' : 'signal'} onMedia>{g.status === 'failed' ? 'Failed' : 'Running'}</Tag>
          </span>
        )}
      </button>
      <p className="mt-2 line-clamp-2 px-0.5 text-xs leading-snug text-ink-2">{g.prompt}</p>
      <p className="tabular mt-1 px-0.5 text-[11px] text-ink-3">
        {d.width}×{d.height} · {fileSize(g.fileBytes)} · {timeAgo(g.createdAt)}
      </p>
    </article>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line py-2 text-[13px] last:border-0">
      <dt className="text-ink-3">{k}</dt>
      <dd className="tabular text-right text-ink">{v}</dd>
    </div>
  )
}

function AssetSheet({
  g, onClose, onDelete, onOpenInStudio,
}: { g: Generation; onClose: () => void; onDelete: () => void; onOpenInStudio: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const isVideo = kindOfModel(g.model) === 'video'
  const d = dimsOf(g)
  const ready = g.status === 'completed' && g.outputUrl
  const error = g.errorCode ? ERROR_COPY[g.errorCode] ?? g.errorMessage : null

  return (
    <Sheet open onClose={onClose} title={isVideo ? 'Video' : 'Image'} wide>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex items-center justify-center bg-black p-3 lg:min-h-[420px]">
          <div className="relative w-full" style={{ aspectRatio: aspectOf(g), maxHeight: '64dvh', maxWidth: `calc(64dvh * ${aspectOf(g)})` }}>
            {ready && isVideo ? (
              <VideoPlayer key={g.outputUrl!} src={g.outputUrl!} poster={g.posterUrl ?? undefined} className="absolute inset-0 h-full w-full" />
            ) : ready ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={g.outputUrl!} alt={g.prompt} className="absolute inset-0 h-full w-full object-contain" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface px-6 text-center">
                <Tag tone={g.status === 'failed' ? 'danger' : 'signal'}>{g.status === 'failed' ? 'Failed' : 'Still rendering'}</Tag>
                {error && <p className="max-w-sm text-xs text-ink-2">{error}</p>}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col p-5">
          <p className="text-[14px] leading-relaxed text-ink">&ldquo;{g.prompt}&rdquo;</p>
          <dl className="mt-4">
            <Row k="Model" v={modelName(g.model)} />
            <Row k="Dimensions" v={`${d.width}×${d.height} · ${g.aspectRatio}`} />
            {isVideo && <Row k="Duration" v={`${g.durationS}s`} />}
            {isVideo && g.provider === 'cinematic' && <Row k="Camera move" v={getMotion(g.motion).label} />}
            {isVideo && g.provider === 'cinematic' && <Row k="Bitrate" v={g.bitrate} />}
            {!isVideo && <Row k="Quality" v={g.bitrate === 'high' ? 'High' : 'Standard'} />}
            {!isVideo && <Row k="Format" v="JPEG" />}
            <Row k="File size" v={fileSize(g.fileBytes)} />
            <Row k="Source" v={g.referenceUrl ? 'Your image' : 'Generated'} />
            <Row k="Created" v={new Date(g.createdAt).toLocaleString()} />
          </dl>
          {g.adjustments.length > 0 && (
            <p className="mt-3 text-[11px] leading-snug text-ink-3">{g.adjustments.map((a) => a.reason).join(' · ')}</p>
          )}
          <div className="mt-auto flex flex-wrap gap-2 pt-6">
            {ready && (
              <a href={downloadHref(g.outputUrl!, downloadName(g))} download={downloadName(g)} className={buttonClass('primary', 'md', DOWNLOAD_CLS)}>
                <IconDownload size={16} /> Download
              </a>
            )}
            <Button variant="secondary" onClick={onOpenInStudio}>Open in Studio <IconArrowRight size={14} /></Button>
            <Link href={remixHref(g)} className={buttonClass('ghost', 'md')}><IconRemix size={15} /> Remix</Link>
            <Button variant={confirm ? 'danger' : 'ghost'} className="ml-auto" onClick={() => (confirm ? onDelete() : setConfirm(true))}>
              <IconTrash size={15} /> {confirm ? 'Confirm delete' : 'Delete'}
            </Button>
          </div>
        </div>
      </div>
    </Sheet>
  )
}
