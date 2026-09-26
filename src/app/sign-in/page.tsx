import { Suspense } from 'react'
import { TopBar } from '@/components/shell/TopBar'
import { LoginPanel } from '@/components/auth/LoginPanel'

export const metadata = { title: 'Sign in — Slate' }

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
