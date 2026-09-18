'use client'

import { useMemo, useState } from 'react'
import type { ReadonlyURLSearchParams } from 'next/navigation'
import { composerFromParams, useStudio } from '@/lib/client/useStudio'
import { Composer } from './Composer'
import { HistoryRail } from './HistoryRail'
import { Stage } from './Stage'

export function CreateVideo({ params }: { params: ReadonlyURLSearchParams | null }) {
  // Read once on mount: later renders must not overwrite user edits.
  const initial = useMemo(
    () => composerFromParams(params ? new URLSearchParams(params.toString()) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const s = useStudio(initial)
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <>
      {s.notice && (
        <div className="flex items-center justify-between gap-3 border-b border-danger/30 bg-danger/10 px-4 py-2">
          <p className="text-xs text-danger">{s.notice}</p>
          <button type="button" onClick={() => s.setNotice(null)} className="text-xs text-danger/70 hover:text-danger">
            Dismiss
          </button>
        </div>
      )}

      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="order-1 flex min-h-[52vh] flex-1 flex-col lg:order-2 lg:min-h-0">
          {/* Below lg the history lives in a sheet, opened from here. A fixed
              pill would sit on top of the full-width Generate action. */}
          <div className="flex shrink-0 items-center justify-between border-b border-line px-3 py-2 lg:hidden">
            <span className="text-[11px] uppercase tracking-[0.09em] text-ink-4">Stage</span>
            <button type="button" onClick={() => setSheetOpen(true)}
              className="rounded-md border border-line px-2.5 py-1.5 text-xs text-ink-2
                transition-colors duration-150 hover:border-line-strong hover:text-ink">
              History {s.history.length > 0 && <span className="tabular text-ink-4">{s.history.length}</span>}
            </button>
          </div>
          <div className="min-h-0 flex-1" style={{ containerType: 'size' }}>
            <Stage generation={s.selected} run={s.run} onRetry={s.retry} onRemix={s.reuse} />
          </div>
        </section>

        <aside className="order-2 flex min-h-0 shrink-0 border-t border-line
          lg:order-1 lg:h-full lg:w-[380px] lg:border-r lg:border-t-0">
          <Composer
            catalog={s.catalog}
            state={s.composer}
            onChange={s.setComposer}
            onGenerate={s.generate}
            running={s.isRunning}
            fieldErrors={s.fieldErrors}
          />
        </aside>

        <aside className="order-3 hidden shrink-0 border-l border-line xl:flex xl:w-[320px] xl:flex-col">
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-line px-3">
            <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-ink-3">History</span>
            <span className="tabular text-[11px] text-ink-4">{s.history.length}</span>
          </div>
          <HistoryRail items={s.history} selectedId={s.selectedId} onSelect={s.setSelectedId}
            onDelete={s.remove} loading={s.booting} />
        </aside>

        <section className="order-4 hidden shrink-0 border-t border-line lg:block xl:hidden">
          <HistoryRail items={s.history} selectedId={s.selectedId} onSelect={s.setSelectedId}
            onDelete={s.remove} loading={s.booting} layout="strip" />
        </section>
      </main>

      {sheetOpen && (
        <div className="fixed inset-0 z-30 flex flex-col justify-end lg:hidden">
          <button type="button" aria-label="Close history" onClick={() => setSheetOpen(false)}
            className="absolute inset-0 bg-black/60" />
          <div className="rise relative max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-line bg-ground">
            <div className="sticky top-0 flex items-center justify-between border-b border-line bg-ground px-4 py-3">
              <span className="text-xs font-medium uppercase tracking-[0.09em] text-ink-3">History</span>
              <button type="button" onClick={() => setSheetOpen(false)} className="text-xs text-ink-3">Close</button>
            </div>
            <HistoryRail items={s.history} selectedId={s.selectedId}
              onSelect={(id) => { s.setSelectedId(id); setSheetOpen(false) }}
              onDelete={s.remove} loading={s.booting} />
          </div>
        </div>
      )}
    </>
  )
}
