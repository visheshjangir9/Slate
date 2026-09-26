import type { ReactNode } from 'react'
import { TopBar } from '@/components/shell/TopBar'
import { Footer } from '@/components/shell/Footer'

/** Browsing surfaces scroll as documents, with the footer at the end. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="environment flex min-h-dvh flex-col">
      <TopBar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
