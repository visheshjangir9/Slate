import { TopBar } from '@/components/shell/TopBar'
import { ExplorePage } from '@/components/pages/ExplorePage'

export const metadata = { title: 'Explore — Slate' }

export default function Page() {
  return (
    <div className="flex h-dvh flex-col bg-ground">
      <TopBar />
      <ExplorePage />
    </div>
  )
}
