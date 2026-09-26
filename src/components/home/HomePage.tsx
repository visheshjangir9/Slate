'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { getMotion } from '@/lib/engine'
import type { MotionId } from '@/lib/engine/types'
import { RECIPES, motionStill, presetToParams, type Preset } from '@/lib/presets'
import { BYOK_PROVIDERS } from '@/lib/byok/catalog'
import { MotionPreview, useLoadedImage } from '@/components/studio/MotionPreview'
import { ButtonLink, Spec, Tag } from '@/components/ui/primitives'
import { IconArrowRight, IconArrowUpRight, IconImage, IconMotion, IconVideo } from '@/components/ui/icons'
import { SHOWCASE, type ShowcaseMedia } from '@/lib/media'
import { ShowcaseVideo } from './ShowcaseVideo'
import { HeroMedia } from './HeroMedia'
import { Intro } from './Intro'
import { Reveal } from './Reveal'
import { useInView } from './useInView'

const REPO = 'https://github.com/visheshjangir9/Slate'

export function HomePage() {
  return (
    <div className="relative">
      <Intro />
      <Hero />
      <CreateSection />
      <ExploreSection />
      <MotionSection />
      <ByokSection />
      <AboutSection />
      <FinalCta />
    </div>
  )
}

/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="relative px-3 pt-3 sm:px-5 sm:pt-5"
      style={{ ['--h' as string]: 'clamp(2.6rem, 7.8vw, 8.5rem)' }}>
      <div className="mx-auto max-w-[1600px]">
        {/* The media is a framed plane, not a wallpaper: space around it is part of the composition. */}
        <div className="plane relative h-[clamp(400px,68svh,760px)] overflow-hidden rounded-[6px] border border-line">
          {/* Four curated clips or their stills, rotating; each still is its clip's first paint and fallback. */}
          <HeroMedia />
          {/* Restrained: a light edge falloff and a short base so the headline reads. */}
          <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_20px_rgba(8,8,9,0.35)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-[#0c0c0d]/80 via-[#0c0c0d]/30 to-transparent" />
          <p className="hero-rise eyebrow absolute left-4 top-4 text-ink-2 max-sm:hidden sm:left-6 sm:top-5" style={{ ['--d' as string]: '0ms' }}>
            Slate · AI creative studio
          </p>
        </div>

        {/* IMAGINE. and CREATE. sit inside the image; MOVE. breaks out across the frame edge. */}
        <div className="relative z-10 -mt-[calc(var(--h)*1.74)] grid gap-8 px-3 pb-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:px-8 lg:pb-24">
          <h1 className="display text-[length:var(--h)] uppercase leading-[0.87] tracking-[-0.05em]">
            <span className="hero-rise block text-ink" style={{ ['--d' as string]: '20ms' }}>Imagine.</span>
            <span className="hero-rise block text-ink" style={{ ['--d' as string]: '90ms' }}>Create.</span>
            <span className="hero-rise block text-signal" style={{ ['--d' as string]: '160ms' }}>Move.</span>
          </h1>
          {/* Aligned with MOVE.: starts at the frame's edge, so it never competes with the image. */}
          <div className="hero-rise lg:pt-[calc(var(--h)*1.74+1.25rem)]" style={{ ['--d' as string]: '260ms' }}>
            <p className="max-w-sm border-t border-line pt-4 text-[15px] leading-relaxed text-ink-3">
              Create images, video and camera-driven scenes from one creative workspace.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <ButtonLink href="/studio" variant="contrast" size="lg" className="uppercase tracking-[0.08em]">
                Enter Studio <IconArrowRight size={16} />
              </ButtonLink>
              <ButtonLink href="/explore" variant="ghost" size="lg" className="uppercase tracking-[0.08em]">Explore</ButtonLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */

function SectionHead({ n, eyebrow, title, aside, action }: {
  n: string; eyebrow: string; title: ReactNode; aside?: ReactNode; action?: ReactNode
}) {
  return (
    <Reveal>
      <div className="grid gap-6 border-t border-line pt-8 lg:grid-cols-[1fr_minmax(0,24rem)] lg:items-end">
        <div>
          <p className="eyebrow flex items-center gap-3 text-ink-3">
            <span className="text-signal">{n}</span><span className="h-px w-8 bg-line-strong" />{eyebrow}
          </p>
          <h2 className="display display-l mt-5 [text-wrap:balance]">{title}</h2>
        </div>
        <div className="flex flex-col items-start gap-4 lg:items-end lg:text-right">
          {aside && <p className="text-[15px] leading-relaxed text-ink-2">{aside}</p>}
          {action}
        </div>
      </div>
    </Reveal>
  )
}

/**
 * Section frame. `raised` sections sit on a band one step lighter than the
 * ground, which is how the page gets gentle contrast shifts instead of one
 * flat black field.
 */
const Wrap = ({ children, id, raised = false }: { children: ReactNode; id?: string; raised?: boolean }) => {
  const inner = (
    <section id={id} className="mx-auto max-w-[1440px] scroll-mt-20 px-4 sm:px-6 lg:px-10">{children}</section>
  )
  return raised
    ? <div className="band mt-28 py-16 lg:mt-40 lg:py-24">{inner}</div>
    : <div className="pt-28 lg:pt-40">{inner}</div>
}

/** A still that plays a real camera move while it is on screen. */
function LiveFrame({ file, motion, aspect, alt, longEdge = 900 }: {
  file: string; motion: MotionId; aspect: number; alt: string; longEdge?: number
}) {
  const [ref, inView] = useInView<HTMLDivElement>({ margin: '0px' })
  const img = useLoadedImage(inView ? `/explore/${file}` : null)
  return (
    <div ref={ref} className="absolute inset-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/explore/${file}`} alt={alt} loading="lazy" className="graded absolute inset-0 h-full w-full object-cover" />
      {img && inView && (
        <div className="graded absolute inset-0">
          <MotionPreview motion={motion} source={img} aspect={aspect} longEdge={longEdge} durationMs={4200}
            label={`${alt}, ${getMotion(motion).label} running live`} />
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

const CREATE = [
  { href: '/studio', label: 'Video', Icon: IconVideo, file: 'neon-rain.jpg', motion: 'dolly_in' as MotionId, live: true, video: SHOWCASE.video as ShowcaseMedia | undefined,
    line: 'Write the shot, or start from your own image. LTX-2 Pro animates the scene itself into a clip.',
    facts: ['4, 6 or 8s', 'Up to 1080p', 'MP4'] },
  { href: '/studio/image', label: 'Image', Icon: IconImage, file: 'street-portrait.jpg', motion: 'static' as MotionId, live: false, video: SHOWCASE.image as ShowcaseMedia | undefined,
    line: 'GPT Image renders your prompt, cropped to exactly the frame you choose.',
    facts: ['6 aspect ratios', 'JPEG'] },
  // No real landscape clip yet: this tile keeps Slate's own live camera-move preview.
  { href: '/studio/motion', label: 'Camera Motion', Icon: IconMotion, file: 'motion-demo.jpg', motion: 'orbit_left' as MotionId, live: true, video: undefined as ShowcaseMedia | undefined,
    line: 'Bring an image and drive one of fifteen real camera moves across it.',
    facts: ['15 moves', 'Your image'] },
]

function CreateSection() {
  return (
    <Wrap>
      <SectionHead n="02" eyebrow="Create" title={<>One workspace. <span className="serif-accent">Three ways in.</span></>}
        aside="Everything you make is saved to your library the moment it finishes." />
      <div className="mt-12 grid gap-3 lg:grid-cols-12 lg:grid-rows-[minmax(0,22rem)_minmax(0,22rem)]">
        {CREATE.map((c, i) => (
          <Reveal key={c.href} delay={i * 90}
            className={`min-w-0 ${i === 0 ? 'lg:col-span-7 lg:row-span-2' : 'lg:col-span-5'}`}>
            <Link href={c.href} className={`group relative block overflow-hidden rounded-[4px] border border-line transition-colors
              hover:border-line-strong lg:aspect-auto lg:h-full ${i === 0 ? 'aspect-[4/5] sm:aspect-[4/3.4]' : 'aspect-[4/5] sm:aspect-[16/10]'}`}>
              {c.video
                ? <ShowcaseVideo media={c.video} />
                : c.live
                ? <LiveFrame file={c.file} motion={c.motion} aspect={i === 0 ? 1.2 : 1.9} alt={c.label} />
                // eslint-disable-next-line @next/next/no-img-element
                : <img src={`/explore/${c.file}`} alt="" loading="lazy" className="graded absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />}
              <div className="scrim-b absolute inset-x-0 bottom-0 h-3/4" />
              <div className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-[5px] bg-ground/85 text-ink">
                <c.Icon size={17} />
              </div>
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                <p className={`display ${i === 0 ? 'display-l' : 'display-m'}`}>{c.label}</p>
                <p className="mt-3 max-w-md text-[14px] leading-relaxed text-ink-2">{c.line}</p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <Spec items={c.facts} className="text-ink-2" />
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-signal">
                    Open <IconArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </Wrap>
  )
}

/* ------------------------------------------------------------------ */

// Every recipe is a camera move, so it opens in Camera Motion.
const presetHref = (p: Preset) => `/studio/motion?${presetToParams(p)}`

function ExploreSection() {
  const lead = RECIPES.find((r) => r.id === 'concrete-light') ?? RECIPES[0]
  const rest = ['droplet', 'plinth', 'lantern-alley', 'salt-flat']
    .map((id) => RECIPES.find((r) => r.id === id)).filter((r): r is Preset => Boolean(r))

  return (
    <Wrap raised>
      <SectionHead n="03" eyebrow="Explore" title={<>Start from <span className="serif-accent">a recipe.</span></>}
        aside="Fifteen specified shots: prompt, camera move and output. One click loads any of them into Camera Motion."
        action={<ButtonLink href="/explore" variant="secondary">Browse Explore <IconArrowRight size={14} /></ButtonLink>} />
      {/* Four columns, two rows. The lead spans 2x2 and takes its height from the
          smaller tiles, so the section is exactly as tall as its content. */}
      <div className="mt-12 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Reveal className="md:col-span-2 lg:row-span-2">
          <Link href={presetHref(lead)}
            className="group relative block aspect-[16/10] overflow-hidden rounded-[4px] border border-line hover:border-line-strong lg:aspect-auto lg:h-full">
            <LiveFrame file={lead.image} motion={lead.motion} aspect={16 / 10} alt={lead.title} longEdge={1200} />
            <div className="scrim-b absolute inset-x-0 bottom-0 h-2/3" />
            <div className="absolute left-4 top-4"><Tag tone="neutral" onMedia>{lead.category}</Tag></div>
            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
              <p className="display display-m">{lead.title}</p>
              <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-ink-2">{lead.note}</p>
              <Spec className="mt-3 text-ink-2" items={[getMotion(lead.motion).label, `${lead.durationS}s`, lead.aspectRatio]} />
            </div>
          </Link>
        </Reveal>
        {rest.map((p, i) => (
          <Reveal key={p.id} delay={80 + i * 70}>
            <Link href={presetHref(p)}
              className="group relative block aspect-[4/3] overflow-hidden rounded-[4px] border border-line hover:border-line-strong">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/explore/${p.image}`} alt={p.title} loading="lazy"
                className="graded absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
              <div className="scrim-b absolute inset-x-0 bottom-0 h-3/5" />
              <div className="absolute left-3 top-3"><Tag tone="neutral" onMedia>{p.category}</Tag></div>
              <div className="absolute inset-x-0 bottom-0 p-4">
                <p className="text-[15px] font-semibold leading-tight">{p.title}</p>
                <p className="tabular mt-1 text-[11px] text-ink-2">{getMotion(p.motion).label} · {p.durationS}s · {p.aspectRatio}</p>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </Wrap>
  )
}

/* ------------------------------------------------------------------ */

const MOVES: MotionId[] = ['dolly_in', 'dolly_out', 'orbit_left', 'crane_up']

function MotionSection() {
  return (
    <Wrap>
      <SectionHead n="04" eyebrow="Motion" title={<>Fifteen real <span className="serif-accent">camera moves.</span></>}
        aside="Eased, keyframed and bounded so the frame edge never shows. What plays here is the same transform the renderer encodes."
        action={<ButtonLink href="/motion" variant="contrast">Motion Library <IconArrowRight size={14} /></ButtonLink>} />
      <div className="mt-12 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {MOVES.map((m, i) => (
          <Reveal key={m} delay={i * 80}>
            <Link href={`/studio/motion?motion=${m}`} className="group block">
              <span className="relative block overflow-hidden rounded-[4px] border border-line group-hover:border-line-strong"
                style={{ aspectRatio: '3 / 4' }}>
                <LiveFrame file={motionStill(m)} motion={m} aspect={3 / 4} alt={getMotion(m).label} longEdge={640} />
              </span>
              <span className="mt-3 flex items-center justify-between">
                <span className="text-[15px] font-semibold">{getMotion(m).label}</span>
                <IconArrowUpRight size={15} className="text-ink-4 transition-colors group-hover:text-signal" />
              </span>
              <span className="mt-1 block text-xs leading-snug text-ink-3">{getMotion(m).description}</span>
            </Link>
          </Reveal>
        ))}
      </div>
    </Wrap>
  )
}

/* ------------------------------------------------------------------ */

/**
 * Bring your own AI, as a headline feature: one of the page's biggest type
 * moments, a plain promise about the key, and a single way in. Nothing here
 * lists models or claims an integration.
 */
function ByokSection() {
  return (
    <div id="byok" className="band mt-28 scroll-mt-20 overflow-hidden py-20 lg:mt-40 lg:py-32">
      <section aria-labelledby="byok-title" className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <Reveal>
          <p className="eyebrow flex items-center gap-3 text-ink-3">
            <span className="text-signal">05</span><span className="h-px w-8 bg-line-strong" />Bring your own AI
          </p>
          <h2 id="byok-title" className="display mt-8 text-[clamp(2rem,11.2vw,8.5rem)] uppercase leading-[0.86] tracking-[-0.055em]">
            <span className="block whitespace-nowrap">Your model.</span>
            <span className="block whitespace-nowrap">Your provider.</span>
            <span className="block whitespace-nowrap text-signal">Your generation.</span>
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-10 border-t border-line pt-10 lg:mt-20 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-16">
          <Reveal delay={80}>
            <p className="text-[17px] leading-relaxed text-ink">Use the models you already have.</p>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-3">Connect your provider. Choose your model. Create inside Slate.</p>
            <ButtonLink href="/byok" variant="contrast" size="lg" className="mt-8 uppercase tracking-[0.08em]">
              Try BYOK <IconArrowRight size={16} />
            </ButtonLink>
          </Reveal>

          <Reveal delay={160}>
            <ol className="grid gap-px overflow-hidden rounded-[6px] border border-line bg-line sm:grid-cols-3">
              <ByokStep n="01" title="Provider">
                <span className="text-ink-2">{BYOK_PROVIDERS.filter((p) => p.operations.length).map((p) => p.label).join(' · ')}</span>
                <span className="mt-1 block text-ink-4">Only providers Slate has a real adapter for.</span>
              </ByokStep>
              <ByokStep n="02" title="Your key">
                <span className="key-type font-mono tracking-[0.2em] text-ink-2">••••••••••••••••</span>
                <span className="mt-1 block text-ink-4">In this tab only. Never saved, never logged.</span>
              </ByokStep>
              <ByokStep n="03" title="Model">
                <span className="text-ink-2">Video · Image</span>
                <span className="mt-1 block text-ink-4">From your provider’s own listing, run on your account.</span>
              </ByokStep>
            </ol>
          </Reveal>
        </div>
      </section>
    </div>
  )
}

function ByokStep({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <li className="flex min-h-[10.5rem] flex-col justify-between gap-6 bg-[#0e0e10] p-5 transition-colors duration-300 hover:bg-[#121214] sm:p-6">
      <span className="flex items-baseline justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">{title}</span>
        <span className="tabular text-[11px] text-signal">{n}</span>
      </span>
      <span className="block text-[13px] leading-relaxed">{children}</span>
    </li>
  )
}

/* ------------------------------------------------------------------ */

const PRINCIPLES = [
  { t: 'Real output', d: 'Every result is a real file, H.264 video or JPEG, stored in your library before it is called finished.' },
  { t: 'Honest controls', d: 'A setting appears only when the chosen model honours it. Nothing on screen is decorative.' },
  { t: 'Yours', d: 'Studio, history and assets live in your account and follow you to any browser.' },
]

function AboutSection() {
  return (
    <Wrap>
      <SectionHead n="06" eyebrow="About Slate" title={<>A studio, <span className="serif-accent">not a slot machine.</span></>}
        action={<ButtonLink href="/about" variant="secondary">More about Slate <IconArrowRight size={14} /></ButtonLink>} />
      <div className="mt-12 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        <Reveal>
          <p className="max-w-2xl text-[clamp(1.15rem,1.7vw,1.5rem)] leading-[1.45] text-ink">
            Slate brings image generation, generative video and a real camera-motion engine into one workspace,
            so a single idea can go from a prompt to a finished, downloadable shot without leaving the page.
          </p>
          <div className="mt-8 rounded-[4px] border border-line bg-surface/70 p-5">
            <p className="eyebrow text-ink-3">Contact</p>
            <p className="mt-2 text-[14px] text-ink-2">Questions, feedback or a bug to report: open an issue on the project repository.</p>
            <a href={REPO} target="_blank" rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-medium text-ink hover:text-signal">
              github.com/visheshjangir9/Slate <IconArrowUpRight size={14} />
            </a>
          </div>
        </Reveal>
        <div className="flex flex-col">
          {PRINCIPLES.map((p, i) => (
            <Reveal key={p.t} delay={i * 90}>
              <div className="grid grid-cols-[2.5rem_1fr] gap-4 border-t border-line py-5">
                <span className="tabular pt-1 text-[11px] text-signal">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <p className="text-[17px] font-semibold tracking-[-0.01em]">{p.t}</p>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-ink-3">{p.d}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </Wrap>
  )
}

/* ------------------------------------------------------------------ */

function FinalCta() {
  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-28 pt-28 sm:px-6 lg:px-10 lg:pb-40 lg:pt-40">
      <Reveal>
        <div className="plane grid items-center gap-8 overflow-hidden rounded-[6px] border border-line p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-12 lg:p-12">
          <div className="order-2 lg:order-1">
            <p className="eyebrow mb-6 flex items-center gap-3 text-ink-3">
              <span className="text-signal">07</span><span className="h-px w-8 bg-line-strong" />Start
            </p>
            <p className="display text-[clamp(2.6rem,6vw,6.25rem)] uppercase leading-[0.86] tracking-[-0.05em]">
              Your next shot<br /><span className="text-signal">starts here.</span>
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              <ButtonLink href="/studio" variant="contrast" size="lg" className="uppercase tracking-[0.08em]">
                Enter Studio <IconArrowRight size={16} />
              </ButtonLink>
              <ButtonLink href="/explore" variant="ghost" size="lg" className="uppercase tracking-[0.08em]">Explore</ButtonLink>
            </div>
          </div>
          {/* The full 16:9 frame, uncropped: the clip is shown as it was made. */}
          <div className="relative order-1 aspect-video overflow-hidden rounded-[4px] border border-line bg-black lg:order-2">
            <ShowcaseVideo media={SHOWCASE.featured} />
          </div>
        </div>
      </Reveal>
    </section>
  )
}
