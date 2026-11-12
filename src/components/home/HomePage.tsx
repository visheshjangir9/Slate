'use client'

import Link from 'next/link'
import { useEffect, useRef, type ReactNode } from 'react'
import { getMotion } from '@/lib/engine'
import type { MotionId } from '@/lib/engine/types'
import { RECIPES, motionStill, presetToParams, type Preset } from '@/lib/presets'
import { BYOK_PROVIDERS } from '@/lib/byok/catalog'
import { LIVE_MODELS } from '@/lib/catalog'
import { MotionPreview, useLoadedImage } from '@/components/studio/MotionPreview'
import { ButtonLink } from '@/components/ui/primitives'
import { IconArrowRight } from '@/components/ui/icons'
import { SHOWCASE, type ShowcaseMedia } from '@/lib/media'
import { ShowcaseVideo } from './ShowcaseVideo'
import { HeroMedia } from './HeroMedia'
import { Intro } from './Intro'
import { Reveal } from './Reveal'
import { useInView } from './useInView'
import { spot } from './spot'
import { artAlt } from '@/lib/artAlt'
import { PRIMARY_CTA } from '@/components/shell/nav'

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

/** The site's one filled button. The arrow leans forward under the pointer. */
function StartButton() {
  return (
    <ButtonLink href={PRIMARY_CTA.href} variant="contrast" size="lg" className="group">
      {PRIMARY_CTA.label} <IconArrowRight size={16} className="transition-transform duration-500 ease-out group-hover:translate-x-1" />
    </ButtonLink>
  )
}

const HEADLINE = ['Imagine.', 'Create.', 'Move.']

/**
 * Full-bleed footage under a clear top bar, the headline rising word by word
 * out of the base of the frame. As the page scrolls the footage drifts down
 * and the words lift away, so the hero leaves like a shot ending, not a block
 * sliding off.
 */
function Hero() {
  const media = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let queued = false
    const apply = () => {
      queued = false
      const p = Math.min(1, window.scrollY / window.innerHeight)
      if (media.current) media.current.style.transform = `translate3d(0, ${(p * 9).toFixed(2)}%, 0) scale(${(1 + p * 0.05).toFixed(4)})`
      if (inner.current) {
        inner.current.style.transform = `translate3d(0, ${(-p * 40).toFixed(1)}px, 0)`
        inner.current.style.opacity = String(Math.max(0, 1 - p * 1.25))
      }
    }
    const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(apply) } }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <section className="hero">
      {/* Four curated clips or their stills, rotating; each still is its clip's first paint and fallback. */}
      <HeroMedia parallaxRef={media} />

      <div ref={inner} className="hero-inner z-[3]">
        <div className="wrap">
          <h1 className="hero-title">
            {HEADLINE.map((word, i) => (
              <span key={word}>
                <span className="hero-word" style={{ ['--i' as string]: i }}>
                  <span className={`silver ${i === 2 ? 'serif-accent' : ''}`}>{word}</span>
                </span>
                {i < 2 && ' '}
              </span>
            ))}
          </h1>

          <div className="hero-row">
            <p className="hero-lede hero-rise" style={{ ['--d' as string]: '0ms' }}>
              Create images, video and camera-driven scenes from one creative workspace.
            </p>
            <div className="hero-rise flex flex-wrap items-center gap-3" style={{ ['--d' as string]: '90ms' }}>
              <StartButton />
              <ButtonLink href="/explore" variant="secondary" size="lg">Browse recipes</ButtonLink>
            </div>
          </div>

          {/* The clip counter and its ticks sit at the right end of this row (HeroMedia). */}
          <div className="hero-foot hero-rise" style={{ ['--d' as string]: '180ms' }}>
            <span className="meta flex items-center gap-[9px]"><span aria-hidden className="live-dot" />{PRIMARY_CTA.note}</span>
            <span className="meta hidden border-l border-white/[.085] pl-6 xl:block">
              Live in this build &nbsp;<span className="text-[#b9b9b6]">{LIVE_MODELS.map((m) => m.name).join(' · ')}</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */

/**
 * A section opens with its number and name over a rule that draws in from the
 * left, then the title rising out of a mask, with any aside following it.
 */
function SectionHead({ n, eyebrow, title, aside, action, id }: {
  n: string; eyebrow: string; title: ReactNode; aside?: ReactNode; action?: ReactNode; id?: string
}) {
  return (
    <Reveal variant="head" className="mb-[clamp(32px,5vh,56px)]">
      <p className="relative mb-9 flex items-center gap-3 pb-5 text-[13.5px] text-ink-3">
        <span className="font-mono text-[12.5px] font-medium text-ink">{n}</span>{eyebrow}
        <span aria-hidden className="rv-bar absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,rgba(255,255,255,.17),rgba(255,255,255,.085)_60%)]" />
      </p>
      <div className="grid gap-x-12 gap-y-6 md:grid-cols-[1fr_auto] md:items-end">
        <div className="rv-mask"><h2 id={id} className="rv-title display display-l">{title}</h2></div>
        {aside && <p className="rv-aside max-w-[34ch] pb-[.5em] text-[15.5px] leading-[1.55] text-[#b9b9b6]">{aside}</p>}
        {action && <div className="rv-aside pb-2">{action}</div>}
      </div>
    </Reveal>
  )
}

/** Section frame: one measure and one rhythm for every section on the page. */
const Wrap = ({ children, id, labelledBy }: { children: ReactNode; id?: string; labelledBy?: string }) => (
  <section id={id} aria-labelledby={labelledBy} className="wrap scroll-mt-20 pt-[clamp(88px,12vh,152px)]">
    {children}
  </section>
)

/** A still that plays a real camera move while it is on screen. */
function LiveFrame({ file, motion, aspect, alt, longEdge = 900 }: {
  file: string; motion: MotionId; aspect: number; alt: string; longEdge?: number
}) {
  const [ref, inView] = useInView<HTMLDivElement>({ margin: '0px' })
  const img = useLoadedImage(inView ? `/explore/${file}` : null)
  return (
    <div ref={ref} className="absolute inset-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/explore/${file}`} alt={alt} loading="lazy" className="graded absolute inset-0 h-full w-full bg-surface-2 object-cover" />
      {img && inView && (
        <div className="graded absolute inset-0">
          <MotionPreview motion={motion} source={img} aspect={aspect} longEdge={longEdge} durationMs={4200}
            label={`${alt}, ${getMotion(motion).label} running live`} />
        </div>
      )}
    </div>
  )
}

/** The round arrow that closes a card's caption. */
const Go = ({ small = false }: { small?: boolean }) => (
  <span aria-hidden className={`go ${small ? '!h-[34px] !w-[34px]' : ''}`}><IconArrowRight size={small ? 14 : 16} /></span>
)

/* ------------------------------------------------------------------ */

const CREATE = [
  // `crop` keeps a generator's corner mark out of frame (see .crop-* in globals.css).
  { href: '/studio', label: 'Video', file: 'neon-rain.jpg', motion: 'dolly_in' as MotionId, live: true,
    video: SHOWCASE.video as ShowcaseMedia | undefined, crop: 'crop-right',
    line: 'Write the shot, or start from your own image. LTX-2 Pro animates the scene itself into a clip.',
    facts: ['4, 6 or 8 s', 'up to 1080p', 'MP4'] },
  { href: '/studio/image', label: 'Image', file: 'street-portrait.jpg', motion: 'static' as MotionId, live: false,
    video: SHOWCASE.image as ShowcaseMedia | undefined, crop: 'crop-corner',
    line: 'GPT Image renders your prompt, cropped to exactly the frame you choose.',
    facts: ['6 aspect ratios', 'JPEG'] },
  // No real landscape clip yet: this tile keeps Slate's own live camera-move preview.
  { href: '/studio/motion', label: 'Camera Motion', file: 'motion-demo.jpg', motion: 'orbit_left' as MotionId, live: true,
    video: undefined as ShowcaseMedia | undefined, crop: '',
    line: 'Bring an image and drive one of fifteen real camera moves across it.',
    facts: ['15 moves', 'your image'] },
]

/** One way in: the media in a frame, the words underneath it, never on top. */
function CreateCard({ c, big, delay }: { c: (typeof CREATE)[number]; big: boolean; delay: number }) {
  // The crops are worked out for these two shapes; keep them in step with .crop-* if they change.
  const shape = big ? 'aspect-[16/10.4]' : 'aspect-[16/7.6]'
  return (
    <Reveal delay={delay} className="min-w-0">
      <Link href={c.href} {...spot} className="lit group block">
        <div className={`frame ${shape}`}>
          {c.video
            ? <ShowcaseVideo media={c.video} className={c.crop} />
            : c.live
            ? <LiveFrame file={c.file} motion={c.motion} aspect={big ? 16 / 10.4 : 16 / 7.6} alt={artAlt(c.file, c.label)} />
            // eslint-disable-next-line @next/next/no-img-element
            : <img src={`/explore/${c.file}`} alt={artAlt(c.file)} loading="lazy" className="graded absolute inset-0 h-full w-full bg-surface-2 object-cover transition-transform duration-[1100ms] group-hover:scale-[1.035]" />}
          <span className="lit-edge" />
        </div>
        <div className="flex items-start justify-between gap-5 px-0.5 pt-4">
          <div>
            <h3 className="font-display text-[21px] font-medium leading-[1.2] tracking-[-0.025em]">{c.label}</h3>
            <p className="mt-[5px] max-w-[46ch] text-[15px] leading-[1.55] text-[#b9b9b6]">{c.line}</p>
            <p className="meta mt-2">{c.facts.join(' · ')}</p>
          </div>
          <Go />
        </div>
      </Link>
    </Reveal>
  )
}

function CreateSection() {
  return (
    <Wrap>
      <SectionHead n="02" eyebrow="Create" title={<>One workspace. <span className="serif-accent">Three ways in.</span></>}
        aside="Everything you make is saved to your library the moment it finishes." />
      <div className="grid gap-x-5 gap-y-8 min-[900px]:grid-cols-[1.42fr_1fr]">
        <CreateCard c={CREATE[0]} big delay={0} />
        <div className="grid content-start gap-5">
          <CreateCard c={CREATE[1]} big={false} delay={90} />
          <CreateCard c={CREATE[2]} big={false} delay={180} />
        </div>
      </div>
    </Wrap>
  )
}

/* ------------------------------------------------------------------ */

// Every recipe is a camera move, so it opens in Camera Motion.
const presetHref = (p: Preset) => `/studio/motion?${presetToParams(p)}`

/** A frosted pill naming the recipe's category, set on the photograph. */
const Category = ({ children }: { children: ReactNode }) => (
  <span className="rounded-full border border-white/10 bg-ground/50 px-2.5 py-1 text-[12.5px] leading-none text-ink backdrop-blur-md">{children}</span>
)

function ExploreSection() {
  const lead = RECIPES.find((r) => r.id === 'concrete-light') ?? RECIPES[0]
  const rest = ['droplet', 'plinth', 'lantern-alley', 'salt-flat']
    .map((id) => RECIPES.find((r) => r.id === id)).filter((r): r is Preset => Boolean(r))

  return (
    <Wrap>
      <SectionHead n="03" eyebrow="Explore" title={<>Start from <span className="serif-accent">a recipe.</span></>}
        action={<ButtonLink href="/explore" variant="secondary" className="!h-[38px]">Browse Explore <IconArrowRight size={14} /></ButtonLink>} />
      {/* Four columns, two rows. The lead spans 2x2 and takes its height from the
          smaller tiles, so the section is exactly as tall as its content. */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-4">
        <Reveal className="md:col-span-2 lg:row-span-2" variant="media">
          <Link href={presetHref(lead)} {...spot}
            className="frame spot lit group block aspect-[16/10] lg:aspect-auto lg:h-full">
            <LiveFrame file={lead.image} motion={lead.motion} aspect={16 / 10} alt={artAlt(lead.image, lead.title)} longEdge={1200} />
            <span className="spot-light" /><span className="spot-sheen" /><span className="lit-edge" />
            <div className="scrim-b absolute inset-x-0 bottom-0 z-[2] h-2/3" />
            <div className="absolute left-4 top-4 z-[3]"><Category>{lead.category}</Category></div>
            <div className="spot-title absolute inset-x-0 bottom-0 z-[3] flex items-end justify-between gap-4 p-5 sm:p-7">
              <div>
                <p className="font-display text-[clamp(1.5rem,2.4vw,2.1rem)] font-medium leading-[1.2] tracking-[-0.03em]">{lead.title}</p>
                <p className="mt-1 max-w-lg text-[14.5px] leading-[1.55] text-[#b9b9b6]">{lead.note}</p>
                <p className="meta mt-2">{getMotion(lead.motion).label} · {lead.durationS}s · {lead.aspectRatio}</p>
              </div>
              <span className="spot-cta"><Go /></span>
            </div>
          </Link>
        </Reveal>
        {rest.map((p, i) => (
          <Reveal key={p.id} delay={100 + i * 80} variant="media">
            <Link href={presetHref(p)} {...spot} aria-label={`${p.title}: use recipe`}
              className="frame spot lit group block aspect-[4/3]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/explore/${p.image}`} alt={artAlt(p.image, p.title)} loading="lazy"
                className="graded absolute inset-0 h-full w-full bg-surface-2 object-cover" />
              <span className="spot-light" /><span className="spot-sheen" /><span className="lit-edge" />
              <div className="scrim-b absolute inset-x-0 bottom-0 z-[2] h-3/5" />
              <div className="absolute left-3 top-3 z-[3]"><Category>{p.category}</Category></div>
              <div className="spot-title absolute inset-x-0 bottom-0 z-[3] flex items-end justify-between gap-3 p-4">
                <div>
                  <p className="font-display text-[17px] font-medium leading-[1.2] tracking-[-0.02em]">{p.title}</p>
                  <p className="meta mt-1">{getMotion(p.motion).label} · {p.durationS}s · {p.aspectRatio}</p>
                </div>
                <span className="spot-cta"><Go small /></span>
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
        action={<ButtonLink href="/motion" variant="secondary" className="!h-[38px]">Motion library <IconArrowRight size={14} /></ButtonLink>} />
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 min-[900px]:grid-cols-4">
        {MOVES.map((m, i) => (
          <Reveal key={m} delay={i * 80}>
            <Link href={`/studio/motion?motion=${m}`} {...spot} className="lit group block">
              <span className="frame block" style={{ aspectRatio: '4 / 3' }}>
                <LiveFrame file={motionStill(m)} motion={m} aspect={4 / 3} alt={artAlt(motionStill(m), getMotion(m).label)} longEdge={640} />
                <span className="lit-edge" />
              </span>
              <span className="flex items-start justify-between gap-3 px-0.5 pt-3.5">
                <span>
                  <span className="block font-display text-[17px] font-medium leading-[1.2] tracking-[-0.02em]">{getMotion(m).label}</span>
                  <span className="mt-1 block text-[14.5px] leading-[1.55] text-[#b9b9b6]">{getMotion(m).description}</span>
                </span>
                <Go small />
              </span>
            </Link>
          </Reveal>
        ))}
      </div>
    </Wrap>
  )
}

/* ------------------------------------------------------------------ */

/**
 * Bring your own AI, as a headline feature: a plain promise about the key,
 * and a single way in. Nothing here lists models or claims an integration.
 */
function ByokSection() {
  return (
    <Wrap id="byok" labelledBy="byok-title">
      <SectionHead n="05" eyebrow="Bring your own AI" id="byok-title"
        title={<>Your model. Your provider. <span className="serif-accent">Your generation.</span></>} />

      <div className="grid items-start gap-12 min-[900px]:grid-cols-[1fr_1.5fr]">
        <Reveal delay={60}>
          <p className="hero-lede">
            Use the models you already have.{' '}
            Connect your provider. Choose your model. Create inside Slate.
          </p>
          <ButtonLink href="/byok" variant="secondary" size="lg" className="group mt-7">
            Try BYOK <IconArrowRight size={16} className="transition-transform duration-500 ease-out group-hover:translate-x-1" />
          </ButtonLink>
        </Reveal>

        <Reveal delay={140}>
          <ol className="plane grid overflow-hidden rounded-[14px] border border-white/[.085] sm:grid-cols-3">
            <ByokStep n="01" title="Provider" lead={BYOK_PROVIDERS.filter((p) => p.operations.length).map((p) => p.label).join(' · ')}>
              Only providers Slate has a real adapter for.
            </ByokStep>
            <ByokStep n="02" title="Your key" lead={<span className="key-type font-mono tracking-[0.2em]">••••••••••••••••</span>}>
              In this tab only. Never saved, never logged.
            </ByokStep>
            <ByokStep n="03" title="Model" lead="Video · Image">
              From your provider’s own listing, run on your account.
            </ByokStep>
          </ol>
        </Reveal>
      </div>
    </Wrap>
  )
}

function ByokStep({ n, title, lead, children }: { n: string; title: string; lead: ReactNode; children: ReactNode }) {
  return (
    <li className="border-white/[.085] px-[22px] pb-6 pt-[22px] max-sm:border-t max-sm:first:border-t-0 sm:border-l sm:first:border-l-0">
      <p className="meta flex justify-between"><span>{title}</span><span className="font-medium text-ink">{n}</span></p>
      <p className="mt-[22px] text-[16px] font-medium leading-[1.3]">{lead}</p>
      <p className="mt-1.5 text-[14.5px] leading-[1.55] text-[#b9b9b6]">{children}</p>
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
        action={<ButtonLink href="/about" variant="secondary" className="!h-[38px]">More about Slate <IconArrowRight size={14} /></ButtonLink>} />
      <div className="grid items-start gap-x-[clamp(32px,6vw,96px)] gap-y-10 min-[900px]:grid-cols-2">
        <Reveal>
          <p className="max-w-[30ch] text-[clamp(1.15rem,1.7vw,1.5rem)] leading-[1.4] tracking-[-0.012em] text-ink">
            Slate brings image generation, generative video and a real camera-motion engine into one workspace,
            so a single idea can go from a prompt to a finished, downloadable shot without leaving the page.
          </p>
        </Reveal>
        <div className="flex flex-col border-t border-white/[.085]">
          {PRINCIPLES.map((p, i) => (
            <Reveal key={p.t} delay={i * 80}>
              <div className="grid grid-cols-[56px_1fr] border-b border-white/[.085] py-[22px]">
                <span className="meta">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <p className="text-[17px] font-medium leading-[1.3] tracking-[-0.01em]">{p.t}</p>
                  <p className="mt-[5px] max-w-[52ch] text-[15px] leading-[1.55] text-[#b9b9b6]">{p.d}</p>
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
    <section className="wrap pb-[clamp(88px,12vh,152px)] pt-[clamp(88px,12vh,152px)]">
      <Reveal>
        <div className="plane grid overflow-hidden rounded-[20px] border border-white/[.085] min-[900px]:grid-cols-[1fr_1.1fr]">
          <div className="order-2 flex flex-col justify-between gap-10 p-[clamp(28px,4.5vw,64px)] min-[900px]:order-1">
            <p className="display display-m">Your next shot <span className="serif-accent">starts here.</span></p>
            <div>
              <StartButton />
              <p className="meta mt-3.5">{PRIMARY_CTA.note}</p>
            </div>
          </div>
          <div className="relative order-1 min-h-[280px] bg-black min-[900px]:order-2 min-[900px]:min-h-[380px]">
            <ShowcaseVideo media={SHOWCASE.featured} />
          </div>
        </div>
      </Reveal>
    </section>
  )
}
