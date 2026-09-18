import { TopBar } from '@/components/shell/TopBar'
import { AssetsPage } from '@/components/pages/AssetsPage'

export const metadata = { title: 'Assets — Slate' }

export default function Page() {
  return (
    <div className="flex h-dvh flex-col bg-ground">
      <TopBar />
      <AssetsPage />
    </div>
  )
}
