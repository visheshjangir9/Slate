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
  id: 'harbour-lights',
  title: 'Harbour Lights',
  note: 'A slow push over a harbour city as the lights come on. Wide, patient and built to open a sequence.',
  prompt:
    'a harbour city at dusk seen from a hillside terrace, suspension bridge lit up, ships at anchor, low clouds glowing orange, wet street below',
  motion: 'dolly_in',
  durationS: 8,
  aspectRatio: '21:9',
  resolution: '1080p',
  bitrate: 'high',
  seed: 1101,
  category: 'Cinematic',
  tags: ['cinematic', 'establishing', 'dusk', 'city'],
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
    prompt: 'looking straight up a canyon of glass skyscrapers, golden sunset clouds reflected in the facades',
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
    prompt: 'an off-white stoneware mug on a concrete ledge, warm late sun, soft leaf shadows on the wall, minimal styling',
    motion: 'static', durationS: 4, aspectRatio: '1:1', resolution: '1080p', bitrate: 'standard',
    seed: 707, category: 'Product', tags: ['clean', 'studio'], image: 'ceramic-cup.jpg',
  },
  {
    id: 'orbit-station',
    title: 'Pull Back',
    note: 'Dolly out to reveal context.',
    prompt:
      'an astronaut standing on a space station deck, looking out at a vast blue planet, a crescent moon, reflections on the floor',
    motion: 'dolly_out', durationS: 8, aspectRatio: '16:9', resolution: '1080p', bitrate: 'high',
    seed: 808, category: 'Cinematic', tags: ['sci-fi', 'reveal'], image: 'orbit-station.jpg',
  },
  {
    id: 'lantern-alley',
    title: 'Lantern Alley',
    note: 'Slow push down a wet alley. Vertical, built for phones.',
    prompt:
      'a narrow rain-soaked alley at night, red paper lanterns, wet stone reflecting neon, towers in the distance',
    motion: 'dolly_in', durationS: 8, aspectRatio: '9:16', resolution: '1080p', bitrate: 'high',
    seed: 909, category: 'Night', tags: ['vertical', 'rain', 'lanterns'], image: 'alley-night.jpg',
  },
  {
    id: 'concrete-light',
    title: 'Concrete Light',
    note: 'Crane down through a shaft of light. Quiet and monumental.',
    prompt:
      'a brutalist concrete chapel, a single shaft of light falling across a cross, rows of wooden pews, dust in the air',
    motion: 'crane_down', durationS: 8, aspectRatio: '16:9', resolution: '1080p', bitrate: 'high',
    seed: 1010, category: 'Architecture', tags: ['light', 'interior'], image: 'brutalist-chapel.jpg',
  },
  {
    id: 'droplet',
    title: 'Droplet',
    note: 'A locked-off macro that lets the subject do the work.',
    prompt:
      'a water droplet suspended above rippling water, city lights refracted inside it, macro lens, shallow depth of field',
    motion: 'static', durationS: 4, aspectRatio: '1:1', resolution: '1080p', bitrate: 'high',
    seed: 1111, category: 'Macro', tags: ['water', 'detail'], image: 'droplet-macro.jpg',
  },
  {
    id: 'salt-flat',
    title: 'Salt Flat',
    note: 'Wide pan across the crust as the sun drops. Pure scale.',
    prompt:
      'cracked salt flats at sunset, hexagonal crust patterns to the horizon, low sun, dramatic clouds, ultra wide',
    motion: 'pan_right', durationS: 10, aspectRatio: '21:9', resolution: '1080p', bitrate: 'high',
    seed: 1212, category: 'Landscape', tags: ['sunset', 'wide'], image: 'salt-flat.jpg',
  },
  {
    id: 'plinth',
    title: 'Plinth',
    note: 'An arc around a single product. Reads as a turntable shot.',
    prompt:
      'a grey suede sneaker on a sandstone plinth, hard afternoon sun, leaf shadows on a plaster wall, editorial product',
    motion: 'orbit_right', durationS: 6, aspectRatio: '4:5', resolution: '1080p', bitrate: 'standard',
    seed: 1313, category: 'Product', tags: ['sneaker', 'editorial'], image: 'sneaker-plinth.jpg',
  },
  {
    id: 'night-walk',
    title: 'Night Walk',
    note: 'Handheld drift alongside a subject. Street documentary.',
    prompt:
      'a young man walking along a wet city street at night, cafe lights, passing headlights, light rain, 35mm',
    motion: 'handheld', durationS: 6, aspectRatio: '9:16', resolution: '1080p', bitrate: 'standard',
    seed: 1414, category: 'Portrait', tags: ['street', 'rain'], image: 'street-portrait.jpg',
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

/** The fallback frame for a motion card that has no scene of its own. */
export const MOTION_DEMO_IMAGE = 'motion-demo.jpg'

/** Curated scenes chosen to suit a particular move (depth for a dolly, a
 *  subject to circle for an orbit, height for a crane). */
const MOTION_STILLS: Partial<Record<MotionId, string>> = {
  dolly_in: 'motion-dolly-in.jpg',
  dolly_out: 'motion-dolly-out.jpg',
  orbit_left: 'motion-orbit-left.jpg',
  crane_up: 'motion-crane-up.jpg',
}

export const motionStill = (id: MotionId): string => MOTION_STILLS[id] ?? MOTION_DEMO_IMAGE

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
