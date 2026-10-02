import Link from 'next/link'
import { LIVE_MODELS } from '@/lib/catalog'
import { Mark } from './Wordmark'
import { FooterSignIn } from './FooterSignIn'
import { CookieSettingsButton } from '@/components/consent/CookieSettingsButton'

const LINK = 'text-sm text-ink-2 transition-colors hover:text-ink'
const LEGAL = 'py-2 text-xs text-ink-3 transition-colors hover:text-ink'

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
      { label: 'About', href: '/about' },
      { label: 'Developers', href: '/developers' },
      { label: 'Contact me', href: '/contact', teaser: 'there’s a surprise' },
    ],
  },
]

/** Every link here resolves to a working page. */
export function Footer() {
  return (
    <footer className="border-t border-line bg-ground">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 pb-8 pt-14 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-10">
        <div>
          <p className="display display-m text-ink">
            Make the <span className="serif-accent text-signal">shot.</span>
          </p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-3">
            Slate is a studio for AI video and images. Live in this build:{' '}
            {LIVE_MODELS.map((m) => m.name).join(', ')}.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <p className="eyebrow mb-4 text-ink-3">{col.title}</p>
            <ul className="flex flex-col gap-2.5">
              {col.links.map((l) => (
                <li key={l.href + l.label}>
                  {l.teaser ? (
                    <Link href={l.href} className={`group ${LINK}`}>
                      {l.label}
                      <span className="mt-0.5 block text-[11px] text-ink-4 transition-colors group-hover:text-signal">
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
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-line px-4 py-5 sm:px-6 lg:px-10">
        <span className="flex items-center gap-2 text-xs text-ink-3"><Mark size={16} /> Slate © {new Date().getFullYear()}</span>
        <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <Link href="/privacy" className={LEGAL}>Privacy Policy</Link>
          <Link href="/terms" className={LEGAL}>Terms</Link>
          <CookieSettingsButton className={LEGAL} />
        </nav>
        <span className="tabular text-[11px] text-ink-3">Built for the 8x assignment</span>
      </div>
    </footer>
  )
}
