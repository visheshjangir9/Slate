/**
 * Navigation config.
 *
 * A route appears here only once its page genuinely works. Nothing is listed
 * "coming soon", so the nav can never contain a dead link.
 */
export interface NavItem {
  label: string
  href: string
  match?: (path: string) => boolean
}

export interface MegaItem {
  label: string
  description: string
  href: string
  badge?: 'TOP' | 'NEW'
}

export interface MegaMenu {
  label: string
  columns: { title: string; items: MegaItem[] }[]
}

export const VIDEO_MENU: MegaMenu = {
  label: 'Video',
  columns: [
    {
      title: 'Workflows',
      items: [
        {
          label: 'Create Video',
          description: 'Prompt to a cinematic clip with a real camera move',
          href: '/studio',
          badge: 'TOP',
        },
        {
          label: 'Motion Library',
          description: 'Browse every camera move and preview it live',
          href: '/studio/motion',
        },
      ],
    },
    {
      title: 'Engine',
      items: [
        {
          label: 'Slate Cinematic 1',
          description: 'AI still, eased camera move, H.264 encoded in your browser',
          href: '/developers#engine',
        },
      ],
    },
  ],
}

export const IMAGE_MENU: MegaMenu = {
  label: 'Image',
  columns: [
    {
      title: 'Workflows',
      items: [
        {
          label: 'Still Image',
          description: 'Generate a single frame and download it',
          href: '/studio/image',
        },
      ],
    },
  ],
}

export const PRIMARY_NAV: NavItem[] = [
  { label: 'Studio', href: '/studio', match: (p) => p.startsWith('/studio') },
  { label: 'Explore', href: '/explore' },
  { label: 'Assets', href: '/assets' },
  { label: 'Developers', href: '/developers' },
]

export const STUDIO_TABS: NavItem[] = [
  { label: 'Create Video', href: '/studio', match: (p) => p === '/studio' },
  { label: 'Still Image', href: '/studio/image' },
  { label: 'Motion Library', href: '/studio/motion' },
]
