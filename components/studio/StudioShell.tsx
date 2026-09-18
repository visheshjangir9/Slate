'use client'

import { useState } from 'react'
import { useStudio } from '@/lib/client/useStudio'
import { Composer } from './Composer'
import { HistoryRail } from './HistoryRail'
import { Stage } from './Stage'
import { TopBar } from './TopBar'

export function StudioShell() {
  const s = useStudio()
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <div className="flex h-dvh flex-col bg-ground">
      <TopBar catalog={s.catalog} historyCount={s.history.length} onOpenHistory={() => setSheetOpen(true)} />

      {s.notice && (
        <div className="flex items-center justify-between gap-3 border-b border-danger/30 bg-danger/10 px-4 py-2">
          <p className="text-xs text-danger">{s.notice}</p>
          <button
            type="button"
            onClick={() => s.setNotice(null)}
            className="text-xs text-danger/70 hover:text-danger"
          >
            Dismiss
          </button>
        </div>
      )}

      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Stage first in the DOM on mobile, left column on desktop via order. */}
        <section
          className="order-1 flex min-h-[46vh] flex-1 flex-col lg:order-2 lg:min-h-0"
          style={{ containerType: 'size' }}
        >
          <Stage generation={s.selected} run={s.run} onRetry={s.retry} onReuse={s.reuse} />
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

        {/* History: right rail on wide screens, bottom strip mid, sheet on mobile. */}
        <aside className="order-3 hidden shrink-0 border-l border-line xl:flex xl:w-[320px] xl:flex-col">
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-line px-3">
            <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-ink-3">History</span>
            <span className="tabular text-[11px] text-ink-4">{s.history.length}</span>
          </div>
          <HistoryRail
            items={s.history} selectedId={s.selectedId} onSelect={s.setSelectedId}
            onDelete={s.remove} loading={s.booting}
          />
        </aside>

        <section className="order-4 hidden shrink-0 border-t border-line lg:block xl:hidden">
          <HistoryRail
            items={s.history} selectedId={s.selectedId} onSelect={s.setSelectedId}
            onDelete={s.remove} loading={s.booting} layout="strip"
          />
        </section>
      </main>

      {/* Mobile history sheet, opened from the top bar. */}
      {sheetOpen && (
        <div className="fixed inset-0 z-30 flex flex-col justify-end lg:hidden">
          <button
            type="button"
            aria-label="Close history"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 bg-black/60"
          />
          <div className="rise relative max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-line bg-ground">
            <div className="sticky top-0 flex items-center justify-between border-b border-line bg-ground px-4 py-3">
              <span className="text-xs font-medium uppercase tracking-[0.09em] text-ink-3">History</span>
              <button type="button" onClick={() => setSheetOpen(false)} className="text-xs text-ink-3">
                Close
              </button>
            </div>
            <HistoryRail
              items={s.history} selectedId={s.selectedId}
              onSelect={(id) => { s.setSelectedId(id); setSheetOpen(false) }}
              onDelete={s.remove} loading={s.booting}
            />
          </div>
        </div>
      )}
    </div>
  )
}
