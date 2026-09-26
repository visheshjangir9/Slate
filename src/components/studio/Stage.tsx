'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { dimensionsFor, getMotion } from '@/lib/engine'
import { ERROR_COPY } from '@/lib/generation/state'
import type { Generation } from '@/lib/generation/types'
import type { ComposerState, RunState, VideoMode } from '@/lib/client/useStudio'
import { kindOfModel, modelName } from '@/lib/catalog'
import { byokProvider, parseByokModelId } from '@/lib/byok/catalog'
import { imageOutputDims } from '@/lib/images/dims'
import { downloadHref, fileSize, timecode } from '@/lib/format'
import type { Workflow } from '@/components/shell/nav'
import { Button, Spec, Tag, buttonClass } from '@/components/ui/primitives'
import { IconDownload, IconHistory, IconPlus, IconRemix, IconRefresh } from '@/components/ui/icons'
import { GenerationField } from './GenerationField'
import { PromptInspiration } from './PromptInspiration'
import { MotionPreview } from './MotionPreview'
import { VideoPlayer } from './VideoPlayer'

/** Stage labels describe what each engine actually does, in order. */
const STAGES: Record<string, { key: RunState['stage']; label: string }[]> = {
  cinematic: [
    { key: 'image', label: 'Source frame' },
    { key: 'render', label: 'Camera move' },
    { key: 'encode', label: 'Encoding H.264' },
    { key: 'upload', label: 'Saving' },
  ],
  ltxv: [
    { key: 'image', label: 'Source frame' },
    { key: 'render', label: 'LTX-2 generating' },
    { key: 'upload', label: 'Saving' },
  ],
  'gpt-image': [
    { key: 'image', label: 'GPT Image generating' },
    { key: 'upload', label: 'Saving' },
  ],
}

/** Stage labels for a job on the user's own provider: what actually happens, in order. */
function stagesFor(g: Generation): { key: RunState['stage']; label: string }[] {
  const own = parseByokModelId(g.model)
  if (!own) return STAGES[g.provider] ?? STAGES.cinematic
  const label = byokProvider(own.providerId)!.label
  return own.op === 'video'
    ? [{ key: 'image', label: `Submitting to ${label}` }, { key: 'render', label: `${label} rendering` }, { key: 'upload', label: 'Downloading and saving' }]
    : [{ key: 'image', label: `${label} generating` }, { key: 'upload', label: 'Saving' }]
}

export const aspectOf = (g: Pick<Generation, 'model' | 'aspectRatio' | 'resolution'>): number => {
  if (kindOfModel(g.model) === 'image') {
    const d = imageOutputDims(g.aspectRatio)
    return d.width / d.height
  }
  const d = dimensionsFor(g.aspectRatio, g.resolution)
  return d.width / d.height
}

/** Aspect-correct frame that always fits the stage without overflowing it. */
function Frame({ aspect, children, className = '' }: { aspect: number; children: ReactNode; className?: string }) {
  // Below lg the page scrolls, so the stage takes the height its frame needs
  // (capped at 62vh) instead of reserving empty space around a wide frame.
  const phone = `min(62vh, calc((100vw - 2rem) / ${aspect} + 2rem))`
  return (
    <div className="relative min-h-0 flex-1 max-lg:h-[var(--frame-h)] max-lg:flex-none"
      style={{ containerType: 'size', ['--frame-h' as string]: phone }}>
      <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6">
        <div
          className={`relative overflow-hidden rounded-[4px] bg-surface ${className}`}
          style={{ aspectRatio: aspect, width: `min(calc(100cqw - 2rem), calc((100cqh - 2rem) * ${aspect}))` }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

export function Stage({
  workflow, composer, current, run, source, sourceIsUsers, onRetry, onRemix, onReset, onShowHistory, historyCount,
  remixOf = null, videoMode = 'text', modeDir = 'r', onUsePrompt, startError = null, onDismissError, onConnectProvider,
}: {
  /** Generate was pressed but no generation could start: shown here, in the result frame. */
  startError?: string | null
  onDismissError?: () => void
  /** Open Bring your own AI for this workflow. */
  onConnectProvider?: () => void
  /** Put a prompt idea into the composer. */
  onUsePrompt?: (prompt: string) => void
  remixOf?: Generation | null
  videoMode?: VideoMode
  modeDir?: 'l' | 'r'
  workflow: Workflow
  composer: ComposerState
  current: Generation | null
  run: RunState | null
  source: HTMLImageElement | null
  sourceIsUsers: boolean
  onRetry: (id: string) => void
  onRemix: (g: Generation) => void
  onReset: () => void
  onShowHistory: () => void
  historyCount: number
}) {
  const label = !current ? (startError ? 'Not started' : remixOf ? 'Remix · new generation' : workflow === 'video' ? 'Prompt inspiration' : 'Preview')
    : current.status === 'completed' ? 'Current result'
      : current.status === 'failed' ? 'Current · failed' : 'Current · rendering'

  // The generation last seen running here. When that same one completes, its
  // result develops out of the generation field instead of cutting on; a
  // result opened from History just appears.
  const running = current?.status === 'queued' || current?.status === 'generating'
  const [watched, setWatched] = useState<string | null>(null)
  if (running && watched !== current.id) setWatched(current.id)
  if (!running && watched && current?.id !== watched) setWatched(null)
  const justFinished = current?.status === 'completed' && current.id === watched

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-4 sm:px-5">
        <span className={`h-1.5 w-1.5 rounded-full ${!current ? (startError ? 'bg-danger' : 'bg-ink-4') : current.status === 'completed' ? 'bg-live' : current.status === 'failed' ? 'bg-danger' : 'bg-signal pulse-dot'}`} />
        <span className="eyebrow text-ink-2">{label}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={onShowHistory} className="xl:hidden">
            <IconHistory size={14} /> History <span className="tabular text-ink-3">{historyCount}</span>
          </Button>
          {current && (
            <Button size="sm" variant="secondary" onClick={onReset} title="Start a new creation. This result stays in History.">
              <IconPlus size={14} /> New
            </Button>
          )}
        </div>
      </div>

      {!current && startError && (
        <StartErrorStage workflow={workflow} composer={composer} message={startError}
          onDismiss={onDismissError} onConnectProvider={onConnectProvider} />
      )}
      {!current && !startError && remixOf && <RemixStage composer={composer} from={remixOf} />}
      {!current && !startError && !remixOf && (
        // Keyed by mode, so switching Text/Image to Video visibly changes the preview.
        <div key={`${workflow}-${videoMode}`} className="mode-in flex min-h-0 flex-1 flex-col" data-dir={modeDir}>
          {workflow === 'video' ? (
            // Generative video is shown as an idea to write from, never as a
            // sample clip or a camera move: that is Camera Motion's preview.
            <PromptInspiration mode={videoMode} image={sourceIsUsers ? composer.referenceUrl ?? null : null}
              onUse={(p) => onUsePrompt?.(p)} />
          ) : (
            <ContextStage workflow={workflow} composer={composer} source={source} sourceIsUsers={sourceIsUsers} />
          )}
        </div>
      )}
      {current && running && <RunningStage generation={current} run={run} />}
      {current?.status === 'failed' && <FailedStage generation={current} onRetry={onRetry} onRemix={onRemix} />}
      {current?.status === 'completed' && (
        <ResultStage key={current.id} generation={current} develop={justFinished}
          onDeveloped={() => setWatched(null)} onRemix={onRemix} onReset={onReset} />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Contextual preview: what this workflow does. Never a user result.  */
/* ------------------------------------------------------------------ */

/** Image and Camera Motion only; Video's empty stage is PromptInspiration. */
function ContextStage({
  workflow, composer, source, sourceIsUsers,
}: { workflow: Workflow; composer: ComposerState; source: HTMLImageElement | null; sourceIsUsers: boolean }) {
  const aspect = aspectOf(composer)
  const move = getMotion(composer.motion)

  let media: ReactNode
  let tag: ReactNode
  let headline: ReactNode
  let line: string
  let facts: string[]

  if (workflow === 'image') {
    const d = imageOutputDims(composer.aspectRatio)
    // Deliberately no photograph: an example picture in the result frame is
    // too easily read as a result. The frame is empty until a real image exists.
    media = (
      <div className="absolute inset-0 bg-surface-2">
        <div className="absolute inset-4 rounded-[4px] border border-dashed border-line-strong sm:inset-6" />
        <span className="tabular absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-ink-4">
          {d.width} × {d.height}
        </span>
      </div>
    )
    tag = <Tag tone="neutral" onMedia>Empty frame · your image appears here</Tag>
    headline = <>Describe it. <span className="serif-accent text-signal">See it.</span></>
    line = 'GPT Image renders your prompt, cropped to exactly the frame you choose.'
    facts = [`Your frame: ${d.width}×${d.height}`, 'JPEG', 'Saved to History and Assets']
  } else {
    media = <MotionPreview motion={composer.motion} source={source} aspect={aspect} longEdge={1280} durationMs={4200}
      label={`Live ${move.label} preview on ${sourceIsUsers ? 'your image' : 'a sample frame'}`} />
    tag = <Tag tone={sourceIsUsers ? 'signal' : 'neutral'} onMedia>{sourceIsUsers ? `Your image · live ${move.label}` : `Sample frame · live ${move.label}`}</Tag>
    headline = sourceIsUsers
      ? <>Your image. <span className="serif-accent text-signal">A real move.</span></>
      : <>Bring an image. <span className="serif-accent text-signal">Pick a real move.</span></>
    line = `This preview runs the exact ${move.label} transform the renderer uses${sourceIsUsers ? ' on your image' : ''}.`
    facts = ['15 camera moves', 'Eased, keyframed, never cropped past the edge', 'Encoded as H.264']
  }

  return (
    <>
      <Frame aspect={aspect} className="grain">
        {media}
        <div className="scrim-t pointer-events-none absolute inset-x-0 top-0 h-24" />
        <div className="absolute left-3 top-3">{tag}</div>
        <div className="scrim-b pointer-events-none absolute inset-x-0 bottom-0 h-1/2" />
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
          <p className="display max-w-2xl text-[clamp(1.5rem,min(3.4vw,5.5cqh),3rem)] leading-[0.92] text-ink">{headline}</p>
          <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-ink-2">{line}</p>
        </div>
      </Frame>
      <div className="shrink-0 border-t border-line px-4 py-3 sm:px-5">
        <ol className="flex flex-wrap gap-x-5 gap-y-1.5">
          {facts.map((f, i) => (
            <li key={f} className="flex items-center gap-2 text-xs text-ink-2">
              <span className="tabular text-[10px] text-signal">{String(i + 1).padStart(2, '0')}</span>{f}
            </li>
          ))}
        </ol>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Running                                                             */
/* ------------------------------------------------------------------ */

/** Seconds while short, m:ss once it runs past a minute. */
function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const secs = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000))
  return <>{secs < 60 ? `${secs}s` : timecode(secs)}</>
}

/**
 * Compact, calm generation state. The frame keeps its aspect and holds the
 * generation field; the only text is a small status label with the elapsed
 * time. A percentage appears only when it is real (the in-browser encoder
 * counts frames); server jobs never get an invented one.
 */
function RunningStage({ generation, run }: { generation: Generation; run: RunState | null }) {
  const stages = stagesFor(generation)
  const own = parseByokModelId(generation.model)
  // Real provider progress, only where the provider reports it (and only once it has).
  const providerPct = own?.op === 'video' && own.runs?.video?.progress && generation.progress > 0 ? Math.round(generation.progress) : null
  const stage = run?.stage ?? generation.stage ?? 'image'
  const activeIdx = Math.max(0, stages.findIndex((s) => s.key === stage))
  const measurable = generation.provider === 'cinematic'
  const pct = Math.round(run?.progress ?? generation.progress)
  const isImage = kindOfModel(generation.model) === 'image'
  const status = generation.status === 'queued' ? 'Queued' : isImage ? 'Generating image' : 'Rendering video'

  return (
    <>
      <Frame aspect={aspectOf(generation)}>
        <GenerationField kind={isImage ? 'image' : 'video'}>
          {generation.referenceUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={generation.referenceUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
          )}
        </GenerationField>
        <div role="status" className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full border border-white/10 bg-[#0b0c0c]/75 py-1.5 pl-2.5 pr-3">
          <span className="h-1.5 w-1.5 rounded-full bg-signal pulse-dot" />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink">{status}</span>
          <span className="tabular text-[11px] text-ink-3">
            {measurable && stage === 'encode' ? `${pct}%` : providerPct !== null ? `${providerPct}%` : <Elapsed since={generation.createdAt} />}
          </span>
        </div>
        {measurable && (
          <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/[0.06]">
            <div className="h-full bg-signal transition-[width] duration-300 ease-out" style={{ width: `${Math.max(2, pct)}%` }} />
          </div>
        )}
      </Frame>
      <div className="shrink-0 border-t border-line px-4 py-2.5 sm:px-5">
        <ol className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {stages.map((s, i) => {
            const done = i < activeIdx
            const now = i === activeIdx
            return (
              <li key={s.key} className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${done ? 'bg-live' : now ? 'bg-signal pulse-dot' : 'bg-line-strong'}`} />
                <span className={`text-[11px] ${now ? 'text-ink' : done ? 'text-ink-3' : 'text-ink-4'}`}>{s.label}</span>
              </li>
            )
          })}
          <li className="ml-auto text-[11px] text-ink-3">
            {measurable ? 'Keep this tab open while it encodes'
              : own ? `${own.op === 'video' ? 'Rendering' : 'Generating'} on your ${byokProvider(own.providerId)!.label} account · keep this tab open to collect it`
                : 'Runs on the server · you can leave this page'}
          </li>
        </ol>
      </div>
    </>
  )
}

/**
 * After Remix (or editing the prompt of a finished result): the previous
 * result stays in view, ghosted, so the context is never swapped for an
 * unrelated demo frame. It is context only: generating makes a new result.
 */
function RemixStage({ composer, from }: { composer: ComposerState; from: Generation }) {
  const isImage = kindOfModel(from.model) === 'image'
  const still = isImage ? from.outputUrl : from.posterUrl
  return (
    <>
      <Frame aspect={aspectOf(composer)} className="grain bg-surface-2">
        {still && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={still} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40 saturate-[.6]" />
        )}
        <div className="absolute left-3 top-3"><Tag tone="signal" onMedia>Previous result · for reference</Tag></div>
        <div className="scrim-b pointer-events-none absolute inset-x-0 bottom-0 h-1/2" />
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
          <p className="display max-w-2xl text-[clamp(1.5rem,min(3.4vw,5.5cqh),3rem)] leading-[0.92] text-ink">
            Same prompt. <span className="serif-accent text-signal">New take.</span>
          </p>
          <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-ink-2">
            Your prompt and settings are loaded. Edit anything, then generate: this creates a new {isImage ? 'image' : 'clip'}.
            {isImage ? ' It does not edit the previous image.' : ''}
          </p>
        </div>
      </Frame>
      <div className="shrink-0 border-t border-line px-4 py-3 sm:px-5">
        <ol className="flex flex-wrap gap-x-5 gap-y-1.5">
          {['Same prompt and settings', 'Generates a new result', 'The previous one stays in History'].map((f, i) => (
            <li key={f} className="flex items-center gap-2 text-xs text-ink-2">
              <span className="tabular text-[10px] text-signal">{String(i + 1).padStart(2, '0')}</span>{f}
            </li>
          ))}
        </ol>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Failed                                                              */
/* ------------------------------------------------------------------ */

/**
 * Generate was pressed and the server refused to start a generation (model
 * not configured, signed out, invalid settings). Said plainly where the
 * result would be, so the frame never shows anything that looks like one.
 */
function StartErrorStage({ workflow, composer, message, onDismiss, onConnectProvider }: {
  workflow: Workflow; composer: ComposerState; message: string; onDismiss?: () => void; onConnectProvider?: () => void
}) {
  const unconfigured = /not configured|not available/i.test(message)
  return (
    <>
      <Frame aspect={aspectOf(composer)}>
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <Tag tone="danger">Nothing was generated</Tag>
          {unconfigured && workflow === 'image' && (
            <p className="max-w-md text-[15px] font-semibold text-ink">Image generation requires a configured provider.</p>
          )}
          <p className="max-w-md text-sm leading-relaxed text-ink-2">{message}</p>
          <div className="flex items-center gap-2">
            {unconfigured && onConnectProvider && (
              <Button size="sm" variant="secondary" onClick={onConnectProvider}>Use your own provider</Button>
            )}
            {onDismiss && <Button size="sm" variant="ghost" onClick={onDismiss}>Dismiss</Button>}
          </div>
        </div>
      </Frame>
      <div className="shrink-0 border-t border-line px-4 py-3 sm:px-5">
        <p className="text-xs text-ink-3">No request reached a model, and nothing was added to History.</p>
      </div>
    </>
  )
}

function FailedStage({
  generation, onRetry, onRemix,
}: { generation: Generation; onRetry: (id: string) => void; onRemix: (g: Generation) => void }) {
  const copy = (generation.errorCode && ERROR_COPY[generation.errorCode]) || generation.errorMessage
  return (
    <>
      <Frame aspect={aspectOf(generation)}>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <Tag tone="danger">Did not finish</Tag>
          <p className="max-w-md text-sm leading-relaxed text-ink-2">{copy}</p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => onRetry(generation.id)}><IconRefresh size={14} /> Try again</Button>
            <Button size="sm" variant="ghost" onClick={() => onRemix(generation)}><IconRemix size={14} /> Edit settings</Button>
          </div>
        </div>
      </Frame>
      <div className="shrink-0 border-t border-line px-4 py-3 sm:px-5">
        <p className="line-clamp-1 text-xs text-ink-2">&ldquo;{generation.prompt}&rdquo;</p>
        {generation.errorCode && <p className="tabular mt-1 text-[11px] text-ink-3">error · {generation.errorCode}</p>}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Result                                                              */
/* ------------------------------------------------------------------ */

export function resultSpec(g: Generation): (string | null)[] {
  const model = modelName(g.model)
  const own = parseByokModelId(g.model)
  if (own) {
    // The user's provider decides pixel size and format; show only what is known.
    const format = g.outputUrl?.split('?')[0].split('.').pop()?.toUpperCase() ?? null
    return own.op === 'video'
      ? [g.aspectRatio, `${g.durationS}s`, 'MP4', fileSize(g.fileBytes), model]
      : [g.aspectRatio, format === 'JPG' ? 'JPEG' : format, own.runs?.image?.quality ? (g.bitrate === 'high' ? 'High' : 'Standard') : null, fileSize(g.fileBytes), model]
  }
  if (kindOfModel(g.model) === 'image') {
    const d = imageOutputDims(g.aspectRatio)
    return [`${d.width}×${d.height}`, 'JPEG', g.bitrate === 'high' ? 'High' : 'Standard', fileSize(g.fileBytes), model]
  }
  const d = dimensionsFor(g.aspectRatio, g.resolution)
  const cinematic = g.provider === 'cinematic'
  return [
    `${d.width}×${d.height}`, `${g.durationS}s`,
    cinematic ? getMotion(g.motion).label : null,
    cinematic ? `${g.bitrate} bitrate` : null,
    fileSize(g.fileBytes), model,
  ]
}

/** The strongest action on a finished result: accent fill, lift on hover, press on click. */
export const DOWNLOAD_CLS =
  // `!` so this wins over the base button's colour-only transition; Tailwind v4 scales via `scale`.
  'font-semibold shadow-[0_6px_20px_-8px_rgba(255,138,61,0.6)] transition-[scale,filter,box-shadow,background-color]! ' +
  'duration-150 hover:scale-[1.03] hover:brightness-110 hover:shadow-[0_10px_28px_-8px_rgba(255,138,61,0.75)] ' +
  'active:scale-[0.97] active:brightness-95'

export const downloadName = (g: Generation): string => {
  const ext = g.outputUrl?.split('?')[0].split('.').pop() ?? (kindOfModel(g.model) === 'image' ? 'jpg' : 'mp4')
  return `slate-${kindOfModel(g.model)}-${g.id.slice(0, 8)}.${ext}`
}

function ResultStage({
  generation, develop = false, onDeveloped, onRemix, onReset,
}: {
  generation: Generation
  /** It just finished here: develop out of the generation field. */
  develop?: boolean
  onDeveloped?: () => void
  onRemix: (g: Generation) => void
  onReset: () => void
}) {
  const isImage = kindOfModel(generation.model) === 'image'
  // An image stays hidden until it has decoded, so it develops in rather than
  // fading in empty and then popping on. The field holds until then.
  const [loaded, setLoaded] = useState(!isImage)
  const [field, setField] = useState(develop)
  return (
    <>
      <Frame aspect={aspectOf(generation)} className="bg-black">
        {field && (
          <GenerationField kind={isImage ? 'image' : 'video'} leaving={loaded || !generation.outputUrl}
            onLeft={() => { setField(false); onDeveloped?.() }} />
        )}
        {!generation.outputUrl ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-ink-3">No output was stored</div>
        ) : isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={generation.outputUrl} alt={generation.prompt}
            ref={(el) => { if (el?.complete && el.naturalWidth) setLoaded(true) }}
            onLoad={() => setLoaded(true)} onError={() => setLoaded(true)}
            className={`absolute inset-0 h-full w-full object-contain ${loaded ? 'result-in' : 'opacity-0'}`} />
        ) : (
          <div className="result-in absolute inset-0">
            <VideoPlayer key={generation.outputUrl} src={generation.outputUrl} poster={generation.posterUrl ?? undefined}
              className="absolute inset-0 h-full w-full" />
          </div>
        )}
      </Frame>
      <div className="shrink-0 border-t border-line px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[13px] leading-snug text-ink">&ldquo;{generation.prompt}&rdquo;</p>
            <Spec className="mt-1.5" items={resultSpec(generation)} />
            {generation.adjustments.length > 0 && (
              <p className="mt-1 text-[11px] text-ink-3">
                {generation.adjustments.map((a) => a.reason).join(' · ')}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => onRemix(generation)} title="Load these settings into a new creation">
              <IconRemix size={14} /> Remix
            </Button>
            <Button size="sm" variant="ghost" onClick={onReset}><IconPlus size={14} /> New</Button>
            {generation.outputUrl && (
              <a href={downloadHref(generation.outputUrl, downloadName(generation))} download={downloadName(generation)}
                className={buttonClass('primary', 'md', DOWNLOAD_CLS)}>
                <IconDownload size={16} /> Download
              </a>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
