'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { ASPECT_RATIOS, RESOLUTIONS } from '@/lib/engine/types'
import type { AspectRatio, Bitrate, MotionId, Resolution } from '@/lib/engine/types'
import { MOTION_IDS } from '@/lib/engine/motion'
import type { Generation } from '@/lib/generation/types'
import * as api from './api'
import { ApiError, type Catalog, type CreateInput } from './api'
import { generationManager, type RunState } from './generationManager'

export type { RunState } from './generationManager'

export interface ComposerState {
  prompt: string
  /** When set, this image is the source frame instead of a generated still. */
  referenceUrl?: string | null
  model: string
  motion: MotionId
  durationS: number
  aspectRatio: AspectRatio
  resolution: Resolution
  bitrate: Bitrate
}

export const DEFAULT_COMPOSER: ComposerState = {
  prompt: '',
  referenceUrl: null,
  model: 'slate-cinematic-1',
  motion: 'dolly_in',
  durationS: 6,
  aspectRatio: '16:9',
  resolution: '720p',
  bitrate: 'standard',
}

/**
 * Hydrate the composer from URL params so Explore and the Motion Library can
 * hand real parameters to Create Video with a plain link.
 *
 * Validated against the static enums, not the fetched catalogue: the catalogue
 * is null at mount, so validating against it silently dropped every value.
 */
export function composerFromParams(params: URLSearchParams | null): Partial<ComposerState> {
  if (!params) return {}
  const out: Partial<ComposerState> = {}
  const prompt = params.get('prompt')
  if (prompt && prompt.trim().length >= 3) out.prompt = prompt.slice(0, 2000)

  const motion = params.get('motion')
  if (motion && (MOTION_IDS as string[]).includes(motion)) out.motion = motion as MotionId

  const dur = Number(params.get('duration'))
  if (Number.isInteger(dur) && dur >= 4 && dur <= 30) out.durationS = dur

  const aspect = params.get('aspect')
  if (aspect && (ASPECT_RATIOS as readonly string[]).includes(aspect)) {
    out.aspectRatio = aspect as AspectRatio
  }
  const res = params.get('resolution')
  if (res && (RESOLUTIONS as readonly string[]).includes(res)) out.resolution = res as Resolution

  const br = params.get('bitrate')
  if (br === 'standard' || br === 'high') out.bitrate = br
  return out
}

const newestFirst = (a: Generation, b: Generation) =>
  a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0

export function useStudio(initial?: Partial<ComposerState>) {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [composer, setComposer] = useState<ComposerState>({ ...DEFAULT_COMPOSER, ...initial })
  const [fetched, setFetched] = useState<Generation[]>([])
  const [deleted, setDeleted] = useState<Set<string>>(() => new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [booting, setBooting] = useState(true)
  const initialRef = useRef(initial)

  // The pipeline lives outside React so it survives route changes; this view
  // only subscribes to it.
  const snapshot = useSyncExternalStore(
    generationManager.subscribe,
    generationManager.getSnapshot,
    generationManager.getServerSnapshot,
  )

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [cat, list] = await Promise.all([api.getCatalog(), api.listGenerations()])
        if (!alive) return
        setCatalog(cat)
        if (initialRef.current) setComposer((c) => ({ ...c, ...initialRef.current }))
        setFetched(list.generations)
      } catch {
        if (alive) setNotice('Could not reach the server. Check your connection and reload.')
      } finally {
        if (alive) setBooting(false)
      }
    })()
    return () => { alive = false }
  }, [])

  /**
   * History is derived, not stored: the server list overlaid with whatever the
   * manager has changed since. No effect needs to copy one into the other, so
   * a render in flight cannot be lost by a remount.
   */
  const history = useMemo(() => {
    const map = new Map<string, Generation>()
    for (const g of fetched) map.set(g.id, g)
    for (const g of Object.values(snapshot.updated)) map.set(g.id, g)
    return [...map.values()].filter((g) => !deleted.has(g.id)).sort(newestFirst)
  }, [fetched, snapshot.updated, deleted])

  // The stage shows the pinned generation when it still exists, otherwise the
  // newest. Derived from state rather than a ref, so it is safe during render
  // and recovers on its own when the pinned item is deleted.
  const effectiveSelectedId =
    selectedId && history.some((g) => g.id === selectedId) ? selectedId : history[0]?.id ?? null

  const selected = history.find((g) => g.id === effectiveSelectedId) ?? null
  const run: RunState | null =
    (effectiveSelectedId && snapshot.runs[effectiveSelectedId]) || null

  const select = useCallback((id: string | null) => setSelectedId(id), [])

  const generate = useCallback(async () => {
    setFieldErrors({}); setNotice(null)
    try {
      const input: CreateInput = {
        ...composer,
        prompt: composer.prompt.trim(),
        referenceUrl: composer.referenceUrl ?? null,
      }
      const { generation } = await api.createGeneration(input)
      setSelectedId(generation.id)
      generationManager.enqueue(generation)
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fields ?? {})
        setNotice(err.fields ? null : err.message)
      } else {
        setNotice('Could not start the generation.')
      }
    }
  }, [composer])

  const retry = useCallback(async (id: string) => {
    try {
      const { generation } = await api.retryGeneration(id)
      setSelectedId(generation.id)
      generationManager.enqueue(generation)
    } catch {
      setNotice('Could not retry that generation.')
    }
  }, [])

  const remove = useCallback(async (id: string) => {
    setDeleted((d) => new Set(d).add(id))
    if (effectiveSelectedId === id) setSelectedId(null)
    try { await api.deleteGeneration(id) } catch { setNotice('Could not delete that generation.') }
  }, [effectiveSelectedId])

  /** Load a past job's exact settings back into the composer. */
  const remix = useCallback((g: Generation) => {
    setComposer({
      prompt: g.prompt, model: g.model, motion: g.motion, durationS: g.durationS,
      aspectRatio: g.aspectRatio, resolution: g.resolution, bitrate: g.bitrate,
      referenceUrl: g.referenceUrl,
    })
  }, [])

  const cancel = useCallback((id: string) => generationManager.cancel(id), [])
  const cancelAll = useCallback(() => generationManager.cancelAll(), [])

  return {
    catalog, composer, setComposer,
    history, selected, selectedId: effectiveSelectedId, setSelectedId: select,
    run, fieldErrors, notice, setNotice, booting,
    generate, retry, remove, reuse: remix, cancel, cancelAll,
    pending: snapshot.pending,
    isRunning: snapshot.pending.length > 0,
  }
}
