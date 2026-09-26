import type { ReactNode } from 'react'
import { TopBar } from '@/components/shell/TopBar'

export const metadata = { title: 'Create video — Slate' }

/** The workspace fills the viewport on desktop; on phones it scrolls. */
export default function StudioLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip bg-ground lg:h-dvh lg:overflow-hidden">
      <TopBar />
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  )
}
