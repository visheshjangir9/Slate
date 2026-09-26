'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import type { ReadonlyURLSearchParams } from 'next/navigation'
import { composerFromParams, useStudio, type VideoMode } from '@/lib/client/useStudio'
import type { Generation } from '@/lib/generation/types'
import { useUnloadGuard } from '@/lib/client/useUnloadGuard'
import { WORKFLOWS, type Workflow } from '@/components/shell/nav'
import { Sheet } from '@/components/ui/primitives'
import { IconArrowRight, IconImage, IconMotion, IconVideo } from '@/components/ui/icons'
import { Composer } from './Composer'
import { HistoryRail } from './HistoryRail'
import { Stage } from './Stage'
import { useLoadedImage } from './MotionPreview'

const ICON = { video: IconVideo, image: IconImage, motion: IconMotion }

/** Demo frames for move previews, used only until the user adds an image.
 *  Only Camera Motion has one: Video never previews a camera move, and Image
 *  never shows an example picture where its result will appear. */
const DEMO_FRAME: Record<Workflow, string | null> = {
  video: null,
  image: null,
  motion: '/explore/motion-demo.jpg',
}

function WorkflowTabs({ active }: { active: Workflow }) {
  return (
    <nav aria-label="Workflows" className="flex shrink-0 border-b border-line">
      {WORKFLOWS.map((w) => {
        const on = w.id === active
        const Icon = ICON[w.id]
        return (
          <Link key={w.id} href={w.href} aria-current={on ? 'page' : undefined}
            className={`relative flex flex-1 items-center justify-center gap-1.5 py-3 text-[13px] font-medium transition-colors
              ${on ? 'text-ink' : 'text-ink-3 hover:text-ink'}`}>
            <Icon size={15} />
            {w.id === 'motion' ? <span><span className="hidden sm:inline">Camera </span>Motion</span> : w.label}
            <span className={`absolute inset-x-3 bottom-[-1px] h-[2px] bg-signal ${on ? 'opacity-100' : 'opacity-0'}`} />
          </Link>
        )
      })}
    </nav>
  )
}

export function Studio({ workflow, params }: { workflow: Workflow; params: ReadonlyURLSearchParams | null }) {
  // Read once on mount: later renders must not overwrite user edits.
  const initial = useMemo(
    () => composerFromParams(params ? new URLSearchParams(params.toString()) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // Text / Image to Video lives in the URL (?mode=image), so it is shareable,
  // the Features menu can link to either, and switching never reloads.
  const videoMode: VideoMode = workflow === 'video' && params?.get('mode') === 'image' ? 'image' : 'text'
  const [modeDir, setModeDir] = useState<'l' | 'r'>('r')
  const setVideoMode = useCallback((m: VideoMode) => {
    if (m === videoMode) return
    setModeDir(m === 'image' ? 'r' : 'l')
    const q = new URLSearchParams(window.location.search)
    q.set('mode', m)
    window.history.replaceState(null, '', `${window.location.pathname}?${q}`)
  }, [videoMode])

  const s = useStudio(workflow, initial, videoMode)
  const router = useRouter()
  // A refused start is shown in the stage itself; the banner is for everything else.
  const stageError = s.current ? null : s.startError
  useUnloadGuard()
  const [historyOpen, setHistoryOpen] = useState(false)

  // Remixing a clip that started from an image reopens Image to Video.
  const remix = useCallback((g: Generation) => {
    s.remix(g)
    if (workflow === 'video') setVideoMode(g.referenceUrl ? 'image' : 'text')
  }, [s, workflow, setVideoMode])

  const imageInUse = workflow === 'motion' || (workflow === 'video' && videoMode === 'image')
  const usersImage = imageInUse ? s.composer.referenceUrl ?? null : null
  const source = useLoadedImage(usersImage ?? DEMO_FRAME[workflow])
  const kind = workflow === 'image' ? 'image' : 'video'

  const allAssets = (
    <Link href="/assets" className="inline-flex items-center gap-1 text-xs font-medium text-ink-2 transition-colors hover:text-signal">
      View all assets <IconArrowRight size={13} />
    </Link>
  )

  return (
    <>
      {s.notice && !stageError && (
        <div role="alert" className="flex items-center justify-between gap-3 border-b border-danger/30 bg-danger/10 px-4 py-2">
          <p className="text-xs text-danger">{s.notice}</p>
          <button type="button" onClick={() => s.setNotice(null)} className="text-xs text-danger/80 hover:text-danger">Dismiss</button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="lg:hidden"><WorkflowTabs active={workflow} /></div>

        <section className="order-1 flex flex-col lg:order-2 lg:min-h-0 lg:flex-1">
          <Stage workflow={workflow} composer={s.composer} current={s.current} run={s.run}
            source={source} sourceIsUsers={Boolean(usersImage)}
            remixOf={s.remixOf} videoMode={videoMode} modeDir={modeDir}
            onRetry={s.retry} onRemix={remix} onReset={s.reset}
            onUsePrompt={(prompt) => s.setComposer({ ...s.composer, prompt })}
            onShowHistory={() => setHistoryOpen(true)} historyCount={s.history.length}
            startError={stageError} onDismissError={s.clearErrors}
            onConnectProvider={() => router.push('/byok')} />
        </section>

        <aside className="order-2 flex min-h-0 shrink-0 flex-col border-t border-line bg-ground
          lg:order-1 lg:w-[380px] lg:border-r lg:border-t-0">
          <div className="hidden lg:block"><WorkflowTabs active={workflow} /></div>
          <Composer workflow={workflow} catalog={s.catalog} state={s.composer} onChange={s.setComposer}
            onGenerate={s.generate} running={s.isRunning} fieldErrors={s.fieldErrors} source={source}
            videoMode={videoMode} onVideoMode={setVideoMode} modeDir={modeDir} />
        </aside>

        <aside className="order-3 hidden w-[320px] shrink-0 flex-col border-l border-line xl:flex">
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-4">
            <span className="eyebrow text-ink-2">History</span>
            <span className="tabular text-[11px] text-ink-3">{s.history.length}</span>
            <span className="ml-auto">{allAssets}</span>
          </div>
          <div className="min-h-0 flex-1">
            <HistoryRail items={s.history} currentId={s.current?.id ?? null} loading={s.booting} kind={kind}
              onOpen={s.open} onDelete={s.remove} />
          </div>
        </aside>
      </div>

      <Sheet open={historyOpen} onClose={() => setHistoryOpen(false)}
        title={`${workflow === 'image' ? 'Image' : workflow === 'motion' ? 'Camera Motion' : 'Video'} history · ${s.history.length}`}
        action={allAssets}>
        <HistoryRail compact items={s.history} currentId={s.current?.id ?? null} loading={s.booting} kind={kind}
          onOpen={(id) => { s.open(id); setHistoryOpen(false) }} onDelete={s.remove} />
      </Sheet>
    </>
  )
}
