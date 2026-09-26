import { Suspense } from 'react'
import { requireUser } from '@/lib/auth/guard'
import { withQuery } from '@/lib/auth/next'
import { AssetsPage } from '@/components/pages/AssetsPage'

export const metadata = { title: 'Assets — Slate' }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/** Account-only: a signed-out visitor never sees a library. */
export default async function Page({ searchParams }: Props) {
  await requireUser(withQuery('/assets', await searchParams))
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <AssetsPage />
    </Suspense>
  )
}
