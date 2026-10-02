import { Suspense } from 'react'
import { TopBar } from '@/components/shell/TopBar'
import { LoginPanel } from '@/components/auth/LoginPanel'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({
  title: 'Sign in',
  description: 'Sign in to Slate or create a free account to save your images, videos and camera-motion shots.',
  path: '/sign-in',
  noindex: true,
})

export default function SignInPage() {
  return (
    <div className="environment flex min-h-dvh flex-col">
      <TopBar />
      <Suspense fallback={<div className="flex-1" />}>
        <LoginPanel />
      </Suspense>
    </div>
  )
}
