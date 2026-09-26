import { Suspense } from 'react'
import { ByokPage } from '@/components/pages/ByokPage'

export const metadata = {
  title: 'Bring your own AI — Slate',
  description: 'Connect a compatible AI provider and use its models inside Slate. Your key stays private to you.',
}

/**
 * Public: anyone can read how Bring your own AI works. Configuring requires
 * a session, and every endpoint behind it checks that session itself.
 */
export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <ByokPage />
    </Suspense>
  )
}
