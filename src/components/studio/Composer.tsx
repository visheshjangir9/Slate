'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ASPECT_RATIOS, RESOLUTIONS, MAX_DURATION_S, MIN_DURATION_S, bitrateFor, dimensionsFor, DEFAULT_FPS } from '@/lib/engine'
import type { AspectRatio, Bitrate, Resolution } from '@/lib/engine/types'
import { LTX_MODEL_ID, liveModel } from '@/lib/catalog'
import { imageOutputDims } from '@/lib/images/dims'
import { byokProvider, parseByokModelId } from '@/lib/byok/catalog'
import { runsFor, useByok } from '@/lib/client/byok'
import type { Catalog } from '@/lib/client/api'
import type { ComposerState, VideoMode } from '@/lib/client/useStudio'
import type { Workflow } from '@/components/shell/nav'
import { Button, FieldLabel, Popover, Segmented, Spec, Tag } from '@/components/ui/primitives'
import { IconChevronRight } from '@/components/ui/icons'
import { MediaInput } from './MediaInput'
import { ModelPicker } from './ModelPicker'
import { AiConfigSheet } from './AiConfigSheet'
import type { ByokTarget } from '@/components/byok/ByokConfigForm'
import { MotionGrid } from './MotionGrid'

const LTX_DURATIONS = [4, 6, 8] as const

// Video has none here: its ideas live on the stage (PromptInspiration).
const EXAMPLES: Partial<Record<Workflow, string[]>> = {
  image: [
    'a matte black ceramic cup on polished concrete, soft north light, minimal',
    'editorial portrait of a boxer taping his hands, hard window light, grain',
    'a brutalist chapel at dawn, one shaft of light through a slit window',
  ],
  motion: [
    'a quiet harbour at dawn, mist on the water',
    'product shot of a sneaker on a concrete plinth',
  ],
}

export function Composer({
  workflow, catalog, state, onChange, onGenerate, running, fieldErrors, source,
  videoMode = 'text', onVideoMode, modeDir = 'r',
}: {
  videoMode?: VideoMode
  onVideoMode?: (m: VideoMode) => void
  modeDir?: 'l' | 'r'
  workflow: Workflow
  catalog: Catalog | null
  state: ComposerState
  onChange: (s: ComposerState) => void
  onGenerate: () => void
  running: boolean
  fieldErrors: Record<string, string>
  /** Loaded source frame (the user's image or the demo frame) for move previews. */
  source: HTMLImageElement | null
}) {
  const [modelOpen, setModelOpen] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const set = <K extends keyof ComposerState>(k: K, v: ComposerState[K]) => onChange({ ...state, [k]: v })

  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    // Empty: let CSS size it. Only grow once there is text to fit.
    ta.style.height = ''
    if (!state.prompt) return
    ta.style.height = `${Math.min(Math.max(ta.scrollHeight, 96), 220)}px`
  }, [state.prompt])

  const isImage = workflow === 'image'
  const isVideo = workflow === 'video'
  const model = liveModel(state.model)
  // Provider configuration: `target` fixes the provider to a model's own one.
  // Open/closed and what is being configured are separate: closing keeps the target for reopening.
  const [configOpen, setConfigOpen] = useState(false)
  const [configTarget, setConfigTarget] = useState<ByokTarget | undefined>(undefined)
  const setConfigure = (c: { target?: ByokTarget }) => { setConfigTarget(c.target); setConfigOpen(true) }
  // A model on the user's own key runs only while that key is active in this tab.
  const own = parseByokModelId(state.model)
  const ownProvider = own ? byokProvider(own.providerId)! : null
  const byok = useByok()
  const keyActive = Boolean(own && byok && byok.providerId === own.providerId)
  // What this model genuinely supports: documented specs, or this tab's discovery.
  const runs = own ? runsFor(state.model, byok) : null
  const imageSpec = own?.op === 'image' ? runs?.image ?? null : null
  const videoSpec = own?.op === 'video' ? runs?.video ?? null : null
  // Image to Video only where the selected model takes a first frame. Never a fallback.
  const firstFrameBlocked = isVideo && own?.op === 'video' && !videoSpec?.imageToVideo
  // A Slate model this deployment has not configured is said so up front: never a silent swap.
  const slateStatus: 'unknown' | 'live' | 'unconfigured' = own ? 'live'
    : !catalog ? 'unknown'
      : catalog.models.find((m) => m.id === state.model)?.available ? 'live' : 'unconfigured'
  const blockedReason = !own ? (slateStatus === 'unconfigured' ? `${model?.name ?? 'This model'} is not configured in this deployment` : null)
    : !keyActive ? 'Connect your provider key first'
      : own.op === 'video' && !videoSpec ? 'Connect your provider again to load this model'
        : firstFrameBlocked && videoMode === 'image' ? 'This model does not take a first frame in Slate'
          : null
  const canGenerate = state.prompt.trim().length >= 3 && !running && !blockedReason

  /** Choose a model and snap settings to values it genuinely supports. */
  const chooseModel = (id: string) => {
    const r = runsFor(id, byok)
    const kind = parseByokModelId(id)?.op
    const v = kind === 'video' ? r?.video : null
    const im = kind === 'image' ? r?.image : null
    const ratios = v?.aspectRatios ?? (im?.aspectRatios.length ? im.aspectRatios : null)
    onChange({
      ...state,
      model: id,
      ...(v ? { durationS: v.durations.includes(state.durationS) ? state.durationS : v.durations[0] } : {}),
      ...(!kind && isVideo ? { durationS: [4, 6, 8].includes(state.durationS) ? state.durationS : 6 } : {}),
      ...(ratios && !ratios.includes(state.aspectRatio) ? { aspectRatio: ratios[0] } : {}),
    })
  }

  const aspect = (() => {
    if (isImage) { const d = imageOutputDims(state.aspectRatio); return d.width / d.height }
    const d = dimensionsFor(state.aspectRatio, state.resolution); return d.width / d.height
  })()

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-5 pt-4 sm:px-5">

        {/* Model */}
        {workflow === 'motion' ? (
          <div>
            <FieldLabel>Engine</FieldLabel>
            <div className="flex items-center gap-2 rounded-card border border-line bg-surface px-3 py-2.5">
              <span className="text-[13px] font-semibold">Slate Cinematic 1</span>
              <Tag tone="live" dot>Live</Tag>
              <span className="ml-auto text-[11px] text-ink-3">runs every camera move</span>
            </div>
          </div>
        ) : (
          <div>
            <FieldLabel>Model</FieldLabel>
            <button type="button" onClick={() => setModelOpen(true)}
              className="group flex w-full items-center gap-3 rounded-card border border-line bg-surface px-3 py-2.5 text-left
                transition-colors duration-150 hover:border-line-strong">
              {own && ownProvider ? (
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-mono text-[13px] font-semibold">{own.model}</span>
                    {keyActive ? <Tag tone="live" dot>Connected</Tag> : <Tag tone="danger">Key not active</Tag>}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-ink-3">Bring your own AI · your {ownProvider.label} account</span>
                </span>
              ) : (
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-semibold">{model?.name ?? state.model}</span>
                    {slateStatus === 'live' && <Tag tone="live" dot>Live</Tag>}
                    {slateStatus === 'unconfigured' && <Tag tone="danger">Not configured</Tag>}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-ink-3">Slate · {model?.maker} · {isVideo ? 'generative video' : model?.facts?.slice(0, 2).join(' · ')}</span>
                </span>
              )}
              <span className="flex items-center gap-1 text-[11px] text-ink-3 group-hover:text-ink-2">
                All models <IconChevronRight size={14} />
              </span>
            </button>
            {own && !keyActive && (
              <p className="mt-1.5 text-[11px] leading-snug text-ink-3">
                This model runs on your own provider, which is not connected in this tab.{' '}
                <button type="button" onClick={() => setConfigure({ target: { providerId: own.providerId, op: own.op, providerModel: own.model } })}
                  className="text-signal underline underline-offset-2">Connect</button>
              </p>
            )}
            {!own && slateStatus === 'unconfigured' && (
              <p className="mt-1.5 text-[11px] leading-snug text-ink-3">
                {isImage ? 'Image generation requires a configured provider. ' : ''}{model?.name ?? 'This model'} has no provider configured in this deployment, so nothing can be generated with it.{' '}
                <button type="button" onClick={() => setConfigure({ target: { op: isImage ? 'image' : 'video' } })}
                  className="text-signal underline underline-offset-2">Use your own provider</button>
              </p>
            )}
            {fieldErrors.model && <p className="mt-1.5 text-xs text-danger">{fieldErrors.model}</p>}
          </div>
        )}

        {workflow === 'video' && onVideoMode && (
          <div>
            <FieldLabel>Start from</FieldLabel>
            <Segmented<VideoMode> label="Video mode" value={videoMode} options={['text', 'image']} onChange={onVideoMode}
              render={(m) => (m === 'text' ? 'Text to Video' : 'Image to Video')} />
            {firstFrameBlocked && (
              <p className="mt-1.5 text-[11px] leading-snug text-ink-3">
                {own?.model} does not take a first frame in Slate, so Image to Video is off for it. Use a model that supports it, or LTX-2 Pro.
              </p>
            )}
          </div>
        )}

        {/* Everything below changes with the mode, so it slides as one piece. */}
        <div key={workflow === 'video' ? videoMode : workflow} className="mode-in flex flex-col gap-5" data-dir={modeDir}>

        {/* Source image */}
        {workflow === 'motion' && (
          <MediaInput value={state.referenceUrl} onChange={(url) => set('referenceUrl', url)} disabled={running}
            label="Your image" hint="recommended" size="hero" emptyTitle="Add the image to move across" />
        )}
        {workflow === 'video' && videoMode === 'image' && (
          <MediaInput value={state.referenceUrl} onChange={(url) => set('referenceUrl', url)} disabled={running}
            label="Your image" hint="first frame" size="hero" emptyTitle="Add the image to start from" />
        )}

        {/* Prompt */}
        <div>
          <FieldLabel htmlFor="prompt" hint={`${state.prompt.length}/2000`}>
            {(workflow === 'motion' || videoMode === 'image') && state.referenceUrl ? 'Description' : 'Prompt'}
          </FieldLabel>
          <div className={[
            'rounded-card border bg-surface transition-colors duration-150',
            fieldErrors.prompt ? 'border-danger/60' : 'border-line focus-within:border-ink-4',
          ].join(' ')}>
            <textarea
              id="prompt"
              ref={taRef}
              value={state.prompt}
              onChange={(e) => set('prompt', e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canGenerate) onGenerate()
              }}
              maxLength={2000}
              rows={4}
              placeholder={
                isImage ? 'Describe the image. Subject, setting, light, style.'
                  : (workflow === 'motion' || videoMode === 'image') && state.referenceUrl ? 'Describe the shot. Kept with the clip in your library.'
                    : 'Describe the shot. Subject, setting, light, mood.'
              }
              className="block min-h-24 w-full resize-none bg-transparent px-3 py-2.5 text-[14px] leading-relaxed
                text-ink placeholder:text-ink-4 focus:outline-none"
            />
          </div>
          {fieldErrors.prompt && <p className="mt-1.5 text-xs text-danger">{fieldErrors.prompt}</p>}
          {workflow === 'motion' && state.referenceUrl && (
            <p className="mt-1.5 text-[11px] leading-snug text-ink-3">Your image is the frame; this text labels the clip.</p>
          )}
          {!state.prompt && EXAMPLES[workflow] && (
            <div className="mt-2 flex flex-col gap-0.5">
              {EXAMPLES[workflow].map((ex) => (
                <button key={ex} type="button" onClick={() => set('prompt', ex)}
                  className="truncate rounded px-2 py-1.5 text-left text-xs text-ink-3 transition-colors duration-150
                    hover:bg-surface-2 hover:text-ink">
                  <span className="text-ink-4">→ </span>{ex}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Camera move */}
        {workflow === 'motion' && (
          <div>
            <FieldLabel hint="15 moves">Camera move</FieldLabel>
            <MotionGrid value={state.motion} onChange={(m) => set('motion', m)} source={source} aspect={aspect > 1.9 ? 16 / 9 : aspect} />
          </div>
        )}
        </div>

        {/* Output settings */}
        <div>
          <FieldLabel>Output</FieldLabel>
          <div className="grid grid-cols-2 gap-1.5">
            {!isImage && (
              <SettingTile label="Duration" value={`${state.durationS}s`}>
                {(close) => isVideo ? (
                  <Segmented label="Duration" value={String(state.durationS)}
                    options={(videoSpec?.durations ?? LTX_DURATIONS).map(String)}
                    onChange={(v) => { set('durationS', Number(v)); close() }} render={(v) => `${v}s`} />
                ) : (
                  <DurationSlider value={state.durationS} onChange={(n) => set('durationS', n)} />
                )}
              </SettingTile>
            )}
            {imageSpec && !imageSpec.aspectRatios.length ? (
              <StaticTile label="Aspect" value="Set by the model" />
            ) : (
              <SettingTile label="Aspect" value={state.aspectRatio} width={300}>
                {(close) => (
                  <AspectPicker value={state.aspectRatio} onChange={(a) => { set('aspectRatio', a); close() }}
                    options={videoSpec?.aspectRatios ?? (imageSpec?.aspectRatios.length ? imageSpec.aspectRatios : undefined)} />
                )}
              </SettingTile>
            )}
            {!isImage && !own && (
              <SettingTile label="Resolution" value={state.resolution}>
                {(close) => (
                  <Segmented<Resolution> label="Resolution" value={state.resolution} options={RESOLUTIONS}
                    onChange={(v) => { set('resolution', v); close() }} />
                )}
              </SettingTile>
            )}
            {isVideo && (
              // The provider encodes the file itself and takes no bitrate, so
              // this is stated, not offered as a control that would do nothing.
              <StaticTile label={own ? 'Resolution' : 'Bitrate'} value={`Set by ${own ? ownProvider!.label : 'LTX-2'}`} />
            )}
            {!isVideo && (!own || imageSpec?.quality) && (
              <SettingTile label={isImage ? 'Quality' : 'Bitrate'} value={state.bitrate === 'high' ? 'High' : 'Standard'}>
                {(close) => (
                  <div>
                    <Segmented<Bitrate> label={isImage ? 'Quality' : 'Bitrate'} value={state.bitrate} options={['standard', 'high']}
                      onChange={(v) => { set('bitrate', v); close() }} render={(v) => (v === 'high' ? 'High' : 'Standard')} />
                    <p className="mt-2 text-[11px] leading-snug text-ink-3">
                      {isImage ? 'High renders more detail and takes noticeably longer.' : 'Higher bitrate, larger file, fewer compression artefacts.'}
                    </p>
                  </div>
                )}
              </SettingTile>
            )}
          </div>
          {fieldErrors.durationS && <p className="mt-1.5 text-xs text-danger">{fieldErrors.durationS}</p>}
        </div>

        {isVideo && (
          <p className="text-[11px] leading-snug text-ink-4">
            {own
              ? <>Generated by {own.model} on your {ownProvider!.label} account, not by Slate. </>
              : <>LTX-2 animates the scene itself. </>}
            For Slate’s own camera-motion renderer over your image, use{' '}
            <Link href="/studio/motion" className="text-ink-3 underline underline-offset-2 hover:text-ink">Camera Motion</Link>.
          </p>
        )}
      </div>

      {/* Pinned: the primary action never scrolls out of reach. */}
      <div className="z-10 shrink-0 border-t border-line bg-ground px-4 pb-4 pt-3 max-lg:sticky max-lg:bottom-0 sm:px-5">
        <OutputSpec workflow={workflow} state={state} />
        <Button variant="primary" size="lg" className="mt-2.5 w-full" onClick={onGenerate} disabled={!canGenerate}
          title={state.prompt.trim().length < 3 ? 'Write a prompt first' : running ? 'A render is already running' : blockedReason ?? undefined}>
          {running ? 'Rendering…' : isImage ? 'Generate image' : isVideo ? 'Generate video' : 'Generate clip'}
          {!running && <kbd className="tabular rounded-[3px] border border-ground/25 px-1 text-[10px] opacity-60">⌘↵</kbd>}
        </Button>
      </div>

      {(isImage || isVideo) && (
        <ModelPicker open={modelOpen} onClose={() => setModelOpen(false)} kind={isImage ? 'image' : 'video'}
          value={state.model} onChange={chooseModel} catalog={catalog} onConnect={() => setConfigure({ target: { op: isImage ? 'image' : 'video' } })} />
      )}
      <AiConfigSheet open={configOpen} onClose={() => setConfigOpen(false)} target={configTarget}
        onUse={chooseModel} />
    </div>
  )
}

/** The exact output, computed from the same functions the renderer uses. */
function OutputSpec({ workflow, state }: { workflow: Workflow; state: ComposerState }) {
  const own = parseByokModelId(state.model)
  if (own) {
    const p = byokProvider(own.providerId)!
    const items = own.op === 'video'
      ? [state.aspectRatio, `${state.durationS}s`, 'MP4', `on your ${p.label} account`]
      : [state.aspectRatio, own.runs?.image?.output ?? null, own.runs?.image?.quality ? (state.bitrate === 'high' ? 'High quality' : 'Standard quality') : null, `on your ${p.label} account`]
    return <Spec items={items.filter(Boolean) as string[]} />
  }
  if (workflow === 'image') {
    const d = imageOutputDims(state.aspectRatio)
    return <Spec items={[`${d.width}×${d.height}`, 'JPEG', state.bitrate === 'high' ? 'High quality' : 'Standard quality']} />
  }
  const dims = dimensionsFor(state.aspectRatio, state.resolution)
  if (state.model === LTX_MODEL_ID) {
    return <Spec items={[`${dims.width}×${dims.height}`, `${state.durationS}s`, 'MP4', 'rendered by LTX-2']} />
  }
  const mbps = bitrateFor(dims, state.bitrate, DEFAULT_FPS) / 1e6
  return <Spec items={[`${dims.width}×${dims.height}`, `${state.durationS}s`, `${DEFAULT_FPS}fps`, `≤${mbps.toFixed(1)} Mbps`, 'H.264']} />
}

/** A setting that exists but is decided elsewhere: stated, never offered. */
function StaticTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-line bg-surface px-3 py-2">
      <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">{label}</span>
      <span className="mt-0.5 block text-[13px] text-ink-3">{value}</span>
    </div>
  )
}

function SettingTile({
  label, value, children, width = 240,
}: { label: string; value: ReactNode; children: (close: () => void) => ReactNode; width?: number }) {
  return (
    <Popover label={label} width={width} trigger={({ open, toggle, id }) => (
      <button type="button" onClick={toggle} aria-expanded={open} aria-controls={id}
        className={[
          'flex w-full items-center justify-between rounded-card border px-3 py-2 text-left transition-colors duration-150',
          open ? 'border-ink-4 bg-surface-2' : 'border-line bg-surface hover:border-line-strong',
        ].join(' ')}>
        <span>
          <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">{label}</span>
          <span className="tabular mt-0.5 block text-[13px] text-ink">{value}</span>
        </span>
        <IconChevronRight size={13} className={`text-ink-4 transition-transform ${open ? '-rotate-90' : ''}`} />
      </button>
    )}>
      {children}
    </Popover>
  )
}

function DurationSlider({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const pct = ((value - MIN_DURATION_S) / (MAX_DURATION_S - MIN_DURATION_S)) * 100
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="tabular text-2xl font-semibold">{value}s</span>
        <span className="tabular text-[11px] text-ink-3">{value * DEFAULT_FPS} frames</span>
      </div>
      <input type="range" min={MIN_DURATION_S} max={MAX_DURATION_S} value={value} aria-label="Duration in seconds"
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 h-1 w-full cursor-pointer appearance-none rounded-full outline-none
          [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ink"
        style={{ background: `linear-gradient(90deg, var(--color-signal) ${pct}%, var(--color-line-strong) ${pct}%)` }} />
      <div className="tabular mt-1.5 flex justify-between text-[10px] text-ink-4">
        <span>{MIN_DURATION_S}s</span><span>{MAX_DURATION_S}s</span>
      </div>
    </div>
  )
}

function AspectPicker({ value, onChange, options = ASPECT_RATIOS }: { value: AspectRatio; onChange: (a: AspectRatio) => void; options?: readonly AspectRatio[] }) {
  return (
    <div role="radiogroup" aria-label="Aspect ratio" className="grid grid-cols-3 gap-1.5">
      {options.map((a) => {
        const [w, h] = a.split(':').map(Number)
        const r = w / h
        const bw = r >= 1 ? 30 : Math.round(30 * r)
        const bh = r >= 1 ? Math.round(30 / r) : 30
        const active = a === value
        return (
          <button key={a} type="button" role="radio" aria-checked={active} onClick={() => onChange(a)}
            className={[
              'flex flex-col items-center gap-2 rounded-[5px] border px-2 py-2.5 transition-colors',
              active ? 'border-signal bg-signal/[0.06]' : 'border-line hover:border-line-strong',
            ].join(' ')}>
            <span className="flex h-8 items-center justify-center">
              <span className={`rounded-[2px] border-[1.5px] ${active ? 'border-signal' : 'border-ink-3'}`} style={{ width: bw, height: bh }} />
            </span>
            <span className="tabular text-[11px] text-ink-2">{a}</span>
          </button>
        )
      })}
    </div>
  )
}
