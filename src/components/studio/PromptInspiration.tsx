'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { PROMPT_IDEAS, pickIdea } from '@/lib/inspiration'
import type { VideoMode } from '@/lib/client/useStudio'
import { Button } from '@/components/ui/primitives'
import { IconCheck, IconCopy, IconRefresh } from '@/components/ui/icons'

const N = PROMPT_IDEAS.length
const LAST_KEY = 'slate_idea_last'
const pad = (n: number) => String(n).padStart(2, '0')

function readLast(): number | null {
  try {
    const raw = localStorage.getItem(LAST_KEY)
    const n = raw === null ? NaN : Number(raw)
    return Number.isInteger(n) && n >= 0 && n < N ? n : null
  } catch { return null }
}
function remember(i: number) {
  try { localStorage.setItem(LAST_KEY, String(i)) } catch { /* private mode: just no memory */ }
}

// Chosen once per page load, on the client only (the server has no idea to
// match, so a random pick during render would not hydrate). It avoids the idea
// shown last time, so a refresh always changes it.
let firstIdea: number | null = null
const initialIdea = () => {
  if (firstIdea === null) {
    firstIdea = pickIdea(readLast())
    remember(firstIdea)
  }
  return firstIdea
}
const subscribeNever = () => () => {}

type Copied = null | 'copied' | 'added'

/**
 * The Video workflow's empty stage: one hand-written prompt showing what a
 * generative video model can make. It is an idea, not an output, and never
 * shows media. Copy puts the exact text on the clipboard and in the composer.
 */
export function PromptInspiration({
  mode, image, onUse,
}: {
  mode: VideoMode
  /** The user's own image in Image to Video, shown as the first frame. */
  image: string | null
  onUse: (prompt: string) => void
}) {
  const initial = useSyncExternalStore(subscribeNever, initialIdea, () => null)
  const [picked, setPicked] = useState<number | null>(null)
  const index = picked ?? initial
  const idea = index === null ? null : PROMPT_IDEAS[index]
  const [copied, setCopied] = useState<Copied>(null)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(null), 2600)
    return () => clearTimeout(t)
  }, [copied])

  const next = () => {
    const i = pickIdea(index)
    remember(i)
    setPicked(i)
    setCopied(null)
  }

  const copy = async () => {
    if (!idea) return
    let onClipboard = false
    try {
      await navigator.clipboard.writeText(idea.prompt)
      onClipboard = true
    } catch { /* clipboard refused (permissions, insecure context): still fill the prompt */ }
    onUse(idea.prompt)
    setCopied(onClipboard ? 'copied' : 'added')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 overflow-y-auto">
        <div className="m-auto w-full max-w-[44rem] px-5 py-7 sm:px-10 sm:py-10 lg:py-14">
          {mode === 'image' && (
            <div className="mb-9 flex items-center gap-3">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="Your image" className="h-14 w-20 shrink-0 rounded-[4px] border border-line object-cover" />
              ) : (
                <span className="h-14 w-20 shrink-0 rounded-[4px] border border-dashed border-line-strong" />
              )}
              <p className="text-xs leading-relaxed text-ink-3">
                {image ? 'Your image is the first frame. Describe what happens next.' : 'Add your image in the composer; it becomes the first frame.'}
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <span className="eyebrow text-ink-2">Prompt idea</span>
            <span className="h-px w-6 bg-line-strong" />
            <span className="eyebrow text-ink-4">{idea?.category ?? ' '}</span>
            {index !== null && <span className="tabular ml-auto text-[11px] text-ink-4">{pad(index + 1)} / {pad(N)}</span>}
          </div>

          <blockquote key={index ?? 'none'} className="idea-in mt-5 min-h-[9.5rem] border-l border-signal/70 pl-5 sm:mt-6 sm:pl-6">
            {idea && (
              <p className="text-[clamp(1.05rem,1.55vw,1.35rem)] leading-[1.6] text-ink [text-wrap:pretty]">{idea.prompt}</p>
            )}
          </blockquote>

          <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
            {mode === 'image' ? 'Image to Video' : 'Text to Video'}
            {idea && <> · {idea.durationS}s · {idea.aspectRatio}</>}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2 sm:mt-7">
            <Button variant="secondary" size="md" onClick={copy} disabled={!idea}>
              {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
              {copied ? 'Copied' : 'Copy prompt'}
            </Button>
            <Button variant="ghost" size="md" onClick={next} disabled={!idea}>
              <IconRefresh size={15} /> New idea
            </Button>
            <span role="status" aria-live="polite"
              className={`text-xs text-ink-3 transition-opacity duration-300 ${copied ? 'opacity-100' : 'opacity-0'}`}>
              {copied === 'added' ? 'Added to your prompt' : 'Copied, and added to your prompt'}
            </span>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-line px-4 py-3 sm:px-5">
        <ol className="flex flex-wrap gap-x-5 gap-y-1.5">
          {['Generative video: the scene itself moves', 'From a prompt, or from your own image', '4, 6 or 8 seconds, saved as MP4'].map((f, i) => (
            <li key={f} className="flex items-center gap-2 text-xs text-ink-2">
              <span className="tabular text-[10px] text-signal">{pad(i + 1)}</span>{f}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
