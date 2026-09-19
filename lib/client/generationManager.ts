'use client'

import {
  DEFAULT_FPS, applyVignette, bitrateFor, dimensionsFor, drawFrame,
  encodeVideo, frameCount, getMotion, hasWebCodecs,
} from '@/lib/engine'
import type { Generation } from '@/lib/generation/types'
import { STILL_MODEL } from '@/lib/providers/cinematic'
import * as api from './api'
import { ApiError } from './api'

export interface RunState {
  id: string
  stage: 'image' | 'render' | 'encode' | 'upload'
  progress: number
}

export interface ManagerSnapshot {
  version: number
  /** Live progress for jobs rendering in this tab, keyed by generation id. */
  runs: Record<string, RunState>
  /** Generations changed by the manager, so a remounting view can catch up. */
  updated: Record<string, Generation>
  /** Ids waiting for the encoder, plus the one currently running. */
  pending: string[]
}

/** Floor for each stage, so progress within a run only ever moves forward. */
const STAGE_FLOOR: Record<RunState['stage'], number> = {
  image: 0, render: 25, encode: 40, upload: 92,
}

/**
 * Generation manager.
 *
 * Deliberately a module singleton rather than React state. The render pipeline
 * used to live inside the Studio component, so navigating to another route
 * unmounted it: live progress was lost, the view fell back to the server's
 * last throttled value (which reads as progress jumping backwards), and once
 * heartbeats stopped the stale sweep failed the job outright.
 *
 * Living outside the component tree, the pipeline survives navigation. Views
 * subscribe and unsubscribe freely; the work carries on either way.
 */
class GenerationManager {
  private listeners = new Set<() => void>()
  private queue: Generation[] = []
  private busy = false
  private aborters = new Map<string, AbortController>()
  /** Highest progress seen per id. Guards against any backwards render. */
  private peak = new Map<string, number>()

  private snap: ManagerSnapshot = { version: 0, runs: {}, updated: {}, pending: [] }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }

  getSnapshot = (): ManagerSnapshot => this.snap

  /** Server snapshot: no work runs during SSR, so the state is empty. */
  getServerSnapshot = (): ManagerSnapshot => EMPTY_SNAPSHOT

  private commit(patch: Partial<ManagerSnapshot>) {
    this.snap = {
      ...this.snap,
      ...patch,
      version: this.snap.version + 1,
      pending: [...this.queue.map((g) => g.id), ...(this.activeId ? [this.activeId] : [])],
    }
    this.listeners.forEach((l) => l())
  }

  private activeId: string | null = null

  private setRun(id: string, stage: RunState['stage'], progress: number) {
    // Never move a job's displayed progress backwards.
    const floor = this.peak.get(id) ?? 0
    const next = Math.max(floor, progress)
    this.peak.set(id, next)
    this.commit({ runs: { ...this.snap.runs, [id]: { id, stage, progress: next } } })
  }

  private clearRun(id: string) {
    const runs = { ...this.snap.runs }
    delete runs[id]
    this.peak.delete(id)
    this.commit({ runs })
  }

  private publish(g: Generation) {
    this.commit({ updated: { ...this.snap.updated, [g.id]: g } })
  }

  /** True while this id is queued or rendering in this tab. */
  isActive = (id: string): boolean => this.snap.pending.includes(id)

  get hasWork(): boolean {
    return this.busy || this.queue.length > 0
  }

  /**
   * `execution` decides where the work happens. Server-backed models run
   * entirely on the server and are polled; only the in-browser engine needs
   * this tab to stay alive.
   */
  enqueue = (gen: Generation, execution: 'client' | 'server' = 'client'): void => {
    this.queue.push(Object.assign(gen, { __execution: execution }))
    this.publish(gen)
    void this.pump()
  }

  /** Real cancellation: aborts the encoder and fails the job server-side. */
  cancel = async (id: string): Promise<void> => {
    this.queue = this.queue.filter((g) => g.id !== id)
    this.aborters.get(id)?.abort()
    this.aborters.delete(id)
    try {
      const { generation } = await api.patchGeneration(id, {
        event: 'fail', code: 'cancelled', message: 'Cancelled before the render finished.',
      })
      this.publish(generation)
    } catch { /* already terminal */ }
    this.clearRun(id)
  }

  cancelAll = async (): Promise<void> => {
    const ids = [...this.snap.pending]
    await Promise.all(ids.map((id) => this.cancel(id)))
  }

  private async pump(): Promise<void> {
    if (this.busy) return
    const next = this.queue.shift()
    if (!next) { this.commit({}); return }
    this.busy = true
    this.activeId = next.id
    this.commit({})
    try {
      const execution = (next as Generation & { __execution?: string }).__execution
      if (execution === 'server') await this.runServer(next)
      else await this.run(next)
    } finally {
      this.busy = false
      this.activeId = null
      void this.pump()
    }
  }

  /**
   * Server-backed render. The server owns the whole pipeline, so this only
   * starts it and follows the row. Progress comes from stages the server
   * actually wrote -- nothing here is interpolated.
   */
  private async runServer(gen: Generation): Promise<void> {
    const ac = new AbortController()
    this.aborters.set(gen.id, ac)
    this.setRun(gen.id, 'image', STAGE_FLOOR.image)

    let polling = true
    const poll = async () => {
      while (polling && !ac.signal.aborted) {
        await new Promise((r) => setTimeout(r, 2500))
        if (!polling || ac.signal.aborted) break
        try {
          const { generation } = await api.getGeneration(gen.id)
          this.publish(generation)
          if (generation.status === 'generating' && generation.stage) {
            this.setRun(gen.id, generation.stage, Math.max(generation.progress, STAGE_FLOOR[generation.stage]))
          }
          if (generation.status === 'completed' || generation.status === 'failed') break
        } catch { /* a dropped poll must not end the job */ }
      }
    }
    const polled = poll()

    try {
      const { generation } = await api.renderGeneration(gen.id)
      this.publish(generation)
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'render_failed'
      try {
        const { generation } = await api.patchGeneration(gen.id, {
          event: 'fail', code, message: err instanceof Error ? err.message.slice(0, 500) : 'Render failed.',
        })
        this.publish(generation)
      } catch { /* server already marked it */ }
    } finally {
      polling = false
      await polled
      this.aborters.delete(gen.id)
      this.clearRun(gen.id)
    }
  }

  private async run(gen: Generation): Promise<void> {
    const dims = dimensionsFor(gen.aspectRatio, gen.resolution)
    const total = frameCount(gen.durationS, DEFAULT_FPS)
    const bps = bitrateFor(dims, gen.bitrate, DEFAULT_FPS)
    const preset = getMotion(gen.motion, gen.seed)

    const ac = new AbortController()
    this.aborters.set(gen.id, ac)

    const mark = async (stage: RunState['stage'], pct: number) => {
      this.setRun(gen.id, stage, pct)
      try {
        // Doubles as the heartbeat the stale sweep looks for.
        const { generation } = await api.patchGeneration(gen.id, {
          event: 'progress', stage, progress: Math.round(pct),
        })
        this.publish(generation)
      } catch { /* a dropped ping must not kill the render */ }
    }

    try {
      const started = await api.patchGeneration(gen.id, { event: 'start' })
      this.publish(started.generation)
      this.setRun(gen.id, 'image', STAGE_FLOOR.image)

      const img = new Image()
      img.decoding = 'async'
      img.crossOrigin = 'anonymous'
      await new Promise<void>((res, rej) => {
        img.onload = () => res()
        img.onerror = () => rej(new Error(gen.referenceUrl ? 'reference_unreadable' : 'still_unavailable'))
        // A reference image replaces the generated still entirely.
        img.src = gen.referenceUrl ?? api.stillUrl({
          prompt: gen.prompt, width: dims.width, height: dims.height,
          seed: gen.seed, model: STILL_MODEL[gen.model] ?? 'flux',
        })
      })
      if (ac.signal.aborted) throw new Error('cancelled')
      await mark('render', STAGE_FLOOR.render)

      let lastPing = 0
      const out = await encodeVideo({
        dims, fps: DEFAULT_FPS, bitrate: bps, totalFrames: total, signal: ac.signal,
        renderFrame: (ctx, _i, t) => {
          drawFrame(ctx, img, dims, preset.at(t))
          applyVignette(ctx, dims)
        },
        onProgress: (done, n) => {
          const pct = STAGE_FLOOR.encode + (done / n) * (STAGE_FLOOR.upload - STAGE_FLOOR.encode)
          this.setRun(gen.id, 'encode', pct)
          const now = Date.now()
          if (now - lastPing > 2000) {
            lastPing = now
            void api.patchGeneration(gen.id, {
              event: 'progress', stage: 'encode', progress: Math.round(pct),
            }).then(({ generation }) => this.publish(generation)).catch(() => {})
          }
        },
      })

      if (ac.signal.aborted) throw new Error('cancelled')
      await mark('upload', STAGE_FLOOR.upload)

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
      this.publish(generation)
    } catch (err) {
      const cancelled = ac.signal.aborted || (err instanceof Error && err.message === 'cancelled')
      if (!cancelled) {
        const code =
          err instanceof ApiError ? err.code
          : err instanceof Error && err.message === 'still_unavailable' ? 'still_unavailable'
          : err instanceof Error && err.message === 'reference_unreadable' ? 'reference_unreadable'
          : hasWebCodecs() ? 'encode_failed' : 'encode_unsupported'
        const message = err instanceof Error ? err.message : 'Rendering failed.'
        try {
          const { generation } = await api.patchGeneration(gen.id, {
            event: 'fail', code, message: message.slice(0, 500),
          })
          this.publish(generation)
        } catch { /* already terminal */ }
      }
    } finally {
      this.aborters.delete(gen.id)
      this.clearRun(gen.id)
    }
  }
}

const EMPTY_SNAPSHOT: ManagerSnapshot = { version: 0, runs: {}, updated: {}, pending: [] }

/**
 * One instance per tab, stashed on globalThis so a hot reload in development
 * does not orphan an in-flight render behind a fresh module instance.
 */
const g = globalThis as typeof globalThis & { __slateManager?: GenerationManager }
export const generationManager: GenerationManager = (g.__slateManager ??= new GenerationManager())
export type { GenerationManager }
