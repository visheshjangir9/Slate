import { Suspense } from 'react'
import { TopBar } from '@/components/shell/TopBar'
import { AssetsPage } from '@/components/pages/AssetsPage'

export const metadata = { title: 'Assets — Slate' }

export default function Page() {
  return (
    <div className="flex h-dvh flex-col bg-ground">
      <TopBar />
      <Suspense fallback={<div className="flex-1 bg-ground" />}>
        <AssetsPage />
      </Suspense>
    </div>
  )
}
