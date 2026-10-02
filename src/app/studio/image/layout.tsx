import type { ReactNode } from 'react'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({
  title: 'Create image',
  description: 'Turn a prompt into an image with GPT Image 1, cropped exactly to the frame you choose.',
  path: '/studio/image',
  noindex: true,
})

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
