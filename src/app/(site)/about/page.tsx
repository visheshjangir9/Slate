import Link from 'next/link'
import { LIVE_MODELS } from '@/lib/catalog'
import { buttonClass } from '@/components/ui/button'
import { IconArrowRight, IconArrowUpRight } from '@/components/ui/icons'

export const metadata = {
  title: 'About — Slate',
  description: 'Slate is a creative studio for AI images, video and camera-driven scenes.',
}

const REPO = 'https://github.com/visheshjangir9/Slate'

const PRINCIPLES = [
  {
    t: 'Real output',
    d: 'Every result is a real file: H.264 video or JPEG, stored in your library before Slate calls it finished. Progress is only shown where it is measured.',
  },
  {
    t: 'Honest controls',
    d: 'A setting appears only when the chosen model honours it. Models Slate cannot run are listed as catalogue entries, never as options.',
  },
  {
    t: 'The shot first',
    d: 'Prompt, source image, camera move and frame are the language of the tool, because they are the language of the shot.',
  },
  {
    t: 'Yours',
    d: 'Studio, history and assets live in your account, so your work follows you to any browser. The public site needs no account at all.',
  },
]

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-32 pt-14 sm:px-6 lg:px-10 lg:pt-24">
      <p className="eyebrow text-signal">About Slate</p>
      <h1 className="display display-xl mt-6 max-w-6xl [text-wrap:balance]">
        A studio for the shot, <span className="serif-accent">not the slot machine.</span>
      </h1>

      <div className="mt-16 grid gap-12 border-t border-line pt-10 lg:grid-cols-[1fr_1fr]">
        <section>
          <p className="eyebrow text-ink-3">What Slate is</p>
          <p className="mt-5 max-w-xl text-[clamp(1.15rem,1.6vw,1.45rem)] leading-[1.5] text-ink">
            Slate brings image generation, generative video and a real camera-motion engine into one workspace.
            A single idea goes from a prompt, or your own image, to a finished, downloadable shot without leaving the page.
          </p>
        </section>
        <section>
          <p className="eyebrow text-ink-3">Designed for</p>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink-2">
            People who think in shots: filmmakers blocking a sequence, designers building a campaign frame, creators
            who need a moving image rather than a still. Slate is built for deciding what the camera does, not for
            pulling a lever and hoping.
          </p>
          <p className="mt-4 max-w-xl text-[13px] leading-relaxed text-ink-3">
            Live in this build: {LIVE_MODELS.map((m) => m.name).join(', ')}.
          </p>
        </section>
      </div>

      <section className="mt-20">
        <p className="eyebrow text-ink-3">Philosophy</p>
        <div className="mt-6 grid gap-px overflow-hidden rounded-[6px] border border-line bg-line sm:grid-cols-2">
          {PRINCIPLES.map((p, i) => (
            <div key={p.t} className="bg-[#0e0e0f] p-6 sm:p-8">
              <span className="tabular text-[11px] text-signal">{String(i + 1).padStart(2, '0')}</span>
              <h2 className="display display-s mt-4">{p.t}</h2>
              <p className="mt-3 max-w-md text-[14px] leading-relaxed text-ink-3">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-20 grid gap-10 border-t border-line pt-10 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="eyebrow text-ink-3">Contact</p>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink-2">
            Questions, feedback or a bug to report: open an issue on the project repository.
          </p>
          <a href={REPO} target="_blank" rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-[15px] font-medium text-ink hover:text-signal">
            github.com/visheshjangir9/Slate <IconArrowUpRight size={15} />
          </a>
        </div>
        <Link href="/studio" className={buttonClass('contrast', 'lg')}>
          Enter Studio <IconArrowRight size={16} />
        </Link>
      </section>
    </div>
  )
}
