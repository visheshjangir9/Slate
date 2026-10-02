import { Suspense } from 'react'
import { requireUser } from '@/lib/auth/guard'
import { withQuery } from '@/lib/auth/next'
import { AssetsPage } from '@/components/pages/AssetsPage'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({
  title: 'Your assets',
  description: 'Every image and video you have made with Slate, ready to download, retry or remix.',
  path: '/assets',
  noindex: true,
})

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/** Account-only: a signed-out visitor never sees a library. */
export default async function Page({ searchParams }: Props) {
  await requireUser(withQuery('/assets', await searchParams))
  return (
    <Suspense fallback={<div className="min-h-[100dvh]" />}>
      <AssetsPage />
    </Suspense>
  )
}
