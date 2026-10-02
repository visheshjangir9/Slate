import type { ReactNode } from 'react'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({
  title: 'Camera Motion',
  description: 'Apply one of 15 real camera moves to your own image and render an H.264 MP4 in your browser.',
  path: '/studio/motion',
  noindex: true,
})

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
