'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { STUDIO_TABS } from './nav'

/** The three real Studio workflows. Every tab routes to a working page. */
export function WorkflowTabs() {
  const path = usePathname()
  return (
    <div className="shrink-0 overflow-x-auto border-b border-line bg-ground px-3 sm:px-4">
      <nav className="flex gap-1" aria-label="Studio workflows">
        {STUDIO_TABS.map((tab) => {
          const active = tab.match ? tab.match(path) : path === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={[
                'relative whitespace-nowrap px-3 py-2.5 text-[13px] transition-colors duration-150',
                active ? 'text-ink' : 'text-ink-3 hover:text-ink-2',
              ].join(' ')}
            >
              {tab.label}
              <span
                className={[
                  'absolute inset-x-2 -bottom-px h-[2px] rounded-full transition-all duration-200',
                  active ? 'bg-accent opacity-100' : 'opacity-0',
                ].join(' ')}
              />
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
