/**
 * Navigation config.
 *
 * A route appears here only once its page genuinely works. Nothing is listed
 * "coming soon", so the nav can never contain a dead link.
 */
export interface NavItem {
  label: string
  href: string
  match: (path: string) => boolean
}

/** Direct links in the public bar. Create and Features are menus (see TopBar). */
export const PRIMARY_NAV: NavItem[] = [
  { label: 'Explore', href: '/explore', match: (p) => p.startsWith('/explore') },
  { label: 'Motion', href: '/motion', match: (p) => p.startsWith('/motion') },
  { label: 'About', href: '/about', match: (p) => p.startsWith('/about') },
]

export interface MenuLink {
  label: string
  description: string
  /** Absent when the capability does not exist in this build. */
  href?: string
  /** A first-class feature: set in bold with an accent marker. */
  emphasis?: boolean
}

/** Create menu: the three real workflows, as plain text. */
export const CREATE_MENU: MenuLink[] = [
  { label: 'Video', description: 'Generate video from text or image', href: '/studio' },
  { label: 'Image', description: 'Generate images from a prompt', href: '/studio/image' },
  { label: 'Camera Motion', description: 'Animate an image with real camera movement', href: '/studio/motion' },
]

/**
 * Features menu. Every entry maps to a real workflow except Image to Image,
 * which Slate cannot do yet; it is listed as unavailable, not linked.
 */
export const FEATURES_MENU: { title: string; items: MenuLink[] }[] = [
  {
    title: 'Video',
    items: [
      { label: 'AI Video Generator', description: 'Generative video with LTX-2 Pro', href: '/studio' },
      { label: 'Text to Video', description: 'Describe the shot, get a clip', href: '/studio?mode=text' },
      { label: 'Image to Video', description: 'Start the clip from your own image', href: '/studio?mode=image' },
    ],
  },
  {
    title: 'Image',
    items: [
      { label: 'AI Image Generator', description: 'GPT Image 1, cropped to your frame', href: '/studio/image' },
      { label: 'Text to Image', description: 'Prompt to a finished image', href: '/studio/image' },
      { label: 'Image to Image', description: 'Not available in this build' },
    ],
  },
  {
    title: 'Popular',
    items: [
      { label: 'BYOK', description: 'Bring your own AI: your provider’s models, inside Slate', href: '/byok', emphasis: true },
      { label: 'Camera Motion', description: '15 real camera moves over your image', href: '/studio/motion' },
    ],
  },
]

export type Workflow = 'video' | 'image' | 'motion'

export interface WorkflowItem {
  id: Workflow
  label: string
  href: string
  description: string
  /** Static artwork from /public/explore. Never a generated user result. */
  art: string
}

/** The three creation workflows the backend genuinely supports. */
export const WORKFLOWS: WorkflowItem[] = [
  {
    id: 'video',
    label: 'Video',
    href: '/studio',
    description: 'Prompt or image to generative video with LTX-2 Pro: the scene itself moves.',
    art: 'neon-rain.jpg',
  },
  {
    id: 'image',
    label: 'Image',
    href: '/studio/image',
    description: 'Prompt to image with GPT Image, cropped to the frame you choose.',
    art: 'ceramic-cup.jpg',
  },
  {
    id: 'motion',
    label: 'Camera Motion',
    href: '/studio/motion',
    description: 'Bring your own image and drive one of 15 real camera moves across it.',
    art: 'motion-demo.jpg',
  },
]

export const workflowForPath = (path: string): Workflow =>
  path.startsWith('/studio/image') ? 'image' : path.startsWith('/studio/motion') ? 'motion' : 'video'
