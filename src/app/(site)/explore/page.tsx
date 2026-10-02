import { ExplorePage } from '@/components/pages/ExplorePage'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({
  title: 'Explore',
  description: 'Browse ready-made shot recipes, each a prompt, camera move and output, and load any of them into the Slate studio with one click.',
  path: '/explore',
})

export default function Page() {
  return <ExplorePage />
}
