import type { ReactNode } from 'react'
import { TopBar } from '@/components/shell/TopBar'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({
  title: 'Create video',
  description: 'Generate a 4, 6 or 8 second AI video from a prompt or your own image with LTX-2 Pro.',
  path: '/studio',
  noindex: true,
})

/** The workspace fills the viewport on desktop; on phones it scrolls. */
export default function StudioLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip bg-ground lg:h-dvh lg:overflow-hidden">
      <TopBar />
      <main id="main" className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  )
}
