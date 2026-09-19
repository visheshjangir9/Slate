import type { AspectRatio, Bitrate, MotionId, Resolution } from '@/lib/engine/types'

/**
 * Curated Slate recipes.
 *
 * Every field is a real generation parameter: "Use preset" hands these straight
 * to Create Video. Imagery is served from static files in /public/explore --
 * Explore makes no live image API calls, so the page is instant and costs
 * nothing to browse.
 */
export const CATEGORIES = [
  'Cinematic', 'Portrait', 'Product', 'Landscape', 'Night', 'Macro', 'Architecture',
] as const
export type Category = (typeof CATEGORIES)[number]

export interface Preset {
  id: string
  title: string
  note: string
  prompt: string
  motion: MotionId
  durationS: number
  aspectRatio: AspectRatio
  resolution: Resolution
  bitrate: Bitrate
  seed: number
  category: Category
  tags: string[]
  /** File under /public/explore. */
  image: string
}

export const FEATURED: Preset = {
  id: 'coastal-beacon',
  title: 'Coastal Beacon',
  note: 'A slow push into a storm-lit lighthouse. Wide, patient and built to open a sequence.',
  prompt:
    'a lighthouse beam cutting through a coastal storm at dusk, spray bursting over black rocks, long lens, volumetric light',
  motion: 'dolly_in',
  durationS: 8,
  aspectRatio: '21:9',
  resolution: '1080p',
  bitrate: 'high',
  seed: 1101,
  category: 'Cinematic',
  tags: ['cinematic', 'establishing', 'storm'],
  image: 'featured-hero.jpg',
}

export const RECIPES: Preset[] = [
  {
    id: 'neon-rain',
    title: 'Neon Rain',
    note: 'Slow push into a wet street. The classic establishing move.',
    prompt:
      'a lone figure on a rain-slicked street at night, neon signage bleeding into the puddles, shallow depth of field',
    motion: 'dolly_in', durationS: 8, aspectRatio: '21:9', resolution: '1080p', bitrate: 'high',
    seed: 101, category: 'Cinematic', tags: ['night', 'neon'], image: 'neon-rain.jpg',
  },
  {
    id: 'ridge-dawn',
    title: 'Ridge at Dawn',
    note: 'Crane reveal over fog. Sells scale immediately.',
    prompt: 'sunrise over a fog-filled valley, pine ridges receding into haze, volumetric light',
    motion: 'crane_up', durationS: 8, aspectRatio: '16:9', resolution: '1080p', bitrate: 'high',
    seed: 202, category: 'Landscape', tags: ['golden hour', 'wide'], image: 'ridge-dawn.jpg',
  },
  {
    id: 'harbour-portrait',
    title: 'Character Orbit',
    note: 'Arc around a subject. Reads as coverage, not a still.',
    prompt: 'a weathered fisherman in an oilskin coat, harbour fog behind him, overcast daylight',
    motion: 'orbit_left', durationS: 6, aspectRatio: '4:5', resolution: '1080p', bitrate: 'standard',
    seed: 303, category: 'Portrait', tags: ['character', 'overcast'], image: 'harbour-portrait.jpg',
  },
  {
    id: 'pocket-watch',
    title: 'Crash In',
    note: 'Violent snap to detail. Good for a cut point.',
    prompt: 'an antique pocket watch on dark velvet, single hard key light, deep shadows',
    motion: 'crash_zoom_in', durationS: 4, aspectRatio: '16:9', resolution: '720p', bitrate: 'high',
    seed: 404, category: 'Macro', tags: ['detail', 'punch'], image: 'pocket-watch.jpg',
  },
  {
    id: 'glass-canyon',
    title: 'Vertical Tilt',
    note: 'Built for phone-first framing.',
    prompt: 'looking up a glass skyscraper canyon, clouds moving overhead, cold blue daylight',
    motion: 'tilt_up', durationS: 6, aspectRatio: '9:16', resolution: '1080p', bitrate: 'standard',
    seed: 505, category: 'Architecture', tags: ['vertical', 'city'], image: 'glass-canyon.jpg',
  },
  {
    id: 'diner-night',
    title: 'Handheld Diner',
    note: 'Operator drift. Reads as documentary.',
    prompt: 'an empty diner at 3am, rain on the window, red neon sign outside, film grain',
    motion: 'handheld', durationS: 8, aspectRatio: '16:9', resolution: '720p', bitrate: 'standard',
    seed: 606, category: 'Night', tags: ['documentary', 'grain'], image: 'diner-night.jpg',
  },
  {
    id: 'ceramic-cup',
    title: 'Square Product',
    note: 'Locked off, square crop. Built for feeds.',
    prompt: 'a matte black ceramic cup on polished concrete, soft north light, minimal styling',
    motion: 'static', durationS: 4, aspectRatio: '1:1', resolution: '1080p', bitrate: 'standard',
    seed: 707, category: 'Product', tags: ['clean', 'studio'], image: 'ceramic-cup.jpg',
  },
  {
    id: 'orbit-station',
    title: 'Pull Back',
    note: 'Dolly out to reveal context.',
    prompt:
      'an astronaut drifting past the curve of a planet, visor catching the sunrise, hard vacuum light',
    motion: 'dolly_out', durationS: 8, aspectRatio: '16:9', resolution: '1080p', bitrate: 'high',
    seed: 808, category: 'Cinematic', tags: ['sci-fi', 'reveal'], image: 'orbit-station.jpg',
  },
]

/**
 * The eight moves surfaced in Explore's Camera Motion section.
 *
 * All are real engine presets. Push In and Pull Out are deliberately absent:
 * in cinematography they are synonyms for Dolly In and Dolly Out, so listing
 * both would be two controls doing an identical thing.
 */
export const MOTION_SHOWCASE: MotionId[] = [
  'dolly_in', 'dolly_out', 'orbit_left', 'crane_up',
  'crane_down', 'whip_pan', 'crash_zoom_in', 'tilt_up',
]

/** One shared frame for every motion card: holding the scene constant is what
 *  makes the move itself legible. */
export const MOTION_DEMO_IMAGE = 'motion-demo.jpg'

export const presetToParams = (p: Preset): string =>
  new URLSearchParams({
    prompt: p.prompt,
    motion: p.motion,
    duration: String(p.durationS),
    aspect: p.aspectRatio,
    resolution: p.resolution,
    bitrate: p.bitrate,
  }).toString()

export const ALL_PRESETS: Preset[] = [FEATURED, ...RECIPES]
