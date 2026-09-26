'use client'

import { useRef, useState, type ReactNode, type SelectHTMLAttributes } from 'react'
import {
  ALL_CAPABILITIES, BYOK_PROVIDERS, CAPABILITY_LABEL, byokModelId, byokProvider, providerSummary,
  type ByokProviderId, type DiscoveredModel, type Operation,
} from '@/lib/byok/catalog'
import { KIND_LABEL, catalogueModel, matchesKnownModel, operationFor, providersFor } from '@/lib/catalog'
import { testByok, ApiError } from '@/lib/client/api'
import { useAuth } from '@/lib/client/auth'
import { byokDraft, byokStore, useByok } from '@/lib/client/byok'
import { Button } from '@/components/ui/primitives'
import { IconChevronDown, IconClose } from '@/components/ui/icons'

/** The connection test, as its own fact. Discovered models belong to the key that found them. */
type Test =
  | { state: 'idle' }
  | { state: 'testing' }
  | { state: 'connected'; models: DiscoveredModel[] }
  | { state: 'auth_failed'; message: string }
  | { state: 'failed'; message: string }

/**
 * What is being configured. Every field is real user intent and survives
 * provider changes, connection tests and closing the form.
 */
export interface ByokTarget {
  /** A model from Slate's known-model catalogue: the thing the user wants to run. */
  knownId?: string
  /** The workflow asking (Studio): only models that run it can be saved. */
  op?: Operation
  /** Reconnecting a stored model: its provider and the provider's model id. */
  providerId?: ByokProviderId
  providerModel?: string
}

type Choice = { op: Operation | 'none'; id: string }
const encode = (c: Choice) => `${c.op}|${c.id}`
const decode = (v: string): Choice | null => {
  const i = v.indexOf('|')
  return i < 0 ? null : { op: v.slice(0, i) as Choice['op'], id: v.slice(i + 1) }
}

/** Who can serve a known model, stated without overclaiming the gateway. */
function servedBy(providers: ByokProviderId[]): string {
  const direct = providers.filter((id) => id !== 'openrouter').map((id) => byokProvider(id)!.label)
  const gateway = providers.includes('openrouter')
  if (!direct.length) return 'Served through OpenRouter, if your OpenRouter account lists it.'
  return `Served by ${direct.join(' or ')}${gateway ? ', or through OpenRouter if your account lists it' : ''}.`
}

const OP_LABEL: Record<Operation, string> = { video: 'Create Video', image: 'Create Image' }
const OP_VERB: Record<Operation, string> = { video: 'generate video', image: 'generate images' }

/**
 * Target model → Provider → API key → Test connection → Provider models →
 * Compatibility → Save and use.
 *
 * A known model the user chose stays the target throughout: the providers
 * offered are only those that could genuinely serve it, and after discovery
 * it is reconciled against the models the key actually returned (supported,
 * listed but not runnable, or unavailable). It is never swapped for another
 * model. Known models (Slate's catalogue) and provider models (what this key
 * discovered) are kept separate everywhere.
 *
 * The typed key lives in a ref and an uncontrolled input (never React state
 * or a DOM attribute) until saved, then only in the tab's memory store.
 */
export function ByokConfigForm({ target, onSaved, onClearTarget }: {
  target?: ByokTarget
  onSaved: (modelId: string) => void
  /** Drop the known-model target to configure any model instead. */
  onClearTarget?: () => void
}) {
  const auth = useAuth()
  const active = useByok()
  const known = target?.knownId ? catalogueModel(target.knownId) : undefined
  const op: Operation | null = target?.op ?? (known ? operationFor(known) : null)
  const serving = known ? providersFor(known) : null
  const eligible = (id: ByokProviderId): boolean => {
    if (target?.providerId) return id === target.providerId
    if (serving) return serving.providers.includes(id)
    if (op) return byokProvider(id)!.operations.includes(op)
    return true
  }
  const ineligibleNote = (): string =>
    known ? ` · cannot serve ${known.name}` : op ? ` · no ${op} in Slate` : ''

  const pickInitial = (): ByokProviderId | '' => {
    const candidates = [target?.providerId, byokDraft.providerId, active?.providerId].filter(Boolean) as ByokProviderId[]
    const hit = candidates.find(eligible)
    if (hit) return hit
    const only = BYOK_PROVIDERS.filter((p) => eligible(p.id))
    return only.length === 1 ? only[0].id : ''
  }

  const [providerId, setProviderIdState] = useState<ByokProviderId | ''>(pickInitial)
  const [hasKey, setHasKey] = useState(false)
  const [test, setTest] = useState<Test>({ state: 'idle' })
  const [picked, setPicked] = useState<Choice | null>(null)
  // A target change (another known model) keeps the provider, key and discovered
  // models when that provider can serve the new target; otherwise starts that part over.
  const [seenTarget, setSeenTarget] = useState(target?.knownId)
  if (seenTarget !== target?.knownId) {
    setSeenTarget(target?.knownId)
    setPicked(null)
    if (!providerId || !eligible(providerId)) {
      setProviderIdState(pickInitial())
      setHasKey(false) // the key input remounts empty with the new provider
      setTest({ state: 'idle' })
    }
  }
  const setProviderId = (id: ByokProviderId | '') => {
    byokDraft.providerId = id || null
    setProviderIdState(id)
  }

  const keyRef = useRef('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [reveal, setReveal] = useState(false)
  const provider = providerId ? byokProvider(providerId)! : null
  const activeHere = active && active.providerId === providerId ? active : null

  // Provider models: from this test, or from the key already active in this tab.
  const discovered: DiscoveredModel[] | null =
    test.state === 'connected' ? test.models : activeHere && !hasKey && test.state === 'idle' ? activeHere.models : null

  // Reconcile the target against what the key actually returned.
  const matched = discovered && known ? discovered.filter((m) => matchesKnownModel(known, m.id)) : []
  const exact = discovered && target?.providerModel ? discovered.filter((m) => m.id === target.providerModel) : []
  const targeted = known ? matched : target?.providerModel ? exact : null
  const runnable = (m: DiscoveredModel) => (op ? Boolean(m.runs[op]) : Boolean(m.runs.video || m.runs.image))
  const compatible = discovered ? (targeted ?? discovered).filter(runnable) : []
  const noProvider = Boolean(serving && !serving.providers.length)
  const compat: 'pending' | 'supported' | 'not_runnable' | 'unavailable' | null =
    noProvider || (!targeted && !target?.providerModel && !known) ? null
      : !discovered ? 'pending'
        : compatible.length ? 'supported'
          : targeted?.length ? 'not_runnable' : 'unavailable'

  // What can be chosen: the target's own matches when there is a target, else everything discovered.
  const video = discovered ? (targeted ?? discovered).filter((m) => m.runs.video && (!op || op === 'video')) : []
  const image = discovered ? (targeted ?? discovered).filter((m) => m.runs.image && (!op || op === 'image')) : []
  const other = discovered && !targeted ? discovered.filter((m) => !video.includes(m) && !image.includes(m)) : []
  const firstChoice = (): Choice | null => {
    const byPrefer = known?.byok?.prefer
    const pool: Choice[] = [
      ...video.map((m) => ({ op: 'video' as const, id: m.id })),
      ...image.map((m) => ({ op: 'image' as const, id: m.id })),
    ]
    const current = activeHere?.model
    return pool.find((c) => c.id === target?.providerModel)
      ?? pool.find((c) => byPrefer?.test(c.id))
      ?? pool.find((c) => c.id === current)
      ?? pool[0]
      ?? (other[0] ? { op: 'none', id: other[0].id } : null)
  }
  const choice = picked && discovered?.some((m) => m.id === picked.id) ? picked : firstChoice()
  const selected = choice ? discovered?.find((m) => m.id === choice.id) ?? null : null
  const usable = Boolean(choice && choice.op !== 'none' && (!op || choice.op === op))
  const canSave = Boolean(discovered && usable && (hasKey ? test.state === 'connected' : activeHere))

  const forgetKey = () => {
    keyRef.current = ''
    if (inputRef.current) inputRef.current.value = ''
    setHasKey(false)
  }

  const chooseProvider = (id: string) => {
    const p = byokProvider(id)
    if (!p || !eligible(p.id)) return
    setProviderId(p.id)
    forgetKey()
    setTest({ state: 'idle' })
    setPicked(null)
  }

  const runTest = async () => {
    const apiKey = keyRef.current.trim()
    if (!providerId || !apiKey || test.state === 'testing') return
    setTest({ state: 'testing' })
    setPicked(null)
    try {
      const r = await testByok({ credential: { providerId, apiKey } })
      if (!r.connected) {
        setTest(r.error.code === 'byok_auth_failed' ? { state: 'auth_failed', message: r.error.message } : { state: 'failed', message: r.error.message })
        return
      }
      setTest({ state: 'connected', models: r.models })
    } catch (e) {
      // Validation messages or our own session expiring. Never the key.
      setTest({ state: 'failed', message: e instanceof ApiError ? (Object.values(e.fields ?? {})[0] ?? e.message) : 'The connection test could not run.' })
    }
  }

  const save = () => {
    if (!providerId || !discovered || !choice || choice.op === 'none' || !canSave || !auth.user) return
    if (hasKey) {
      byokStore.activate({ userId: auth.user.id, providerId, model: choice.id, models: discovered }, keyRef.current.trim())
      forgetKey()
    } else {
      byokStore.useModel(choice.id)
    }
    onSaved(byokModelId(providerId, choice.op, choice.id))
  }

  if (auth.status === 'loading') return <div className="h-40" />

  const n = (i: number) => String(i + (known ? 1 : 0)).padStart(2, '0')
  const modelCount = discovered?.length ?? 0

  return (
    <div className="flex flex-col">
      {known && (
        <Step n="01" label="Target model" htmlFor="byok-provider">
          <div data-testid="byok-target" className="flex items-start justify-between gap-3 rounded-card border border-signal/40 bg-signal/[0.05] px-3 py-3">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-ink">{known.name}</p>
              <p className="mt-0.5 text-[11px] text-ink-3">{known.maker} · {KIND_LABEL[known.kind]}{op ? ` · runs in ${OP_LABEL[op]}` : ''}</p>
              <p className="mt-2 text-[11px] leading-relaxed text-ink-2">
                {noProvider ? serving!.reason : servedBy(serving!.providers)}
              </p>
            </div>
            {onClearTarget && (
              <button type="button" onClick={onClearTarget} aria-label={`Clear target ${known.name}`}
                className="shrink-0 rounded p-1 text-ink-3 hover:bg-surface-2 hover:text-ink">
                <IconClose size={14} />
              </button>
            )}
          </div>
        </Step>
      )}

      <Step n={n(1)} label="Provider" htmlFor="byok-provider" muted={noProvider}
        hint={target?.providerId ? 'Fixed: the provider this model runs on' : undefined}>
        <Select id="byok-provider" value={providerId} onChange={(e) => chooseProvider(e.target.value)}
          disabled={noProvider || Boolean(target?.providerId)}>
          {!providerId && <option value="" disabled>{noProvider ? 'No provider can run this model in Slate' : 'Select provider'}</option>}
          {BYOK_PROVIDERS.map((p) => (
            <option key={p.id} value={p.id} disabled={!eligible(p.id)}>
              {p.label}{eligible(p.id) ? '' : ineligibleNote()}
            </option>
          ))}
        </Select>
        {provider && <p className="config-in mt-2 text-[11px] text-ink-3">{providerSummary(provider)}</p>}
      </Step>

      <Step n={n(2)} label="API key" htmlFor="byok-key" hint={provider?.keyHelp} muted={!provider}>
        {activeHere && !hasKey ? (
          <div className="flex items-center gap-2 rounded-card border border-line bg-ground px-3 py-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-live" />
            <span className="text-[13px] text-ink-2">Key active in this tab</span>
            <span className="font-mono text-[12px] tracking-[0.2em] text-ink-4">••••••••</span>
            <button type="button" onClick={() => { byokStore.clear(); setTest({ state: 'idle' }); setPicked(null) }}
              className="ml-auto text-[11px] text-ink-3 underline underline-offset-2 hover:text-danger">Remove</button>
          </div>
        ) : (
          <div className={`flex items-center rounded-card border border-line bg-ground transition-colors focus-within:border-ink-4 ${provider ? '' : 'opacity-50'}`}>
            <input key={providerId || 'none'} id="byok-key" ref={inputRef} type={reveal ? 'text' : 'password'} defaultValue="" disabled={!provider}
              onChange={(e) => {
                keyRef.current = e.target.value
                setHasKey(e.target.value.trim().length > 0)
                if (test.state !== 'idle') { setTest({ state: 'idle' }); setPicked(null) }
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') void runTest() }}
              autoComplete="off" spellCheck={false} autoCapitalize="off" data-1p-ignore data-lpignore="true"
              placeholder={provider ? 'Paste your key' : 'Select a provider first'}
              className="min-w-0 flex-1 bg-transparent px-3 py-2.5 font-mono text-[13px] text-ink placeholder:font-sans placeholder:text-ink-4 focus:outline-none" />
            <button type="button" onClick={() => setReveal((r) => !r)} aria-pressed={reveal} disabled={!provider}
              className="px-3 text-[11px] text-ink-3 hover:text-ink disabled:opacity-50">{reveal ? 'Hide' : 'Show'}</button>
          </div>
        )}
        {provider && (
          <p className="mt-2 text-[11px] text-ink-4">
            Create one at <span className="font-mono text-ink-3">{provider.keyUrl.replace('https://', '')}</span>
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="md" onClick={runTest} disabled={!provider || !hasKey || test.state === 'testing'}>
            {test.state === 'testing' ? 'Testing…' : 'Test connection'}
          </Button>
          <span role="status" aria-live="polite" data-testid="byok-status" className="min-w-0 text-xs">
            {test.state === 'connected' && (
              <span className="config-in inline-flex items-center gap-1.5 text-live">
                <span className="h-1.5 w-1.5 rounded-full bg-live" /> Key accepted
              </span>
            )}
            {test.state === 'auth_failed' && (
              <Failure title="Key rejected.">{test.message} Check it was copied in full and belongs to {provider?.label}.</Failure>
            )}
            {test.state === 'failed' && <Failure title="Connection failed.">{test.message}</Failure>}
          </span>
        </div>
      </Step>

      <Step n={n(3)} label="Provider models" htmlFor="byok-model" muted={!discovered}
        hint={discovered ? `from your ${provider!.label} account` : undefined}>
        <p data-testid="byok-discovery" className="mb-2.5 text-[12px] text-ink-2">
          {noProvider ? `No provider can run ${known!.name} in Slate, so there is nothing to discover.`
            : !discovered ? 'No provider models discovered yet.'
            : !compatible.length && !(targeted?.length) && !known ? 'No compatible models found.'
              : `${modelCount} ${modelCount === 1 ? 'model' : 'models'} found${compatible.length ? ` · ${compatible.length} ${known ? `matching ${known.name}` : 'usable in Slate'}` : ''}.`}
          {!discovered && !noProvider && <span className="text-ink-4"> Test the connection to list the models this key can reach.</span>}
        </p>

        {compat && (
          <Compatibility state={compat} name={known?.name ?? target?.providerModel ?? ''} provider={provider?.label ?? 'this provider'}
            op={op} ids={(compatible.length ? compatible : targeted ?? []).map((m) => m.id)} />
        )}

        <Select id="byok-model" value={choice ? encode(choice) : ''} onChange={(e) => setPicked(decode(e.target.value))}
          disabled={!discovered || !(video.length + image.length + other.length)} mono>
          {discovered && video.length + image.length + other.length > 0 ? (
            <>
              {video.length > 0 && (
                <optgroup label="Video · runs in Create Video">
                  {video.map((m) => <option key={`v${m.id}`} value={encode({ op: 'video', id: m.id })}>{m.id}</option>)}
                </optgroup>
              )}
              {image.length > 0 && (
                <optgroup label="Image · runs in Create Image">
                  {image.map((m) => <option key={`i${m.id}`} value={encode({ op: 'image', id: m.id })}>{m.id}</option>)}
                </optgroup>
              )}
              {other.length > 0 && (
                <optgroup label="Other · not usable in Slate">
                  {other.map((m) => <option key={`o${m.id}`} value={encode({ op: 'none', id: m.id })}>{m.id}</option>)}
                </optgroup>
              )}
            </>
          ) : (
            <option value="">
              {!discovered ? 'Discovered models appear after the connection test'
                : known ? `${known.name} is not available from ${provider!.label}` : 'No compatible models found'}
            </option>
          )}
        </Select>
        {selected && choice && <Detected model={selected} op={choice.op} wanted={op ?? undefined} />}
      </Step>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-5">
        {discovered && !usable && (
          <span className="text-[11px] text-ink-3">
            {known && !compatible.length ? `${known.name} stays selected. Try another provider, or clear the target to use a different model.`
              : choice?.op === 'none' ? 'This model cannot run in Slate’s image or video workflows.'
                : op ? `Choose a model that runs in ${OP_LABEL[op]}.` : ''}
          </span>
        )}
        <Button variant="primary" size="md" onClick={save} disabled={!canSave}>
          Save and use
        </Button>
      </div>
    </div>
  )
}

/** The target model against what the provider actually returned. Never a substitute. */
function Compatibility({ state, name, provider, op, ids }: {
  state: 'pending' | 'supported' | 'not_runnable' | 'unavailable'; name: string; provider: string; op: Operation | null; ids: string[]
}) {
  const tone = state === 'supported' ? 'border-live/40 text-live' : state === 'pending' ? 'border-line text-ink-3' : 'border-danger/40 text-danger'
  const title = { pending: 'Not checked yet', supported: 'Supported', not_runnable: 'Listed, not runnable', unavailable: 'Unsupported' }[state]
  return (
    <div data-testid="byok-compat" data-state={state} className={`mb-3 rounded-card border bg-ground px-3 py-2.5 ${tone}`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.12em]">Compatibility · {title}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-ink-2">
        {state === 'pending' && <>After the connection test, Slate checks whether {provider} offers {name} to this key.</>}
        {state === 'supported' && <>{provider} offers {name} as <span className="font-mono text-ink">{ids.join(', ')}</span>.</>}
        {state === 'not_runnable' && <>{provider} lists <span className="font-mono text-ink">{ids.join(', ')}</span>, but Slate’s adapter cannot {op ? OP_VERB[op] : 'generate'} with it.</>}
        {state === 'unavailable' && <>This {provider} key does not list {name}. Nothing else has been selected in its place.</>}
      </p>
    </div>
  )
}

/** What the provider reports this model can do, and what Slate can run with it. */
function Detected({ model, op, wanted }: { model: DiscoveredModel; op: Operation | 'none'; wanted?: Operation }) {
  const v = model.runs.video
  const im = model.runs.image
  return (
    <div className="config-in mt-3 rounded-card border border-line bg-ground px-3 py-3" data-testid="byok-capabilities">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">Detected capabilities</p>
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        {ALL_CAPABILITIES.map((c) => {
          const on = model.capabilities.includes(c)
          return (
            <li key={c} className={on ? 'text-ink-2' : 'text-ink-4'}>
              <span aria-hidden className={`inline-block w-4 ${on ? 'text-live' : ''}`}>{on ? '✓' : '—'}</span>
              <span className="sr-only">{on ? 'Supported: ' : 'Not supported: '}</span>{CAPABILITY_LABEL[c]}
            </li>
          )
        })}
      </ul>
      <p className="mt-3 border-t border-line pt-2 text-[11px] leading-relaxed text-ink-3">
        {op === 'video' && v ? (
          <>Runs in Create Video · {v.durations.map((d) => `${d}s`).join(', ')} · {v.aspectRatios.join(', ')} · {v.imageToVideo ? 'first frame supported' : 'text to video only'}</>
        ) : op === 'image' && im ? (
          <>Runs in Create Image · {im.aspectRatios.length ? im.aspectRatios.join(', ') : 'aspect set by the model'} · {im.output}{im.quality ? ' · quality tiers' : ''}</>
        ) : (
          <>Not usable in Slate: it cannot {wanted ? OP_VERB[wanted] : 'generate images or video'} through Slate’s adapter.</>
        )}
      </p>
    </div>
  )
}

function Failure({ title, children }: { title: string; children: ReactNode }) {
  return (
    <span className="config-in inline-flex items-start gap-1.5 text-danger">
      <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full border border-danger" />
      <span><strong className="font-semibold">{title}</strong> {children}</span>
    </span>
  )
}

function Step({ n, label, htmlFor, hint, muted = false, children }: {
  n: string; label: string; htmlFor: string; hint?: string; muted?: boolean; children: ReactNode
}) {
  return (
    <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 border-t border-line py-5 first:border-t-0 first:pt-0">
      <span className={`tabular pt-[3px] text-[11px] transition-colors ${muted ? 'text-ink-4' : 'text-signal'}`}>{n}</span>
      <div className="min-w-0">
        <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <label htmlFor={htmlFor} className={`font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${muted ? 'text-ink-4' : 'text-ink-2'}`}>{label}</label>
          {hint && <span className="text-[11px] text-ink-4">{hint}</span>}
        </div>
        {children}
      </div>
    </div>
  )
}

/** A native select (keyboard, screen readers, mobile pickers) dressed in Slate's style. */
function Select({ mono = false, className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { mono?: boolean }) {
  return (
    <div className="relative">
      <select {...props}
        className={`w-full appearance-none rounded-card border border-line bg-ground py-2.5 pl-3 pr-9 text-[13px] text-ink transition-colors
          hover:border-line-strong focus:border-ink-4 focus:outline-none disabled:cursor-not-allowed disabled:text-ink-3 disabled:hover:border-line
          ${mono ? 'font-mono' : 'font-medium'} ${className}`}>
        {children}
      </select>
      <IconChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-3" />
    </div>
  )
}
