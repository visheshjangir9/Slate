import type { SVGProps } from 'react'

/**
 * Slate icon set. One stroke weight, one grid (20px), drawn for this product.
 * Decorative by default; give the parent control an accessible name.
 */
type P = SVGProps<SVGSVGElement> & { size?: number }

const base = (size = 16): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
})

export const IconVideo = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="2.5" y="5" width="11" height="10" rx="1.5" /><path d="M13.5 8.5 17.5 6v8l-4-2.5" /></svg>
)
export const IconImage = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="2.5" y="3.5" width="15" height="13" rx="1.5" /><circle cx="7.5" cy="8" r="1.5" /><path d="m3 15 4.5-4 3 2.5 3-3 4 3.5" /></svg>
)
export const IconMotion = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="5" y="6" width="10" height="8" rx="1" /><path d="M2 4v12M18 4v12M2 10h1.5M16.5 10H18" /></svg>
)
export const IconGrid = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="3" y="3" width="6" height="6" rx="1" /><rect x="11" y="3" width="6" height="6" rx="1" /><rect x="3" y="11" width="6" height="6" rx="1" /><rect x="11" y="11" width="6" height="6" rx="1" /></svg>
)
export const IconCode = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="m7 6-4 4 4 4M13 6l4 4-4 4" /></svg>
)
export const IconSearch = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="9" cy="9" r="5.5" /><path d="m13.5 13.5 3.5 3.5" /></svg>
)
export const IconPlus = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M10 4v12M4 10h12" /></svg>
)
export const IconClose = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="m5 5 10 10M15 5 5 15" /></svg>
)
export const IconChevronDown = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="m5 8 5 5 5-5" /></svg>
)
export const IconChevronRight = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="m8 5 5 5-5 5" /></svg>
)
export const IconArrowRight = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4 10h12M11 5l5 5-5 5" /></svg>
)
export const IconArrowUpRight = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M6 14 14 6M7 6h7v7" /></svg>
)
export const IconDownload = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M10 3v10M5.5 8.5 10 13l4.5-4.5M4 16.5h12" /></svg>
)
export const IconTrash = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4 6h12M8 6V4h4v2M6 6l.7 10h6.6L14 6" /></svg>
)
export const IconUpload = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M10 13V3M5.5 7.5 10 3l4.5 4.5M4 16.5h12" /></svg>
)
export const IconUser = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="10" cy="7" r="3" /><path d="M4 17c1-3 3.3-4.5 6-4.5s5 1.5 6 4.5" /></svg>
)
export const IconRefresh = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M16 10a6 6 0 1 1-1.8-4.3M16 3.5v3.5h-3.5" /></svg>
)
export const IconRemix = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M3 6h9.5M9.5 3l3 3-3 3M17 14H7.5M10.5 11l-3 3 3 3" /></svg>
)
export const IconHistory = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M3.5 10a6.5 6.5 0 1 0 1.9-4.6M3.5 3.5V6h2.5" /><path d="M10 6.5V10l2.5 1.5" /></svg>
)
export const IconLock = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="4.5" y="9" width="11" height="8" rx="1.5" /><path d="M7 9V6.5a3 3 0 0 1 6 0V9" /></svg>
)
export const IconPlay = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M6.5 4.5v11l9-5.5-9-5.5Z" fill="currentColor" /></svg>
)
export const IconCheck = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="m4.5 10.5 3.5 3.5 7.5-8" /></svg>
)
export const IconCopy = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="7" y="7" width="10" height="10" rx="1.5" /><path d="M13 7V4.5A1.5 1.5 0 0 0 11.5 3h-7A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13H7" /></svg>
)
export const IconMenu = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M3 6h14M3 10h14M3 14h14" /></svg>
)
export const IconSettings = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4 6h6M14 6h2M4 14h2M10 14h6" /><circle cx="12" cy="6" r="2" /><circle cx="8" cy="14" r="2" /></svg>
)
