'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo } from 'react'
import { BYOK_PROVIDERS, NOT_OFFERED_NOTE, byokKind, providerSummary } from '@/lib/byok/catalog'
import { CATALOGUE_MODELS, KIND_LABEL, LIVE_MODELS, catalogueModel, catalogueStatus } from '@/lib/catalog'
import { useAuth } from '@/lib/client/auth'
import { ByokConfigForm } from '@/components/byok/ByokConfigForm'
import { buttonClass } from '@/components/ui/button'
import { IconArrowRight, IconArrowUpRight } from '@/components/ui/icons'

const HOW = [
  { n: '01', t: 'Connect provider', d: 'Choose a supported provider and paste your API key. Slate checks it with one free listing call.' },
  { n: '02', t: 'Verify model', d: 'Models come from your provider’s own listing for that key. Nothing is assumed.' },
  { n: '03', t: 'Choose capability', d: 'Each model shows what it can actually do. Only models that can generate images or video can be used.' },
  { n: '04', t: 'Generate', d: 'Create Video or Create Image sends the request to your provider, on your account. Slate validates and saves the result.' },
]

const KEY_RULES = [
  'Held only in this browser tab’s memory. Never in storage, cookies or the address bar.',
  'Sent over HTTPS only with a connection test, a generation or a video status check, and used for that request alone.',
  'Never saved to Slate, your History, your Assets or any log. Only the provider’s job id is kept while a video renders.',
  'Gone when you reload the page or sign out. Another account never sees it.',
  'Generations are billed by your provider to your account. Slate never retries a billable request on its own.',
]

/**
 * Bring your own AI: what it is, the configuration workspace, what works in
 * this build, how the key is handled, and the known models as a way in.
 * Everything listed comes from the provider registry; nothing is shown as
 * working that Slate cannot actually run.
 */
export function ByokPage() {
  const auth = useAuth()
  const router = useRouter()
  const params = useSearchParams()
  const known = catalogueModel(params?.get('model') ?? '')
  // The known model the user chose is the configuration's target, not a heading.
  const target = useMemo(() => (known ? { knownId: known.id } : undefined), [known])

  // Client-side navigation keeps the in-memory key; a full load would drop it.
  const use = (modelId: string) => {
    const where = byokKind(modelId) === 'image' ? '/studio/image' : '/studio'
    router.push(`${where}?model=${encodeURIComponent(modelId)}`)
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-28 pt-12 sm:px-6 lg:px-10 lg:pt-16">
      <header className="grid gap-8 border-b border-line pb-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-end">
        <div>
          <p className="eyebrow text-signal">Your model. Your provider. Your generation.</p>
          <h1 className="display display-l mt-4">
            <span className="whitespace-nowrap">Bring your</span><br />
            <span className="serif-accent">own AI</span>
          </h1>
        </div>
        <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-ink-2">
          <p>Use the models you already have. Connect your provider, choose a model, and create inside Slate.</p>
          <p className="text-ink-3">
            Requests go to your provider, on your account. Slate’s own models ({LIVE_MODELS.map((m) => m.name).join(', ')}) stay separate and are never used in their place.
          </p>
        </div>
      </header>

      <section aria-labelledby="how" className="border-b border-line py-10">
        <h2 id="how" className="eyebrow text-ink-3">How it works</h2>
        <ol className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {HOW.map((h) => (
            <li key={h.n} className="border-t border-line pt-4">
              <span className="tabular text-[11px] text-signal">{h.n}</span>
              <p className="mt-2 text-[15px] font-semibold">{h.t}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">{h.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <div id="configure" className="mt-12 grid scroll-mt-24 gap-10 lg:grid-cols-[minmax(0,36rem)_minmax(0,1fr)] lg:gap-16">
        {/* Configuration workspace */}
        <section aria-label="Configuration" className="rounded-[6px] border border-line bg-surface">
          <div className="border-b border-line px-5 py-4 sm:px-6">
            <p className="text-sm font-semibold">{known ? `Configure ${known.name}` : 'Configure a provider'}</p>
            <p className="mt-1 text-[12px] text-ink-3">
              {known ? 'Choose a provider that can serve it, add your key and test the connection. Slate then checks whether your account offers it.'
                : 'Choose a provider, add your key, test the connection, then pick one of its models.'}
            </p>
          </div>
          <div className="p-5 sm:p-6">
            {auth.status === 'guest' ? (
              <div>
                <p className="text-[13px] leading-relaxed text-ink-2">Sign in to connect a provider. A configuration belongs to your account and this browser session only.</p>
                <Link href={`/sign-in?next=${encodeURIComponent(`/byok${known ? `?model=${known.id}` : ''}`)}`}
                  className={buttonClass('primary', 'md', 'mt-4')}>Sign in <IconArrowRight size={14} /></Link>
              </div>
            ) : (
              <ByokConfigForm target={target} onSaved={use}
                onClearTarget={() => router.replace('/byok', { scroll: false })} />
            )}
          </div>
        </section>

        <div className="flex flex-col gap-10">
          <section aria-labelledby="works">
            <h2 id="works" className="eyebrow text-ink-3">Providers in this build</h2>
            <ul className="mt-4 flex flex-col divide-y divide-line border-y border-line">
              {BYOK_PROVIDERS.map((p) => (
                <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                  <span className="text-[14px] font-semibold text-ink">{p.label}</span>
                  <span className={`text-right text-[12px] ${p.operations.length ? 'text-ink-2' : 'text-ink-3'}`}>{providerSummary(p)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-4">
              Every provider listed has a real adapter in Slate. Models always come from your provider’s own listing. {NOT_OFFERED_NOTE}
            </p>
          </section>

          <section aria-labelledby="key">
            <h2 id="key" className="eyebrow text-ink-3">How your key is handled</h2>
            <ol className="mt-4 flex flex-col divide-y divide-line border-y border-line">
              {KEY_RULES.map((r, i) => (
                <li key={r} className="flex gap-4 py-3 text-[13px] leading-relaxed text-ink-2">
                  <span className="tabular text-[11px] text-signal">{String(i + 1).padStart(2, '0')}</span>{r}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      {/* Known models: a way in, never a claim of native integration. */}
      <section aria-labelledby="known" className="mt-20 border-t border-line pt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-ink-3">Slate’s catalogue</p>
            <h2 id="known" className="display display-s mt-3">Known models</h2>
          </div>
          <p className="max-w-md text-[13px] leading-relaxed text-ink-3">
            Models Slate knows about. None are integrated natively. Choose one to make it the target: Slate then checks which of your provider’s models match it. Provider models are the ones your key discovers above.
          </p>
        </div>
        <ul className="mt-8 grid grid-cols-1 gap-x-8 border-t border-line sm:grid-cols-2 lg:grid-cols-3">
          {CATALOGUE_MODELS.map((m) => {
            const on = known?.id === m.id
            const direct = m.status === 'configurable'
            return (
              <li key={m.id} className="border-b border-line">
                <Link href={`/byok?model=${m.id}#configure`} scroll={false} aria-current={on ? 'true' : undefined}
                  onClick={() => document.getElementById('configure')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className={`group flex items-center gap-3 py-3.5 transition-colors ${on ? 'text-signal' : ''}`}>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[14px] ${on ? 'text-signal' : 'text-ink'}`}>{m.name}</span>
                    <span className="block truncate text-[11px] text-ink-3">{m.maker} · {KIND_LABEL[m.kind]}</span>
                  </span>
                  <span className={`shrink-0 text-[11px] ${direct ? 'text-signal' : 'text-ink-3'} group-hover:text-ink`}>{catalogueStatus(m)}</span>
                  <IconArrowUpRight size={13} className="shrink-0 text-ink-4 transition-colors group-hover:text-signal" />
                </Link>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
