'use client'

import Link from 'next/link'
import { dimensionsFor } from '@/lib/engine'
import { ERROR_COPY } from '@/lib/generation/state'
import type { Generation } from '@/lib/generation/types'
import type { RunState } from '@/lib/client/useStudio'
import { fileSize } from '@/lib/format'
import { VideoPlayer } from './VideoPlayer'

/**
 * Stage names describe what the engine actually does.
 *
 * "Moving camera" was ambiguous -- it could be read as a model moving a camera
 * through a 3-D scene. It is an eased 2-D transform over a generated frame,
 * and the copy now says so.
 */
const STAGES: { key: RunState['stage']; label: string; detail: string }[] = [
  { key: 'image', label: 'Generating frame', detail: 'The image model is producing your source frame' },
  { key: 'render', label: 'Applying camera move', detail: 'Eased transform computed for every frame' },
  { key: 'encode', label: 'Encoding H.264', detail: 'Writing real video frames in your browser' },
  { key: 'upload', label: 'Saving', detail: 'Storing the finished clip to your library' },
]

function Frame({ aspect, children }: { aspect: number; children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full items-center justify-center p-4 sm:p-6">
      <div
        className="relative w-full overflow-hidden rounded-card border border-line bg-surface"
        style={{ aspectRatio: aspect, maxHeight: '100%', maxWidth: `min(100%, calc((100cqh - 3rem) * ${aspect}))` }}
      >
        {children}
      </div>
    </div>
  )
}

export function Stage({
  generation, run, onRetry, onRemix,
}: {
  generation: Generation | null
  run: RunState | null
  onRetry: (id: string) => void
  onRemix: (g: Generation) => void
}) {
  if (!generation) return <EmptyStage />

  const dims = dimensionsFor(generation.aspectRatio, generation.resolution)
  const aspect = dims.width / dims.height
  const live = run?.id === generation.id ? run : null

  if (generation.status === 'queued' || generation.status === 'generating') {
    return <RunningStage generation={generation} aspect={aspect} run={live} />
  }
  if (generation.status === 'failed') {
    return <FailedStage generation={generation} aspect={aspect} onRetry={onRetry} onRemix={onRemix} />
  }
  return <ResultStage generation={generation} aspect={aspect} onRemix={onRemix} />
}

function EmptyStage() {
  const steps = [
    { n: '01', t: 'Describe the shot', d: 'Or drop in your own image to animate instead.' },
    { n: '02', t: 'Choose a camera move', d: 'Thirteen real cinematographic moves, from dolly to crash zoom.' },
    { n: '03', t: 'Render the clip', d: 'Encoded as genuine H.264 at the exact settings you picked.' },
  ]
  return (
    <div className="grain relative flex h-full flex-col items-center justify-center overflow-y-auto px-6 py-8">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{ background: 'radial-gradient(60% 50% at 50% 38%, rgba(240,168,104,0.06), transparent 70%)' }}
      />
      <div className="relative w-full max-w-lg text-center">
        <h1 className="text-[26px] font-semibold leading-[1.15] tracking-[-0.025em] sm:text-3xl">
          Write the shot.<br />Pick the move.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-3">
          Slate generates a frame, drives a real camera move across it, and encodes the result
          as downloadable video.
        </p>

        <ol className="mt-8 flex flex-col gap-3 text-left">
          {steps.map((s) => (
            <li key={s.n} className="flex gap-3 rounded-card border border-line bg-surface/70 px-3.5 py-3">
              <span className="tabular shrink-0 text-[11px] text-ink-4">{s.n}</span>
              <span>
                <span className="block text-[13px] font-medium text-ink-2">{s.t}</span>
                <span className="mt-0.5 block text-xs leading-snug text-ink-3">{s.d}</span>
              </span>
            </li>
          ))}
        </ol>

        <Link
          href="/studio/motion"
          className="mt-6 inline-flex items-center gap-1.5 text-xs text-ink-3 transition-colors
            duration-150 hover:text-ink-2"
        >
          Browse the motion library
          <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden>
            <path d="M4 2.5 L8 6 L4 9.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          </svg>
        </Link>
      </div>
    </div>
  )
}

function RunningStage({
  generation, aspect, run,
}: { generation: Generation; aspect: number; run: RunState | null }) {
  const stage = run?.stage ?? generation.stage ?? 'image'
  const pct = run?.progress ?? generation.progress
  const activeIdx = Math.max(0, STAGES.findIndex((s) => s.key === stage))

  return (
    <div className="flex h-full flex-col">
      <Frame aspect={aspect}>
        <div className="sweep absolute inset-0 bg-surface-2" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <span className="h-2 w-2 rounded-full bg-accent pulse-dot" />
          <span className="tabular text-sm text-ink-2">{Math.round(pct)}%</span>
        </div>
      </Frame>

      <div className="shrink-0 border-t border-line px-4 py-3.5 sm:px-6">
        <div className="mb-3 h-[3px] overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
            style={{ width: `${Math.max(3, pct)}%` }} />
        </div>
        <ol className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          {STAGES.map((s, i) => {
            const done = i < activeIdx
            const now = i === activeIdx
            return (
              <li key={s.key} className="flex items-center gap-2">
                <span className={[
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px]',
                  done ? 'border-success/50 text-success'
                    : now ? 'border-accent text-accent' : 'border-line text-ink-4',
                ].join(' ')}>
                  {done ? '✓' : i + 1}
                </span>
                <span className={`truncate text-xs ${now ? 'text-ink' : done ? 'text-ink-3' : 'text-ink-4'}`}>
                  {s.label}
                </span>
              </li>
            )
          })}
        </ol>
        <p className="mt-2.5 truncate text-xs text-ink-4">
          {STAGES[activeIdx]?.detail} &middot; you can keep working while this runs
        </p>
      </div>
    </div>
  )
}

function FailedStage({
  generation, aspect, onRetry, onRemix,
}: { generation: Generation; aspect: number; onRetry: (id: string) => void; onRemix: (g: Generation) => void }) {
  const copy = (generation.errorCode && ERROR_COPY[generation.errorCode]) || generation.errorMessage
  return (
    <div className="flex h-full flex-col">
      <Frame aspect={aspect}>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-danger/40 text-danger">!</span>
          <div>
            <p className="text-sm font-medium text-ink">That render didn&apos;t finish</p>
            <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-ink-3">{copy}</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onRetry(generation.id)}
              className="rounded-card bg-ink px-4 py-2 text-xs font-semibold text-ground
                transition-colors duration-150 hover:bg-white">
              Try again
            </button>
            <button type="button" onClick={() => onRemix(generation)}
              className="rounded-card border border-line px-3 py-2 text-xs text-ink-2
                transition-colors duration-150 hover:border-line-strong hover:text-ink">
              Remix
            </button>
          </div>
        </div>
      </Frame>
      <div className="shrink-0 border-t border-line px-4 py-3 sm:px-6">
        <p className="truncate text-xs text-ink-3">&ldquo;{generation.prompt}&rdquo;</p>
        {generation.errorCode && (
          <p className="tabular mt-1 text-[11px] text-ink-4">error: {generation.errorCode}</p>
        )}
      </div>
    </div>
  )
}

function ResultStage({
  generation, aspect, onRemix,
}: { generation: Generation; aspect: number; onRemix: (g: Generation) => void }) {
  const dims = dimensionsFor(generation.aspectRatio, generation.resolution)
  return (
    <div className="flex h-full flex-col">
      <Frame aspect={aspect}>
        {generation.outputUrl ? (
          <VideoPlayer
            key={generation.outputUrl}
            src={generation.outputUrl}
            poster={generation.posterUrl ?? undefined}
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-ink-4">
            No output
          </div>
        )}
      </Frame>

      <div className="shrink-0 border-t border-line px-4 py-3.5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink-2">&ldquo;{generation.prompt}&rdquo;</p>
            <div className="tabular mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-4">
              <span>{dims.width}&times;{dims.height}</span>
              <span>{generation.durationS}s</span>
              <span>{generation.motion.replace(/_/g, ' ')}</span>
              <span>{generation.bitrate}</span>
              <span>{fileSize(generation.fileBytes)}</span>
              <span>seed {generation.seed}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => onRemix(generation)}
              className="rounded-card border border-line px-3 py-2 text-xs text-ink-2
                transition-colors duration-150 hover:border-line-strong hover:text-ink">
              Remix
            </button>
            {generation.outputUrl && (
              <a href={generation.outputUrl}
                download={`slate-${generation.motion}-${generation.id.slice(0, 8)}.mp4`}
                className="rounded-card bg-ink px-3 py-2 text-xs font-semibold text-ground
                  transition-colors duration-150 hover:bg-white">
                Download
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
