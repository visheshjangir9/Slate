'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import type { Workflow } from '@/components/shell/nav'
import { Studio } from './Studio'

function Inner({ workflow }: { workflow: Workflow }) {
  const params = useSearchParams()
  return <Studio workflow={workflow} params={params} />
}

/** Client half of a Studio route; the server half has already checked the session. */
export function StudioRoute({ workflow }: { workflow: Workflow }) {
  return (
    <Suspense fallback={<div className="flex-1 bg-ground" />}>
      <Inner workflow={workflow} />
    </Suspense>
  )
}
