'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { signOut, useAuth } from '@/lib/client/auth'
import { IconChevronDown, IconClose, IconLock, IconMenu } from '@/components/ui/icons'
import { buttonClass } from '@/components/ui/primitives'
import { CREATE_MENU, FEATURES_MENU, PRIMARY_NAV, type MenuLink } from './nav'
import { Wordmark } from './Wordmark'
import { RenderIndicator } from './RenderIndicator'

type MenuId = 'create' | 'features'

/** One menu entry. Unavailable capabilities render as inert text with a lock. */
function MenuEntry({ item, onNavigate }: { item: MenuLink; onNavigate: () => void }) {
  if (!item.href) {
    return (
      <div aria-disabled="true" className="flex items-start gap-2 rounded-[5px] px-3 py-2.5">
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-[14px] font-medium text-ink-3">
            {item.label} <IconLock size={12} className="text-ink-4" />
          </span>
          <span className="mt-0.5 block text-xs text-ink-4">{item.description}</span>
        </span>
      </div>
    )
  }
  return (
    <Link href={item.href} onClick={onNavigate}
      className="group block rounded-[5px] px-3 py-2.5 transition-colors duration-150 hover:bg-surface-2 focus-visible:bg-surface-2">
      {item.emphasis ? (
        <span className="flex items-center gap-2 font-display text-[16px] font-extrabold tracking-[-0.01em] text-ink group-hover:text-signal">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-signal" />{item.label}
        </span>
      ) : (
        <span className="block text-[14px] font-medium text-ink group-hover:text-signal">{item.label}</span>
      )}
      <span className="mt-0.5 block text-xs text-ink-3">{item.description}</span>
    </Link>
  )
}

/**
 * Hover menu. Opens on pointer hover, closes after a short grace period so
 * the pointer can travel from trigger to panel. Click and keyboard still
 * toggle it, which is how touch and keyboard users reach the same links.
 */
function NavMenu({
  id, label, active, open, onOpen, onClose, children, width,
}: {
  id: MenuId
  label: string
  active: boolean
  open: boolean
  onOpen: (id: MenuId) => void
  /** Closes this menu only; a stale timer must never close a sibling. */
  onClose: (id: MenuId) => void
  children: ReactNode
  width: number
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancel = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null } }
  const later = () => { cancel(); timer.current = setTimeout(() => onClose(id), 140) }
  useEffect(() => cancel, [])

  return (
    <div className="relative" onMouseEnter={() => { cancel(); onOpen(id) }} onMouseLeave={later}>
      <button type="button" aria-expanded={open} aria-haspopup="true" aria-controls={`menu-${id}`}
        onClick={() => (open ? onClose(id) : onOpen(id))}
        className={`relative flex h-14 items-center gap-1 px-3 text-[13px] font-medium transition-colors duration-150
          ${active || open ? 'text-ink' : 'text-ink-3 hover:text-ink'}`}>
        {label}
        <IconChevronDown size={12} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        <span className={`absolute inset-x-3 bottom-0 h-[2px] bg-signal transition-opacity ${active ? 'opacity-100' : 'opacity-0'}`} />
      </button>
      {open && (
        // pt-2 is a hover bridge: the gap between trigger and panel still counts as "inside".
        <div id={`menu-${id}`} className="absolute left-0 top-full z-50 pt-2" style={{ width }}>
          <div className="rise rounded-[8px] border border-line-strong bg-surface p-2 shadow-2xl shadow-black/70">
            {children}
          </div>
        </div>
      )}
    </div>
  )
}

function Account() {
  const auth = useAuth()
  const path = usePathname()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key) }
  }, [open])

  if (auth.status === 'loading') return <span className="h-8 w-[64px] rounded-[var(--radius-ctl)] bg-surface-2" aria-hidden />

  if (auth.status === 'guest') {
    // From a public page, signing in leads into Studio; from an account page, back to it.
    const next = /^\/(studio|assets)/.test(path) ? path : '/studio'
    if (path.startsWith('/sign-in')) return null
    return (
      <Link href={`/sign-in?next=${encodeURIComponent(next)}`}
        className="flex h-8 items-center px-2 text-[13px] font-medium text-ink-2 transition-colors hover:text-ink">
        Sign In
      </Link>
    )
  }

  const email = auth.user?.email ?? ''
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu"
        aria-label="Account"
        className="flex h-8 items-center gap-1.5 rounded-[var(--radius-ctl)] border border-line pl-1 pr-1.5 transition-colors hover:border-line-strong">
        <span className="flex h-6 w-6 items-center justify-center rounded-[4px] bg-surface-3 font-display text-xs font-extrabold text-ink">
          {email.slice(0, 1).toUpperCase()}
        </span>
        <IconChevronDown size={12} className="text-ink-3" />
      </button>
      {open && (
        <div role="menu" className="rise absolute right-0 top-full z-50 mt-2 w-64 rounded-[8px] border border-line-strong bg-surface p-1.5 shadow-2xl shadow-black/70">
          <div className="px-2.5 py-2">
            <p className="eyebrow text-ink-3">Signed in</p>
            <p className="mt-1 truncate text-[13px] text-ink">{email}</p>
          </div>
          <div className="my-1 h-px bg-line" />
          <Link role="menuitem" href="/assets" onClick={() => setOpen(false)}
            className="block rounded px-2.5 py-2 text-[13px] text-ink-2 hover:bg-surface-2 hover:text-ink">Your assets</Link>
          <Link role="menuitem" href="/studio" onClick={() => setOpen(false)}
            className="block rounded px-2.5 py-2 text-[13px] text-ink-2 hover:bg-surface-2 hover:text-ink">Studio</Link>
          <button role="menuitem" type="button" onClick={() => void signOut()}
            className="block w-full rounded px-2.5 py-2 text-left text-[13px] text-ink-2 hover:bg-surface-2 hover:text-ink">Sign out</button>
        </div>
      )}
    </div>
  )
}

export function TopBar() {
  const path = usePathname()
  // Open state is stored WITH the path it was opened on, so navigating closes
  // menus by derivation rather than by a setState-in-effect cascade.
  const [menuAt, setMenuAt] = useState<{ id: MenuId; path: string } | null>(null)
  const [mobileAt, setMobileAt] = useState<string | null>(null)
  const open = menuAt?.path === path ? menuAt.id : null
  const mobileOpen = mobileAt === path
  const inStudio = path.startsWith('/studio')

  /**
   * The wordmark is Home. From another route, the Link navigates to / and
   * lands at the top. On / itself a Link to the same URL does not move, so
   * scroll to the top explicitly and drop any section hash (#byok).
   */
  const goHome = (e: ReactMouseEvent<HTMLAnchorElement>) => {
    setMobileAt(null)
    if (path !== '/' || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    if (window.location.hash || window.location.search) window.history.replaceState(window.history.state, '', '/')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
    // A smooth scroll can be interrupted (or not run at all in a background
    // tab); the top is the destination either way.
    if (!reduce) setTimeout(() => { if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'auto' }) }, 900)
  }

  const openMenu = useCallback((id: MenuId) => setMenuAt({ id, path }), [path])
  const closeMenu = useCallback((id?: MenuId) =>
    setMenuAt((m) => (!id || m?.id === id ? null : m)), [])

  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuAt(null) }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [open])

  const linkCls = (active: boolean) =>
    `relative flex h-14 items-center px-3 text-[13px] font-medium transition-colors duration-150 ${active ? 'text-ink' : 'text-ink-3 hover:text-ink'}`

  return (
    <header className="sticky top-0 z-40 shrink-0 border-b border-line bg-[#0c0c0d]/95 backdrop-blur-[2px]">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-1 px-3 sm:px-5">
        <Link href="/" scroll aria-label="Slate home" onClick={goHome} className="mr-4 rounded px-1 py-1">
          <Wordmark />
        </Link>

        <nav aria-label="Primary" className="hidden items-center lg:flex">
          <NavMenu id="create" label="Create" active={inStudio} open={open === 'create'}
            onOpen={openMenu} onClose={closeMenu} width={320}>
            {CREATE_MENU.map((it) => <MenuEntry key={it.label} item={it} onNavigate={() => closeMenu()} />)}
          </NavMenu>
          {PRIMARY_NAV.slice(0, 2).map((item) => (
            <Link key={item.href} href={item.href} className={linkCls(item.match(path))}
              aria-current={item.match(path) ? 'page' : undefined}>
              {item.label}
              <span className={`absolute inset-x-3 bottom-0 h-[2px] bg-signal ${item.match(path) ? 'opacity-100' : 'opacity-0'}`} />
            </Link>
          ))}
          <NavMenu id="features" label="Features" active={false} open={open === 'features'}
            onOpen={openMenu} onClose={closeMenu} width={640}>
            <div className="grid grid-cols-3 gap-1">
              {FEATURES_MENU.map((col) => (
                <div key={col.title}>
                  <p className="eyebrow px-3 pb-1 pt-2 text-ink-3">{col.title}</p>
                  {col.items.map((it) => <MenuEntry key={it.label} item={it} onNavigate={() => closeMenu()} />)}
                </div>
              ))}
            </div>
          </NavMenu>
          {PRIMARY_NAV.slice(2).map((item) => (
            <Link key={item.href} href={item.href} className={linkCls(item.match(path))}
              aria-current={item.match(path) ? 'page' : undefined}>
              {item.label}
              <span className={`absolute inset-x-3 bottom-0 h-[2px] bg-signal ${item.match(path) ? 'opacity-100' : 'opacity-0'}`} />
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <RenderIndicator />
          <Account />
          {!inStudio && (
            <Link href="/studio" className={buttonClass('contrast', 'sm', 'hidden sm:inline-flex')}>Enter Studio</Link>
          )}
          <button type="button" aria-label={mobileOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileOpen}
            onClick={() => setMobileAt(mobileOpen ? null : path)}
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-ctl)] border border-line text-ink-2 hover:border-line-strong lg:hidden">
            {mobileOpen ? <IconClose /> : <IconMenu />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav aria-label="Mobile" className="rise max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-t border-line bg-[#0c0c0d] px-3 pb-5 pt-2 lg:hidden">
          <p className="eyebrow px-3 pb-1 pt-3 text-ink-3">Create</p>
          {CREATE_MENU.map((it) => <MenuEntry key={it.label} item={it} onNavigate={() => setMobileAt(null)} />)}
          <div className="my-2 h-px bg-line" />
          {PRIMARY_NAV.map((item) => (
            <Link key={item.href} href={item.href}
              className={`block rounded px-3 py-2.5 text-[15px] font-medium ${item.match(path) ? 'text-ink' : 'text-ink-2'}`}>
              {item.label}
            </Link>
          ))}
          <div className="my-2 h-px bg-line" />
          {FEATURES_MENU.map((col) => (
            <div key={col.title}>
              <p className="eyebrow px-3 pb-1 pt-3 text-ink-3">{col.title}</p>
              {col.items.map((it) => <MenuEntry key={it.label} item={it} onNavigate={() => setMobileAt(null)} />)}
            </div>
          ))}
          {!inStudio && (
            <Link href="/studio" className={buttonClass('contrast', 'lg', 'mt-4 w-full')}>Enter Studio</Link>
          )}
        </nav>
      )}
    </header>
  )
}
