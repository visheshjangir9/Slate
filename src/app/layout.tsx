import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, Geist, Geist_Mono, Instrument_Serif } from 'next/font/google'
import { SITE, siteUrl } from '@/lib/site'
import { CookieConsent } from '@/components/consent/CookieConsent'
import { ConsentedAnalytics } from '@/components/consent/ConsentedAnalytics'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' })
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  axes: ['opsz', 'wdth'],
  display: 'swap',
})
const instrument = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['italic'],
  variable: '--font-instrument',
  display: 'swap',
})

/**
 * Defaults for every page. A page sets `title` (wrapped by the template),
 * `description` and `alternates.canonical` (see lib/metadata.ts); icons
 * come from the file conventions in this folder.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s — ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: SITE.owner }],
  creator: SITE.owner,
  keywords: ['AI video generator', 'AI image generator', 'camera motion', 'text to video', 'image to video', 'Slate'],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: SITE.name,
    locale: 'en_US',
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    url: '/',
    images: [SITE.ogImage],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    images: [SITE.ogImage],
  },
  formatDetection: { telephone: false, email: false, address: false },
}

export const viewport: Viewport = {
  themeColor: '#0b0b0c',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      // The homepage intro script sets data-intro on <html> before hydration.
      suppressHydrationWarning
      className={`${geist.variable} ${geistMono.variable} ${bricolage.variable} ${instrument.variable}`}
    >
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        {children}
        <CookieConsent />
        <ConsentedAnalytics />
      </body>
    </html>
  )
}
