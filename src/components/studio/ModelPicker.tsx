'use client'

import Link from 'next/link'
import { CATALOGUE_MODELS, KIND_LABEL, LIVE_MODELS, catalogueStatus, studioHrefFor, type CatalogModel } from '@/lib/catalog'
import { byokModelId, byokProvider } from '@/lib/byok/catalog'
import type { Catalog } from '@/lib/client/api'
import { useByok } from '@/lib/client/byok'
import { IconArrowRight, IconCheck } from '@/components/ui/icons'
import { Sheet, Tag } from '@/components/ui/primitives'

/**
 * Model picker. Three honest groups:
 *   Live in Slate       integrated; selectable when this deployment has it.
 *   Bring your own AI   a model on the user's own provider, once connected.
 *   Known models        discovery only, each a way into Bring your own AI.
 */
export function ModelPicker({
  open, onClose, kind, value, onChange, catalog, onConnect,
}: {
  open: boolean
  onClose: () => void
  kind: 'video' | 'image'
  value: string
  onChange: (id: string) => void
  catalog: Catalog | null
  /** Open the provider configuration (Bring your own AI). */
  onConnect?: () => void
}) {
  const live = LIVE_MODELS.filter((m) => m.kind === kind)
  const catalogue = CATALOGUE_MODELS.filter((m) => (kind === 'image' ? m.kind === 'image' : m.kind !== 'image'))
  const active = useByok()
  // Models on the connected provider that genuinely run this workflow, the one chosen first.
  const runnable = active
    ? active.models.filter((m) => m.runs[kind]).sort((a, b) => Number(b.id === active.model) - Number(a.id === active.model)).slice(0, 12)
    : []
  // A live model is only selectable when this deployment has it configured.
  const configured = (id: string) => catalog?.models.find((m) => m.id === id)?.available ?? false

  return (
    <Sheet open={open} onClose={onClose} title={kind === 'image' ? 'Image models' : 'Video models'} wide>
      <div className="p-5">
        <p className="eyebrow mb-3 text-ink-3">Live in Slate</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {live.map((m) => {
            if (m.workflow === 'motion') return (
              <Link key={m.id} href={studioHrefFor(m)} onClick={onClose}
                className="group rounded-card border border-line bg-ground p-4 text-left transition-colors duration-150 hover:border-line-strong">
                <span className="flex items-center gap-2">
                  <span className="font-display text-lg font-bold tracking-[-0.02em]">{m.name}</span>
                  <Tag tone="live" dot>Live</Tag>
                </span>
                <span className="mt-0.5 block text-xs text-ink-3">{m.maker} · its own workflow</span>
                <span className="mt-2.5 block text-[13px] leading-snug text-ink-2">{m.summary}</span>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-signal">
                  Open Camera Motion <IconArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            )
            const ok = configured(m.id)
            const on = m.id === value
            return (
              <button key={m.id} type="button" disabled={!ok}
                onClick={() => { onChange(m.id); onClose() }}
                aria-pressed={on}
                className={[
                  'group relative rounded-card border p-4 text-left transition-colors duration-150',
                  on ? 'border-signal bg-signal/[0.06]' : 'border-line bg-ground hover:border-line-strong',
                  !ok && 'cursor-not-allowed opacity-50',
                ].filter(Boolean).join(' ')}>
                <span className="flex items-center gap-2">
                  <span className="font-display text-lg font-bold tracking-[-0.02em]">{m.name}</span>
                  <Tag tone="live" dot>Live</Tag>
                  {on && <IconCheck size={16} className="ml-auto text-signal" />}
                </span>
                <span className="mt-0.5 block text-xs text-ink-3">{m.maker}</span>
                <span className="mt-2.5 block text-[13px] leading-snug text-ink-2">{m.summary}</span>
                {m.facts && (
                  <span className="tabular mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-3">
                    {m.facts.map((f) => <span key={f}>{f}</span>)}
                  </span>
                )}
                {!ok && <span className="mt-2 block text-[11px] text-danger">Not configured in this deployment</span>}
              </button>
            )
          })}
        </div>

        {onConnect && (
          <>
            <div className="mb-3 mt-7 flex flex-wrap items-baseline justify-between gap-2">
              <p className="eyebrow text-ink-3">Bring your own AI</p>
              <p className="text-[11px] text-ink-3">A compatible model on your own provider account. The key is never saved.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {active && runnable.map((m) => {
                const id = byokModelId(active.providerId, kind, m.id)
                const on = value === id
                return (
                  <button key={id} type="button" onClick={() => { onChange(id); onClose() }} aria-pressed={on}
                    className={`rounded-card border p-4 text-left transition-colors duration-150
                      ${on ? 'border-signal bg-signal/[0.06]' : 'border-line bg-ground hover:border-line-strong'}`}>
                    <span className="flex items-center gap-2">
                      <span className="truncate font-mono text-[13px] font-semibold">{m.id}</span>
                      <Tag tone="live" dot>Connected</Tag>
                      {on && <IconCheck size={16} className="ml-auto shrink-0 text-signal" />}
                    </span>
                    <span className="mt-1 block text-xs text-ink-3">Runs on your {byokProvider(active.providerId)!.label} account · key active in this tab</span>
                  </button>
                )
              })}
              {active && !runnable.length && (
                <p className="rounded-card border border-dashed border-line p-4 text-xs leading-relaxed text-ink-3">
                  Your {byokProvider(active.providerId)!.label} key is active, but none of its models can {kind === 'video' ? 'generate video' : 'generate images'} in Slate.
                </p>
              )}
              <button type="button" onClick={() => { onClose(); onConnect() }}
                className="group rounded-card border border-line bg-ground p-4 text-left transition-colors duration-150 hover:border-line-strong">
                <span className="block text-[14px] font-semibold">{active ? 'Connect a different provider' : 'Connect your provider'}</span>
                <span className="mt-1 block text-xs text-ink-3">Choose a provider, add your key, pick one of its models.</span>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-signal">
                  Configure <IconArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            </div>
          </>
        )}

        <div className="mb-3 mt-7 flex flex-wrap items-baseline justify-between gap-2">
          <p className="eyebrow text-ink-3">Known models</p>
          <p className="text-[11px] text-ink-3">Not integrated natively. Each opens Bring your own AI with that model in view.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {catalogue.map((m) => <CatalogueCard key={m.id} m={m} onNavigate={onClose} />)}
        </div>

        <p className="mt-6 text-xs text-ink-3">
          {kind === 'video'
            ? <>Making a still? <Link href="/studio/image" onClick={onClose} className="text-ink-2 underline underline-offset-2 hover:text-ink">Image workflow</Link></>
            : <>Making a clip? <Link href="/studio" onClick={onClose} className="text-ink-2 underline underline-offset-2 hover:text-ink">Video workflow</Link></>}
        </p>
      </div>
    </Sheet>
  )
}

/**
 * A known model, anywhere it is listed. Always a way into Bring your own AI
 * with that model's context, never a claim of native integration: a model
 * whose own provider has an adapter says "Configure with <provider>";
 * anything else says "Use with your own provider".
 */
export function CatalogueCard({ m, onNavigate }: { m: CatalogModel; onNavigate?: () => void }) {
  const direct = m.status === 'configurable' && Boolean(m.byok)
  return (
    <Link href={`/byok?model=${m.id}`} onClick={onNavigate}
      className="group flex flex-col rounded-card border border-line bg-ground p-3.5 transition-colors hover:border-line-strong">
      <span className="flex items-center gap-2">
        <span className="truncate text-[13px] font-semibold text-ink">{m.name}</span>
        <IconArrowRight size={13} className="ml-auto shrink-0 text-ink-4 transition-colors group-hover:text-signal" />
      </span>
      <span className="mt-0.5 text-[11px] text-ink-3">{m.maker} · {KIND_LABEL[m.kind]}</span>
      <span className="mt-2 text-xs leading-snug text-ink-3">{m.summary}</span>
      <span className={`mt-2.5 text-[11px] font-medium ${direct ? 'text-signal' : 'text-ink-2'}`}>{catalogueStatus(m)}</span>
    </Link>
  )
}
