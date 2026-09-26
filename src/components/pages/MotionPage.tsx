'use client'

import Link from 'next/link'
import { useState } from 'react'
import { getMotion } from '@/lib/engine'
import type { MotionId } from '@/lib/engine/types'
import { MotionPreview, useLoadedImage } from '@/components/studio/MotionPreview'
import { ButtonLink } from '@/components/ui/primitives'
import { IconArrowRight } from '@/components/ui/icons'

const FAMILIES: { name: string; note: string; moves: MotionId[] }[] = [
  { name: 'Push & pull', note: 'Move toward or away from the subject.', moves: ['dolly_in', 'dolly_out', 'crash_zoom_in', 'crash_zoom_out'] },
  { name: 'Pan & tilt', note: 'Turn the camera on its axis.', moves: ['pan_left', 'pan_right', 'tilt_up', 'tilt_down', 'whip_pan'] },
  { name: 'Arc & crane', note: 'Travel around or above the frame.', moves: ['orbit_left', 'orbit_right', 'crane_up', 'crane_down'] },
  { name: 'Texture', note: 'Operator feel, or none at all.', moves: ['handheld', 'static'] },
]

const FRAMES = [
  { file: 'motion-demo.jpg', label: 'Mountain road' },
  { file: 'neon-rain.jpg', label: 'Street' },
  { file: 'harbour-portrait.jpg', label: 'Portrait' },
  { file: 'sneaker-plinth.jpg', label: 'Product' },
]

export function MotionPage() {
  const [selected, setSelected] = useState<MotionId>('dolly_in')
  const [frame, setFrame] = useState(FRAMES[0].file)
  const [hover, setHover] = useState<MotionId | null>(null)
  const source = useLoadedImage(`/explore/${frame}`)
  const move = getMotion(selected)

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-20 pt-10 sm:px-6 lg:px-10">
      <header className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] lg:items-end">
        <div>
          <p className="eyebrow text-signal">Motion library</p>
          <h1 className="display display-l mt-4">Fifteen moves. <span className="serif-accent">One engine.</span></h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-2">
            Every move is an eased, keyframed camera transform over a single frame, bounded so the edge of
            the image never shows. The previews here run the same function the renderer does.
          </p>
          <p className="mt-3 max-w-md text-xs leading-relaxed text-ink-3">
            Slate moves a camera across an image. It does not copy motion from a reference video.
          </p>
        </div>

        <div>
          <div className="relative overflow-hidden rounded-[4px] border border-line bg-surface" style={{ aspectRatio: 21 / 9 }}>
            <MotionPreview motion={selected} source={source} aspect={21 / 9} longEdge={1400} durationMs={3600}
              label={`${move.label}, playing live`} />
            <div className="scrim-b pointer-events-none absolute inset-x-0 bottom-0 h-1/2" />
            <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 p-4 sm:p-5">
              <div>
                <p className="display display-s">{move.label}</p>
                <p className="mt-1 max-w-sm text-[13px] text-ink-2">{move.description}</p>
              </div>
              <ButtonLink href={`/studio/motion?motion=${selected}`} variant="primary" size="md">
                Use {move.label} <IconArrowRight size={15} />
              </ButtonLink>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="eyebrow mr-1 text-ink-3">Try it on</span>
            {FRAMES.map((f) => (
              <button key={f.file} type="button" onClick={() => setFrame(f.file)} aria-pressed={frame === f.file}
                className={`rounded-full border px-3 py-1 text-xs transition-colors
                  ${frame === f.file ? 'border-ink-3 bg-surface-2 text-ink' : 'border-line text-ink-3 hover:text-ink'}`}>
                {f.label}
              </button>
            ))}
            <span className="ml-auto text-[11px] text-ink-3">Sample frames · your own image in Camera Motion</span>
          </div>
        </div>
      </header>

      {FAMILIES.map((fam) => (
        <section key={fam.name} className="mt-16">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
            <h2 className="display display-s">{fam.name}</h2>
            <p className="text-xs text-ink-3">{fam.note}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {fam.moves.map((id) => {
              const m = getMotion(id)
              const active = id === selected
              return (
                <article key={id} onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover(null)}
                  className="group">
                  <button type="button" onClick={() => { setSelected(id); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                    onFocus={() => setHover(id)} onBlur={() => setHover(null)}
                    aria-label={`Preview ${m.label} above`}
                    className={`relative block w-full overflow-hidden rounded-[4px] border transition-colors
                      ${active ? 'border-signal' : 'border-line group-hover:border-line-strong'}`}
                    style={{ aspectRatio: 16 / 10 }}>
                    <MotionPreview motion={id} source={source} aspect={16 / 10} longEdge={420}
                      playing={hover === id || active} label={`${m.label} preview`} />
                  </button>
                  <div className="mt-2.5 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-[14px] font-semibold">{m.label}</h3>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-ink-3">{m.description}</p>
                    </div>
                    <Link href={`/studio/motion?motion=${id}`} aria-label={`Use ${m.label} in Camera Motion`}
                      className="mt-0.5 shrink-0 rounded p-1 text-ink-3 transition-colors hover:bg-surface-2 hover:text-signal">
                      <IconArrowRight size={16} />
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
