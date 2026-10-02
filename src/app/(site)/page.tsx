import Script from 'next/script'
import { HomePage } from '@/components/home/HomePage'
import { INTRO_SCRIPT } from '@/components/home/Intro'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({
  title: 'Slate — Imagine. Create. Move. AI video & image studio',
  absolute: true,
  description: 'Create AI video, images and real camera-motion shots in one creative workspace. Write the shot, pick a camera move, download the result. Free to start.',
  path: '/',
})

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
