import { Suspense } from 'react'
import { ByokPage } from '@/components/pages/ByokPage'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({
  title: 'Bring your own AI',
  description: 'Connect your own Google, OpenAI or OpenRouter key and use models like Google Veo inside Slate. Your key stays in your browser tab and is never stored.',
  path: '/byok',
})

/**
 * Public: anyone can read how Bring your own AI works. Configuring requires
 * a session, and every endpoint behind it checks that session itself.
 */
export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh]" />}>
      <ByokPage />
    </Suspense>
  )
}
