'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { IMAGE_MENU, PRIMARY_NAV, VIDEO_MENU, type MegaMenu } from './nav'
import { Wordmark } from './Wordmark'
import { RenderIndicator } from './RenderIndicator'

function MegaPanel({ menu, onNavigate }: { menu: MegaMenu; onNavigate: () => void }) {
  return (
    <div
      className="rise absolute left-0 top-full z-50 mt-1 w-[min(92vw,720px)] rounded-card border
        border-line bg-surface p-4 shadow-2xl shadow-black/60"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        {menu.columns.map((col) => (
          <div key={col.title}>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.11em] text-ink-4">
              {col.title}
            </p>
            <div className="flex flex-col gap-0.5">
              {col.items.map((it) => (
                <Link
                  key={it.href + it.label}
                  href={it.href}
                  onClick={onNavigate}
                  className="group rounded-md px-2.5 py-2 transition-colors duration-150 hover:bg-surface-2"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink">{it.label}</span>
                    {it.badge && (
                      <span className="rounded border border-accent-dim px-1 py-px text-[9px]
                        font-medium uppercase tracking-[0.08em] text-accent">
                        {it.badge}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-ink-3">{it.description}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TopBar() {
  const path = usePathname()
  const router = useRouter()
  const [query, setQuery] = useState('')
  // Menu state is stored WITH the path it was opened on, so navigating closes
  // it by derivation rather than by a setState-in-effect cascade.
  const [openAt, setOpenAt] = useState<{ menu: string; path: string } | null>(null)
  const [mobileAt, setMobileAt] = useState<string | null>(null)
  const barRef = useRef<HTMLElement>(null)

  const open = openAt?.path === path ? openAt.menu : null
  const mobileOpen = mobileAt === path
  const setOpen = (menu: string | null) => setOpenAt(menu ? { menu, path } : null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpenAt(null)
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenAt(null) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const menus = [VIDEO_MENU, IMAGE_MENU]
  const isActive = (item: { href: string; match?: (p: string) => boolean }) =>
    item.match ? item.match(path) : path === item.href

  return (
    <header ref={barRef} className="relative z-40 shrink-0 border-b border-line bg-ground">
      <div className="flex h-14 items-center gap-1 px-3 sm:px-4">
        <Link href="/studio" className="mr-2 flex items-center gap-2.5 rounded px-1 py-1">
          <Wordmark />
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex">
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'rounded-md px-2.5 py-1.5 text-[13px] transition-colors duration-150',
                isActive(item) ? 'text-ink' : 'text-ink-3 hover:text-ink-2 hover:bg-surface-2',
              ].join(' ')}
            >
              {item.label}
            </Link>
          ))}

          <span className="mx-1.5 h-4 w-px bg-line" />

          {menus.map((menu) => (
            <div key={menu.label} className="relative">
              <button
                type="button"
                aria-expanded={open === menu.label}
                aria-haspopup="true"
                onClick={() => setOpen(open === menu.label ? null : menu.label)}
                className={[
                  'flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[13px] transition-colors duration-150',
                  open === menu.label ? 'bg-surface-2 text-ink' : 'text-ink-3 hover:text-ink-2 hover:bg-surface-2',
                ].join(' ')}
              >
                {menu.label}
                <svg width="9" height="9" viewBox="0 0 12 12" aria-hidden
                  className={`transition-transform duration-200 ${open === menu.label ? 'rotate-180' : ''}`}>
                  <path d="M2 4.5 L6 8.5 L10 4.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                </svg>
              </button>
              {open === menu.label && <MegaPanel menu={menu} onNavigate={() => setOpen(null)} />}
            </div>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <RenderIndicator />
          {/* Real search: submits to Assets, which filters the actual library. */}
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault()
              const q = query.trim()
              router.push(q ? `/assets?q=${encodeURIComponent(q)}` : '/assets')
            }}
            className="hidden md:block"
          >
            <label className="sr-only" htmlFor="slate-search">Search your assets</label>
            <input
              id="slate-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search assets"
              className="w-40 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-ink
                placeholder:text-ink-4 transition-colors duration-150 focus:w-56 focus:border-line-strong
                focus:outline-none"
            />
          </form>
          <button
            type="button"
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
            onClick={() => setMobileAt(mobileOpen ? null : path)}
            className="rounded-md border border-line px-2.5 py-1.5 text-xs text-ink-2
              transition-colors duration-150 hover:border-line-strong lg:hidden"
          >
            Menu
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="rise border-t border-line bg-surface px-3 py-2 lg:hidden">
          <div className="flex flex-col gap-0.5">
            {PRIMARY_NAV.map((item) => (
              <Link key={item.href} href={item.href}
                className={`rounded-md px-2.5 py-2 text-sm ${isActive(item) ? 'bg-surface-2 text-ink' : 'text-ink-2'}`}>
                {item.label}
              </Link>
            ))}
            {menus.flatMap((m) => m.columns.flatMap((c) => c.items)).map((it) => (
              <Link key={it.href + it.label} href={it.href} className="rounded-md px-2.5 py-2 text-sm text-ink-3">
                {it.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  )
}
