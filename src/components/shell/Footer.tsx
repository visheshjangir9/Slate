import Link from 'next/link'
import { LIVE_MODELS } from '@/lib/catalog'
import { Mark } from './Wordmark'
import { FooterSignIn } from './FooterSignIn'
import { CookieSettingsButton } from '@/components/consent/CookieSettingsButton'

const LINK = 'text-[15px] text-ink-2 transition-colors hover:text-ink'
const LEGAL = 'py-2 text-[13px] text-ink-3 transition-colors hover:text-ink'

const COLUMNS: { title: string; links: { label: string; href: string; teaser?: string }[] }[] = [
  {
    title: 'Create',
    links: [
      { label: 'Video', href: '/studio' },
      { label: 'Image', href: '/studio/image' },
      { label: 'Camera Motion', href: '/studio/motion' },
    ],
  },
  {
    title: 'Library',
    links: [
      { label: 'Explore', href: '/explore' },
      { label: 'Motion library', href: '/motion' },
      { label: 'Known models', href: '/byok#known' },
      { label: 'Bring your own AI', href: '/byok' },
      { label: 'Your assets', href: '/assets' },
    ],
  },
  {
    title: 'Slate',
    links: [
      { label: 'Pricing', href: '/pricing' },
      { label: 'About', href: '/about' },
      { label: 'Developers', href: '/developers' },
      { label: 'Contact me', href: '/contact', teaser: 'there’s a surprise' },
    ],
  },
]

/** Every link here resolves to a working page. */
export function Footer() {
  return (
    <footer className="overflow-hidden border-t border-line bg-ground">
      <div className="wrap grid gap-8 pb-[clamp(40px,6vh,72px)] pt-[clamp(40px,6vh,72px)] min-[760px]:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div>
          <p className="display display-m">
            Make the <span className="serif-accent">shot.</span>
          </p>
          <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-ink-2">
            Slate is a studio for AI video and images. Live in this build:{' '}
            {LIVE_MODELS.map((m) => m.name).join(', ')}.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <p className="mb-3.5 text-[13.5px] text-ink-3">{col.title}</p>
            <ul className="flex flex-col gap-2.5">
              {col.links.map((l) => (
                <li key={l.href + l.label}>
                  {l.teaser ? (
                    <Link href={l.href} className={`group ${LINK}`}>
                      {l.label}
                      <span className="mt-0.5 block text-[12px] text-ink-3 transition-colors group-hover:text-ink">
                        ({l.teaser} <span className="teaser-wink">😉</span>)
                      </span>
                    </Link>
                  ) : (
                    <Link href={l.href} className={LINK}>{l.label}</Link>
                  )}
                </li>
              ))}
              {col.title === 'Slate' && <FooterSignIn className={LINK} />}
            </ul>
          </div>
        ))}
      </div>
      <div className="wrap"><div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-white/[.085] py-5">
        <span className="flex items-center gap-2 text-xs text-ink-3"><Mark size={16} /> Slate © {new Date().getFullYear()}</span>
        <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <Link href="/privacy" className={LEGAL}>Privacy Policy</Link>
          <Link href="/terms" className={LEGAL}>Terms</Link>
          <CookieSettingsButton className={LEGAL} />
        </nav>
        <span className="tabular text-[12px] text-ink-3">Built for the 8x assignment</span>
      </div></div>
      {/* The page signs off with its own name, enormous and barely there. */}
      <p aria-hidden className="foot-word">Slate</p>
    </footer>
  )
}
