'use client'

import Link from 'next/link'
import { ByokConfigForm, type ByokTarget } from '@/components/byok/ByokConfigForm'
import { Drawer } from '@/components/ui/primitives'

/**
 * The configuration form in a side drawer, for connecting a provider without
 * leaving Studio. Non-modal: the rest of Studio stays scrollable and usable
 * while it is open. What is being configured (the target, the provider
 * chosen) is kept by the caller and the draft store, so closing and
 * reopening resumes rather than resets. A key typed but not saved is
 * dropped on close.
 */
export function AiConfigSheet({
  open, onClose, target, onUse,
}: {
  open: boolean
  onClose: () => void
  target?: ByokTarget
  onUse: (modelId: string) => void
}) {
  return (
    <Drawer open={open} onClose={onClose} title="Bring your own AI">
      <div className="flex flex-col gap-5 p-5">
        <p className="text-[11px] leading-relaxed text-ink-3">
          Your key stays in this browser tab, is sent only when you test or generate, and is never saved.
          Reloading or signing out removes it.{' '}
          <Link href={target?.knownId ? `/byok?model=${target.knownId}` : '/byok'} className="text-ink-2 underline underline-offset-2 hover:text-ink">
            Known models and how it works
          </Link>
        </p>
        <ByokConfigForm target={target} onSaved={(id) => { onUse(id); onClose() }} />
      </div>
    </Drawer>
  )
}
