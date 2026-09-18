'use client'

import { useCallback, useRef, useState } from 'react'
import { ASPECT_RATIOS, RESOLUTIONS, dimensionsFor } from '@/lib/engine'
import type { AspectRatio, Resolution } from '@/lib/engine/types'
import { stillUrl } from '@/lib/client/api'
import { Label, Panel, Segmented } from './primitives'

type Status = 'idle' | 'loading' | 'ready' | 'error'

const EXAMPLES = [
  'a brutalist concrete chapel at dawn, shafts of light through a slit window',
  'a weathered fisherman mending nets, harbour fog behind him',
  'an empty diner at 3am, rain on the window, neon sign outside',
]

export function StillImage() {
  const [prompt, setPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9')
  const [resolution, setResolution] = useState<Resolution>('1080p')
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 2_147_483_647))
  const [status, setStatus] = useState<Status>('idle')
  const [src, setSrc] = useState<string | null>(null)
  const [shown, setShown] = useState<{ prompt: string; seed: number; w: number; h: number } | null>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const dims = dimensionsFor(aspectRatio, resolution)
  const canGo = prompt.trim().length >= 3 && status !== 'loading'

  const generate = useCallback(() => {
    const p = prompt.trim()
    if (p.length < 3) return
    setStatus('loading')
    const url = stillUrl({ prompt: p, width: dims.width, height: dims.height, seed, model: 'flux' })
    // Decode before showing, so the frame never appears half-painted.
    const img = new Image()
    img.onload = () => {
      setSrc(url)
      setShown({ prompt: p, seed, w: dims.width, h: dims.height })
      setStatus('ready')
    }
    img.onerror = () => setStatus('error')
    img.src = url
  }, [prompt, dims.width, dims.height, seed])

  return (
    <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <section className="order-1 flex min-h-[40vh] flex-1 items-center justify-center p-4 lg:order-2 sm:p-8">
        {status === 'idle' && (
          <div className="max-w-sm text-center">
            <h1 className="text-xl font-semibold tracking-[-0.02em]">Generate a single frame</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-3">
              The same image engine that produces the source frame for a clip, on its own.
              Useful for finding a look before you commit to a render.
            </p>
          </div>
        )}
        {status === 'loading' && (
          <div className="grain sweep relative w-full max-w-3xl overflow-hidden rounded-card border
            border-line bg-surface" style={{ aspectRatio: dims.width / dims.height }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="h-2 w-2 rounded-full bg-accent pulse-dot" />
            </div>
          </div>
        )}
        {status === 'error' && (
          <div className="max-w-sm text-center">
            <span className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full
              border border-danger/40 text-danger">!</span>
            <p className="text-sm text-ink">That frame didn&apos;t generate</p>
            <p className="mt-1.5 text-xs text-ink-3">
              The image service did not respond. It is usually transient.
            </p>
            <button type="button" onClick={generate}
              className="mt-4 rounded-card bg-ink px-4 py-2 text-xs font-semibold text-ground hover:bg-white">
              Try again
            </button>
          </div>
        )}
        {status === 'ready' && src && shown && (
          <div className="flex w-full max-w-3xl flex-col gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={shown.prompt}
              className="w-full rounded-card border border-line bg-surface" />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="tabular flex flex-wrap items-center gap-x-3 text-[11px] text-ink-4">
                <span>{shown.w}&times;{shown.h}</span>
                <span>seed {shown.seed}</span>
              </div>
              <a
                href={src}
                download={`slate-still-${shown.seed}.jpg`}
                className="rounded-card bg-ink px-3 py-2 text-xs font-semibold text-ground
                  transition-colors duration-150 hover:bg-white"
              >
                Download
              </a>
            </div>
          </div>
        )}
      </section>

      <aside className="order-2 flex min-h-0 shrink-0 flex-col border-t border-line
        lg:order-1 lg:h-full lg:w-[380px] lg:border-r lg:border-t-0">
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-5">
          <div>
            <Label hint={`${prompt.length}/2000`}>Prompt</Label>
            <div className="rounded-card border border-line bg-surface focus-within:border-line-strong">
              <textarea
                ref={taRef}
                value={prompt}
                maxLength={2000}
                rows={4}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canGo) generate()
                }}
                placeholder="Describe the frame. Subject, setting, light, mood."
                className="w-full resize-none bg-transparent px-3 py-2.5 text-sm leading-relaxed
                  text-ink placeholder:text-ink-4 focus:outline-none"
              />
            </div>
            {!prompt && (
              <div className="mt-2 flex flex-col gap-1">
                {EXAMPLES.map((ex) => (
                  <button key={ex} type="button" onClick={() => setPrompt(ex)}
                    className="truncate rounded-md px-2 py-1.5 text-left text-xs text-ink-3
                      transition-colors duration-150 hover:bg-surface-2 hover:text-ink-2">
                    {ex}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Aspect ratio</Label>
            <Segmented value={aspectRatio} options={ASPECT_RATIOS} onChange={setAspectRatio} />
          </div>
          <div>
            <Label>Resolution</Label>
            <Segmented value={resolution} options={RESOLUTIONS} onChange={setResolution} />
          </div>
          <div>
            <Label hint="same seed, same frame">Seed</Label>
            <div className="flex gap-2">
              <input
                type="number"
                value={seed}
                min={0}
                max={2147483647}
                onChange={(e) => setSeed(Math.max(0, Math.min(2147483647, Number(e.target.value) || 0)))}
                className="tabular w-full rounded-card border border-line bg-surface px-3 py-2
                  text-xs text-ink focus:border-line-strong focus:outline-none"
              />
              <button type="button"
                onClick={() => setSeed(Math.floor(Math.random() * 2_147_483_647))}
                className="shrink-0 rounded-card border border-line px-3 py-2 text-xs text-ink-2
                  transition-colors duration-150 hover:border-line-strong hover:text-ink">
                Randomise
              </button>
            </div>
          </div>

          <Panel className="px-3 py-2.5">
            <div className="tabular flex items-center justify-between text-[11px] text-ink-3">
              <span>{dims.width}&times;{dims.height}</span>
              <span>JPEG</span>
            </div>
          </Panel>
        </div>

        <div className="shrink-0 border-t border-line bg-ground p-3 sm:p-4">
          <button
            type="button"
            onClick={generate}
            disabled={!canGo}
            className="flex w-full items-center justify-center gap-2 rounded-card bg-ink px-4 py-3
              text-sm font-semibold text-ground transition-all duration-150 hover:bg-white
              disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-4"
          >
            {status === 'loading' ? 'Generating…' : 'Generate frame'}
            {status !== 'loading' && (
              <kbd className="tabular rounded border border-ground/20 px-1 text-[10px] opacity-55">&#8984;&crarr;</kbd>
            )}
          </button>
        </div>
      </aside>
    </main>
  )
}
