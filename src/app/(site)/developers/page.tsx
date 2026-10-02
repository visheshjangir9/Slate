import { DevelopersPage } from '@/components/pages/DevelopersPage'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({
  title: 'Developers',
  description: 'How Slate is built: the generation API, job state machine, in-browser camera-motion renderer and provider adapters.',
  path: '/developers',
})

export default function Page() {
  return <DevelopersPage />
}
