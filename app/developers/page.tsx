import { TopBar } from '@/components/shell/TopBar'
import { DevelopersPage } from '@/components/pages/DevelopersPage'

export const metadata = { title: 'Developers — Slate' }

export default function Page() {
  return (
    <div className="flex h-dvh flex-col bg-ground">
      <TopBar />
      <DevelopersPage />
    </div>
  )
}
