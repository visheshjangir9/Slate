import { MotionPage } from '@/components/pages/MotionPage'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({
  title: 'Motion library',
  description: 'Fifteen real camera moves, including dolly, orbit, crane and crash zoom, previewed live. Apply any of them to your own image in Slate.',
  path: '/motion',
})

export default function Page() {
  return <MotionPage />
}
