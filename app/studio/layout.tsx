import type { ReactNode } from 'react'
import { TopBar } from '@/components/shell/TopBar'
import { WorkflowTabs } from '@/components/shell/WorkflowTabs'

export default function StudioLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh flex-col bg-ground">
      <TopBar />
      <WorkflowTabs />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
