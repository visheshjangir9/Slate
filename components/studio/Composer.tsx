'use client'

import { useEffect, useRef, useState } from 'react'
import { bitrateFor, dimensionsFor, frameCount, DEFAULT_FPS } from '@/lib/engine'
import type { AspectRatio, Bitrate, Resolution, MotionId } from '@/lib/engine/types'
import type { Catalog } from '@/lib/client/api'
import type { ComposerState } from '@/lib/client/useStudio'
import { Badge, Label, Panel, Segmented, Slider } from './primitives'
import { MediaInput } from './MediaInput'

const EXAMPLES = [
  'a lone figure on a rain-slicked Tokyo street, neon signs bleeding into the puddles',
  'sunrise over a fog-filled valley, pine ridges receding into haze',
  'an astronaut drifting past the curve of a planet, visor catching the light',
]

export function Composer({
  catalog, state, onChange, onGenerate, running, fieldErrors,
}: {
  catalog: Catalog | null
  state: ComposerState
  onChange: (s: ComposerState) => void
  onGenerate: () => void
  running: boolean
  fieldErrors: Record<string, string>
}) {
  const [motionOpen, setMotionOpen] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const set = <K extends keyof ComposerState>(k: K, v: ComposerState[K]) =>
    onChange({ ...state, [k]: v })

  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`
  }, [state.prompt])

  const dims = dimensionsFor(state.aspectRatio, state.resolution)
  const frames = frameCount(state.durationS, DEFAULT_FPS)
  const mbps = bitrateFor(dims, state.bitrate, DEFAULT_FPS) / 1e6
  const canGenerate = state.prompt.trim().length >= 3

  const motions = catalog?.motions ?? []
  const activeMotion = motions.find((m) => m.id === state.motion)

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-5">
      <MediaInput
        value={state.referenceUrl}
        onChange={(url) => set('referenceUrl', url)}
        disabled={running}
      />

      {/* Prompt — the first-class surface. */}
      <div>
        <Label hint={`${state.prompt.length}/2000`}>Prompt</Label>
        <div
          className={[
            'rounded-card border bg-surface transition-colors duration-150',
            fieldErrors.prompt ? 'border-danger/60' : 'border-line focus-within:border-line-strong',
          ].join(' ')}
        >
          <textarea
            ref={taRef}
            value={state.prompt}
            onChange={(e) => set('prompt', e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canGenerate && !running) onGenerate()
            }}
            rows={3}
            maxLength={2000}
            placeholder={
              state.referenceUrl
                ? 'Describe the shot (kept with the clip; the reference supplies the frame)'
                : 'Describe the shot. Subject, setting, light, mood.'
            }
            className="w-full resize-none bg-transparent px-3 py-2.5 text-sm leading-relaxed
              text-ink placeholder:text-ink-4 focus:outline-none"
          />
        </div>
        {fieldErrors.prompt && <p className="mt-1.5 text-xs text-danger">{fieldErrors.prompt}</p>}
        {!state.prompt && (
          <div className="mt-2 flex flex-col gap-1">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => set('prompt', ex)}
                className="truncate rounded-md px-2 py-1.5 text-left text-xs text-ink-3
                  transition-colors duration-150 hover:bg-surface-2 hover:text-ink-2"
              >
                {ex}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Model */}
      <div>
        <Label>Model</Label>
        <div className="flex flex-col gap-1.5">
          {(catalog?.models ?? []).map((m) => {
            const active = m.id === state.model
            return (
              <button
                key={m.id}
                type="button"
                disabled={!m.available}
                onClick={() => set('model', m.id)}
                className={[
                  'rounded-card border px-3 py-2.5 text-left transition-all duration-150',
                  active ? 'border-line-strong bg-surface-2' : 'border-line bg-surface hover:border-line-strong',
                  !m.available && 'cursor-not-allowed opacity-40',
                ].filter(Boolean).join(' ')}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-accent' : 'bg-ink-4'}`} />
                  <span className="text-sm font-medium">{m.label}</span>
                  {m.badge && <Badge tone={m.badge === 'TOP' ? 'accent' : 'neutral'}>{m.badge}</Badge>}
                </div>
                <p className="mt-1 pl-3.5 text-xs leading-snug text-ink-3">{m.description}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Camera move — the signature control. */}
      <div>
        <Label hint={`${motions.length} moves`}>Camera motion</Label>
        <button
          type="button"
          onClick={() => setMotionOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-card border border-line bg-surface
            px-3 py-2.5 text-left transition-colors duration-150 hover:border-line-strong"
        >
          <span>
            <span className="text-sm font-medium">{activeMotion?.label ?? 'Select'}</span>
            <span className="mt-0.5 block text-xs text-ink-3">{activeMotion?.description}</span>
          </span>
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden
            className={`shrink-0 text-ink-3 transition-transform duration-200 ${motionOpen ? 'rotate-180' : ''}`}>
            <path d="M2 4.5 L6 8.5 L10 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </svg>
        </button>
        {motionOpen && (
          <div className="rise mt-1.5 grid grid-cols-2 gap-1.5">
            {motions.map((m) => {
              const active = m.id === state.motion
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { set('motion', m.id as MotionId); setMotionOpen(false) }}
                  className={[
                    'rounded-md border px-2.5 py-2 text-left transition-all duration-150',
                    active ? 'border-accent-dim bg-surface-2' : 'border-line bg-surface hover:border-line-strong',
                  ].join(' ')}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-medium">{m.label}</span>
                    {m.badge && <Badge tone="accent">{m.badge}</Badge>}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="flex flex-col gap-3.5">
        <div>
          <Label hint={`${frames} frames`}>Duration</Label>
          <Slider
            value={state.durationS}
            min={catalog?.settings.duration.min ?? 4}
            max={catalog?.settings.duration.max ?? 30}
            onChange={(n) => set('durationS', n)}
            suffix="s"
          />
        </div>
        <div>
          <Label>Aspect ratio</Label>
          <Segmented
            value={state.aspectRatio}
            options={(catalog?.settings.aspectRatios ?? []) as AspectRatio[]}
            onChange={(v) => set('aspectRatio', v)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Resolution</Label>
            <Segmented
              value={state.resolution}
              options={(catalog?.settings.resolutions ?? []) as Resolution[]}
              onChange={(v) => set('resolution', v)}
            />
          </div>
          <div>
            <Label>Bitrate</Label>
            <Segmented
              value={state.bitrate}
              options={(catalog?.settings.bitrates ?? []) as Bitrate[]}
              onChange={(v) => set('bitrate', v)}
              render={(v) => (v === 'standard' ? 'Std' : 'High')}
            />
          </div>
        </div>
      </div>

      {/* Live spec — proves the settings are real before you click. */}
      <Panel className="px-3 py-2.5">
        <div className="tabular flex items-center justify-between text-[11px] text-ink-3">
          <span>{dims.width}&times;{dims.height}</span>
          <span>{state.durationS}s &middot; {DEFAULT_FPS}fps</span>
          <span>&le;{mbps.toFixed(1)} Mbps</span>
        </div>
      </Panel>

      </div>

      {/* Pinned: the primary action must never scroll out of reach. */}
      <div className="shrink-0 border-t border-line bg-ground p-3 sm:p-4">
        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate || running}
          title={!canGenerate ? 'Write a prompt first' : running ? 'A render is already running' : undefined}
          className="flex w-full items-center justify-center gap-2 rounded-card bg-ink px-4 py-3
            text-sm font-semibold text-ground transition-all duration-150
            hover:bg-white disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-4"
        >
          {running ? 'Rendering…' : 'Generate'}
          {!running && (
            <kbd className="tabular rounded border border-ground/20 px-1 text-[10px] opacity-55">&#8984;&crarr;</kbd>
          )}
        </button>
      </div>
    </div>
  )
}
