'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_FPS, bitrateFor, dimensionsFor, drawFrame, applyVignette,
  encodeVideo, frameCount, getMotion, hasWebCodecs,
} from '@/lib/engine'
import type { AspectRatio, Bitrate, MotionId, Resolution } from '@/lib/engine/types'
import type { Generation } from '@/lib/generation/types'
import { STILL_MODEL } from '@/lib/providers/cinematic'
import * as api from './api'
import { ApiError, type Catalog, type CreateInput } from './api'

export interface ComposerState {
  prompt: string
  model: string
  motion: MotionId
  durationS: number
  aspectRatio: AspectRatio
  resolution: Resolution
  bitrate: Bitrate
}

export const DEFAULT_COMPOSER: ComposerState = {
  prompt: '',
  model: 'slate-cinematic-1',
  motion: 'dolly_in',
  durationS: 6,
  aspectRatio: '16:9',
  resolution: '720p',
  bitrate: 'standard',
}

/** Live pipeline feedback for the job currently rendering in this tab. */
export interface RunState {
  id: string
  stage: 'image' | 'render' | 'encode' | 'upload'
  progress: number
}

const STAGE_FLOOR: Record<RunState['stage'], number> = {
  image: 0, render: 25, encode: 40, upload: 92,
}

export function useStudio() {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [composer, setComposer] = useState<ComposerState>(DEFAULT_COMPOSER)
  const [history, setHistory] = useState<Generation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [run, setRun] = useState<RunState | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [booting, setBooting] = useState(true)

  // One encode at a time: parallel encodes thrash the CPU and make every clip
  // slower. Extra requests queue instead.
  const busy = useRef(false)
  const queue = useRef<Generation[]>([])
  // Mirrored into state: reading queue.current during render would not
  // re-render when the queue changes, leaving the Generate button's disabled
  // state stale.
  const [queueDepth, setQueueDepth] = useState(0)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [cat, list] = await Promise.all([api.getCatalog(), api.listGenerations()])
        if (!alive) return
        setCatalog(cat)
        setHistory(list.generations)
        setSelectedId(list.generations[0]?.id ?? null)
      } catch {
        if (alive) setNotice('Could not reach the server. Check your connection and reload.')
      } finally {
        if (alive) setBooting(false)
      }
    })()
    return () => { alive = false }
  }, [])

  const upsert = useCallback((g: Generation) => {
    setHistory((prev) => {
      const i = prev.findIndex((x) => x.id === g.id)
      if (i === -1) return [g, ...prev]
      const next = [...prev]
      next[i] = g
      return next
    })
  }, [])

  /** Run one client-executed job: still -> camera move -> encode -> upload. */
  const runPipeline = useCallback(async (gen: Generation) => {
    const dims = dimensionsFor(gen.aspectRatio, gen.resolution)
    const total = frameCount(gen.durationS, DEFAULT_FPS)
    const bps = bitrateFor(dims, gen.bitrate, DEFAULT_FPS)
    const preset = getMotion(gen.motion, gen.seed)

    const mark = async (stage: RunState['stage'], pct: number) => {
      setRun({ id: gen.id, stage, progress: pct })
      try {
        // Doubles as the heartbeat the stale-sweep looks for.
        const { generation } = await api.patchGeneration(gen.id, {
          event: 'progress', stage, progress: Math.round(pct),
        })
        upsert(generation)
      } catch { /* a dropped progress ping must not kill the render */ }
    }

    try {
      upsert((await api.patchGeneration(gen.id, { event: 'start' })).generation)
      setRun({ id: gen.id, stage: 'image', progress: 0 })

      const img = new Image()
      img.decoding = 'async'
      await new Promise<void>((res, rej) => {
        img.onload = () => res()
        img.onerror = () => rej(new Error('still_unavailable'))
        img.src = api.stillUrl({
          prompt: gen.prompt, width: dims.width, height: dims.height,
          seed: gen.seed, model: STILL_MODEL[gen.model] ?? 'flux',
        })
      })
      await mark('render', STAGE_FLOOR.render)

      let lastPing = 0
      const out = await encodeVideo({
        dims, fps: DEFAULT_FPS, bitrate: bps, totalFrames: total,
        renderFrame: (ctx, _i, t) => {
          drawFrame(ctx, img, dims, preset.at(t))
          applyVignette(ctx, dims)
        },
        onProgress: (done, n) => {
          const pct = STAGE_FLOOR.encode + (done / n) * (STAGE_FLOOR.upload - STAGE_FLOOR.encode)
          setRun({ id: gen.id, stage: 'encode', progress: pct })
          const now = Date.now()
          if (now - lastPing > 2000) {
            lastPing = now
            void api.patchGeneration(gen.id, {
              event: 'progress', stage: 'encode', progress: Math.round(pct),
            }).catch(() => {})
          }
        },
      })

      await mark('upload', STAGE_FLOOR.upload)

      // Poster from the midpoint of the move, so it represents the clip.
      const pc = document.createElement('canvas')
      pc.width = dims.width; pc.height = dims.height
      const pctx = pc.getContext('2d')
      let poster: Blob | null = null
      if (pctx) {
        drawFrame(pctx, img, dims, preset.at(0.5))
        applyVignette(pctx, dims)
        poster = await new Promise<Blob | null>((r) => pc.toBlob(r, 'image/jpeg', 0.82))
      }

      const { generation } = await api.uploadArtifact(gen.id, out.blob, poster)
      upsert(generation)
      setSelectedId(generation.id)
    } catch (err) {
      const code =
        err instanceof ApiError ? err.code
        : err instanceof Error && err.message === 'still_unavailable' ? 'still_unavailable'
        : hasWebCodecs() ? 'encode_failed' : 'encode_unsupported'
      const message =
        code === 'still_unavailable' ? 'The image service did not respond. Try again.'
        : code === 'encode_unsupported' ? 'This browser cannot encode video.'
        : err instanceof Error ? err.message : 'Rendering failed.'
      try {
        const { generation } = await api.patchGeneration(gen.id, {
          event: 'fail', code, message: message.slice(0, 500),
        })
        upsert(generation)
        setSelectedId(generation.id)
      } catch { /* already terminal */ }
    } finally {
      setRun(null)
    }
  }, [upsert])

  const pump = useCallback(async () => {
    if (busy.current) return
    const next = queue.current.shift()
    setQueueDepth(queue.current.length)
    if (!next) return
    busy.current = true
    try { await runPipeline(next) } finally {
      busy.current = false
      void pump()
    }
  }, [runPipeline])

  const enqueue = useCallback((gen: Generation) => {
    upsert(gen)
    setSelectedId(gen.id)
    queue.current.push(gen)
    setQueueDepth(queue.current.length)
    void pump()
  }, [pump, upsert])

  const generate = useCallback(async () => {
    setFieldErrors({}); setNotice(null)
    try {
      const input: CreateInput = { ...composer, prompt: composer.prompt.trim() }
      const { generation } = await api.createGeneration(input)
      enqueue(generation)
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fields ?? {})
        setNotice(err.fields ? null : err.message)
      } else {
        setNotice('Could not start the generation.')
      }
    }
  }, [composer, enqueue])

  const retry = useCallback(async (id: string) => {
    try {
      const { generation } = await api.retryGeneration(id)
      enqueue(generation)
    } catch {
      setNotice('Could not retry that generation.')
    }
  }, [enqueue])

  const remove = useCallback(async (id: string) => {
    setHistory((prev) => prev.filter((g) => g.id !== id))
    setSelectedId((cur) => (cur === id ? null : cur))
    try { await api.deleteGeneration(id) } catch { setNotice('Could not delete that generation.') }
  }, [])

  /** Reload the composer with a past job's exact settings. */
  const reuse = useCallback((g: Generation) => {
    setComposer({
      prompt: g.prompt, model: g.model, motion: g.motion, durationS: g.durationS,
      aspectRatio: g.aspectRatio, resolution: g.resolution, bitrate: g.bitrate,
    })
  }, [])

  const selected = history.find((g) => g.id === selectedId) ?? null

  return {
    catalog, composer, setComposer, history, selected, selectedId, setSelectedId,
    run, fieldErrors, notice, setNotice, booting,
    generate, retry, remove, reuse,
    isRunning: run !== null || queueDepth > 0,
  }
}
