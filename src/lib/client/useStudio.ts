'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { ASPECT_RATIOS, RESOLUTIONS } from '@/lib/engine/types'
import type { AspectRatio, Bitrate, MotionId, Resolution } from '@/lib/engine/types'
import { MOTION_IDS } from '@/lib/engine/motion'
import type { Generation } from '@/lib/generation/types'
import { CINEMATIC_MODEL_ID, IMAGE_MODEL_ID, LTX_MODEL_ID, kindOfModel } from '@/lib/catalog'
import { byokKind, isByokModelId } from '@/lib/byok/catalog'
import { createSubmitGuard } from './submitGuard'
import type { Workflow } from '@/components/shell/nav'
import * as api from './api'
import { ApiError, type Catalog, type CreateInput } from './api'
import { generationManager, type RunState } from './generationManager'
import { currentStore, useCurrent } from './current'

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
  /** Video: encode bitrate. Image: quality tier (standard / high). */
  bitrate: Bitrate
}

const BASE: ComposerState = {
  prompt: '',
  referenceUrl: null,
  model: CINEMATIC_MODEL_ID,
  motion: 'dolly_in',
  durationS: 6,
  aspectRatio: '16:9',
  resolution: '720p',
  bitrate: 'standard',
}

export const DEFAULTS: Record<Workflow, ComposerState> = {
  // Video is generative video only. Camera moves over a still (Slate
  // Cinematic 1) are the Camera Motion workflow.
  video: { ...BASE, model: LTX_MODEL_ID, durationS: 6, motion: 'static' },
  image: { ...BASE, model: IMAGE_MODEL_ID, aspectRatio: '4:5', motion: 'static' },
  motion: { ...BASE, motion: 'orbit_left', durationS: 6 },
}

const LTX_DURATIONS = [4, 6, 8] as const
const nearestLtx = (n: number) =>
  LTX_DURATIONS.reduce<number>((best, d) => (Math.abs(d - n) < Math.abs(best - n) ? d : best), LTX_DURATIONS[0])

/**
 * Keep a composer inside what its workflow runs. The Video workflow runs
 * LTX-2 Pro (4, 6 or 8 seconds) or a video model on the user's own provider,
 * never a camera move; Image runs Slate's image model or a user-provider
 * image model; Camera Motion runs Slate Cinematic.
 */
export function forWorkflow(workflow: Workflow, c: ComposerState): ComposerState {
  if (workflow === 'video') {
    // A video model on the user's own provider keeps its own documented
    // durations; anything else runs on LTX-2 Pro.
    if (byokKind(c.model) === 'video') return { ...c, motion: 'static' }
    return { ...c, model: LTX_MODEL_ID, durationS: nearestLtx(c.durationS), motion: 'static' }
  }
  // Image runs Slate's image model or an image model on the user's own
  // provider; Camera Motion runs Slate Cinematic. Nothing else slips in.
  if (workflow === 'image') {
    const ok = c.model === IMAGE_MODEL_ID || byokKind(c.model) === 'image'
    return ok ? c : { ...c, model: IMAGE_MODEL_ID }
  }
  return c.model === CINEMATIC_MODEL_ID ? c : { ...c, model: CINEMATIC_MODEL_ID }
}

/** Back-compat for callers that import the old single default. */
export const DEFAULT_COMPOSER = BASE

const VIDEO_MODELS = [CINEMATIC_MODEL_ID, LTX_MODEL_ID]

/**
 * Hydrate the composer from URL params so Explore, the Motion library and the
 * model catalogue can hand real parameters to Studio with a plain link.
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

  const model = params.get('model')
  // A user-key model id is metadata only (provider + model name); whether it
  // can run is decided by the key active in this tab, never by the URL.
  if (model && (VIDEO_MODELS.includes(model) || isByokModelId(model) && byokKind(model) !== null)) out.model = model
  return out
}

const newestFirst = (a: Generation, b: Generation) =>
  a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0

/**
 * Which workflow's History a generation appears in. Each workflow shows only
 * its own media: Image shows images, Camera Motion shows clips made in Camera
 * Motion, Video shows every other clip (including rows made before the
 * workflow was recorded).
 */
export const belongsTo = (workflow: Workflow, g: Pick<Generation, 'model' | 'workflow'>) => {
  const kind = kindOfModel(g.model)
  if (workflow === 'image') return kind === 'image'
  if (workflow === 'motion') return kind === 'video' && g.workflow === 'motion'
  return kind === 'video' && g.workflow !== 'motion'
}

/** Video workflow input mode: prompt only, or starting from the user's image. */
export type VideoMode = 'text' | 'image'

export function useStudio(workflow: Workflow, initial?: Partial<ComposerState>, videoMode: VideoMode = 'text') {
  const hasPreset = Boolean(initial && Object.keys(initial).length)
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [composer, setComposerState] = useState<ComposerState>(() => forWorkflow(workflow, { ...DEFAULTS[workflow], ...initial }))
  const [fetched, setFetched] = useState<Generation[]>([])
  const [deleted, setDeleted] = useState<Set<string>>(() => new Set())
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<string | null>(null)
  /** Generate was pressed but the server refused to start a job. */
  const [startError, setStartError] = useState<string | null>(null)
  const [booting, setBooting] = useState(true)
  /** The finished result a Remix started from. Shown ghosted, never as current. */
  const [remixOf, setRemixOf] = useState<Generation | null>(null)
  const presetRef = useRef(hasPreset)
  const guard = useRef(createSubmitGuard())

  const snapshot = useSyncExternalStore(
    generationManager.subscribe,
    generationManager.getSnapshot,
    generationManager.getServerSnapshot,
  )
  const currentId = useCurrent(workflow)

  useEffect(() => {
    // Arriving with a preset is a new creation: the preview goes back to the
    // contextual state rather than showing whatever was current before.
    if (presetRef.current) currentStore.set(workflow, null)
  }, [workflow])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [cat, list] = await Promise.all([api.getCatalog(), api.listGenerations(50)])
        if (!alive) return
        setCatalog(cat)
        setFetched(list.generations)
      } catch {
        if (alive) setNotice('Could not reach Slate. Check your connection and reload.')
      } finally {
        if (alive) setBooting(false)
      }
    })()
    return () => { alive = false }
  }, [])

  /**
   * History is derived: the server list overlaid with whatever the manager has
   * changed since, filtered to this workflow's kind of output.
   */
  const history = useMemo(() => {
    const map = new Map<string, Generation>()
    for (const g of fetched) map.set(g.id, g)
    for (const g of Object.values(snapshot.updated)) map.set(g.id, g)
    return [...map.values()]
      .filter((g) => !deleted.has(g.id) && belongsTo(workflow, g))
      .sort(newestFirst)
  }, [fetched, snapshot.updated, deleted, workflow])

  // No fallback to history[0]: with nothing current, the stage shows the
  // contextual preview. A fresh visit never opens on an old result.
  const current = (currentId && history.find((g) => g.id === currentId)) || null
  const run: RunState | null = (current && snapshot.runs[current.id]) || null

  const open = useCallback((id: string | null) => {
    setRemixOf(null)
    currentStore.set(workflow, id)
  }, [workflow])

  /**
   * Editing the prompt after a finished result starts a new creation, so the
   * preview returns to the contextual state. A render still in progress keeps
   * the stage: hiding live progress would read as lost work.
   */
  const finished = current?.status === 'completed' || current?.status === 'failed'
  const setComposer = useCallback((next: ComposerState) => {
    // Choosing another model answers a "not configured" error; the stage returns to normal.
    if (next.model !== composer.model) setStartError(null)
    if (finished && next.prompt !== composer.prompt) {
      // Keep the result in view, ghosted, rather than swapping to a demo frame.
      if (current?.status === 'completed') setRemixOf(current)
      currentStore.set(workflow, null)
    }
    setComposerState(next)
  }, [finished, composer.prompt, composer.model, workflow, current])

  // One click, one job: a double click (or Enter pressed twice) before the
  // first request returns must not start a second, billable generation.
  const generate = useCallback(() => guard.current.run(async () => {
    setFieldErrors({}); setNotice(null); setStartError(null)
    try {
      // Text to Video never sends an image, even one still held from Image mode.
      const usesImage = workflow === 'motion' || (workflow === 'video' && videoMode === 'image')
      const input: CreateInput = {
        ...composer,
        prompt: composer.prompt.trim(),
        referenceUrl: usesImage ? composer.referenceUrl ?? null : null,
        workflow,
      }
      const { generation, execution } = await api.createGeneration(input)
      setRemixOf(null)
      currentStore.set(workflow, generation.id)
      generationManager.enqueue(generation, execution === 'server' ? 'server' : 'client')
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fields ?? {})
        setNotice(err.fields ? null : err.message)
        // Anything that stops the job itself (not a fixable field) is shown in the stage.
        const blocking = err.fields ? err.fields.model ?? null : err.message
        if (blocking) setStartError(blocking)
      } else {
        setNotice('Could not start the generation.')
        setStartError('Could not start the generation.')
      }
    }
  }), [composer, workflow, videoMode])

  const retry = useCallback(async (id: string) => {
    try {
      const { generation, execution } = await api.retryGeneration(id)
      currentStore.set(workflow, generation.id)
      generationManager.enqueue(generation, execution === 'server' ? 'server' : 'client')
    } catch {
      setNotice('Could not retry that generation.')
    }
  }, [workflow])

  const remove = useCallback(async (id: string) => {
    setDeleted((d) => new Set(d).add(id))
    currentStore.forget(id)
    try { await api.deleteGeneration(id) } catch { setNotice('Could not delete that generation.') }
  }, [])

  /**
   * Remix: the same prompt and settings, as a NEW generation. It is not
   * image-to-image; the previous result is only shown, ghosted, for context.
   */
  const remix = useCallback((g: Generation) => {
    setRemixOf(g)
    setComposerState((c) => forWorkflow(workflow, {
      ...c,
      prompt: g.prompt, model: g.model, motion: g.motion, durationS: g.durationS,
      aspectRatio: g.aspectRatio, resolution: g.resolution, bitrate: g.bitrate,
      referenceUrl: g.referenceUrl,
    }))
    currentStore.set(workflow, null)
  }, [workflow])

  /** Back to a fresh creation. The previous result stays in History and Assets. */
  const reset = useCallback(() => {
    setRemixOf(null)
    setStartError(null)
    currentStore.set(workflow, null)
    setComposerState((c) => ({ ...c, prompt: '' }))
    setFieldErrors({})
  }, [workflow])

  return {
    catalog, composer, setComposer,
    history, current, run, open, remixOf,
    fieldErrors, notice, setNotice, booting,
    generate, retry, remove, remix, reset,
    startError,
    clearErrors: () => { setNotice(null); setFieldErrors({}); setStartError(null) },
    cancel: generationManager.cancel,
    isRunning: snapshot.pending.length > 0,
  }
}
