'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CreateVideo } from '@/components/studio/CreateVideo'

function Inner() {
  const params = useSearchParams()
  return <CreateVideo params={params} />
}

export default function CreateVideoPage() {
  return (
    <Suspense fallback={<div className="flex-1 bg-ground" />}>
      <Inner />
    </Suspense>
  )
}
