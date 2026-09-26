import Script from 'next/script'
import { HomePage } from '@/components/home/HomePage'
import { INTRO_SCRIPT } from '@/components/home/Intro'

export const metadata = {
  title: 'Slate — Imagine. Create. Move.',
  description: 'Create images, video and camera-driven scenes from one creative workspace.',
}

export default function Page() {
  return (
    <>
      {/* Runs during parse, before the intro paints: picks full / short / none. */}
      <Script id="intro-script" strategy="beforeInteractive">
        {INTRO_SCRIPT}
      </Script>
      <HomePage />
    </>
  )
}
