import type { AspectRatio, Bitrate, MotionId, Resolution } from '@/lib/engine/types'

/**
 * Curated Slate recipes.
 *
 * Every field is a real generation parameter: "Use preset" hands these straight
 * to Create Video. The card preview is the actual still this prompt and seed
 * produce, fetched through the same proxy the engine uses -- not stock imagery.
 */
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
  tags: string[]
}

export const PRESETS: Preset[] = [
  {
    id: 'rain-street',
    title: 'Neon Rain',
    note: 'Slow push into a wet street. The classic establishing move.',
    prompt: 'a lone figure on a rain-slicked street at night, neon signage bleeding into the puddles, shallow depth of field',
    motion: 'dolly_in', durationS: 8, aspectRatio: '21:9', resolution: '1080p', bitrate: 'high',
    seed: 101, tags: ['cinematic', 'night'],
  },
  {
    id: 'ridge-dawn',
    title: 'Ridge at Dawn',
    note: 'Crane reveal over fog. Sells scale immediately.',
    prompt: 'sunrise over a fog-filled valley, pine ridges receding into haze, volumetric light',
    motion: 'crane_up', durationS: 10, aspectRatio: '16:9', resolution: '1080p', bitrate: 'high',
    seed: 202, tags: ['landscape', 'golden hour'],
  },
  {
    id: 'orbit-portrait',
    title: 'Character Orbit',
    note: 'Arc around a subject. Reads as coverage, not a still.',
    prompt: 'a weathered fisherman in an oilskin coat, harbour fog behind him, overcast daylight',
    motion: 'orbit_left', durationS: 6, aspectRatio: '4:5', resolution: '1080p', bitrate: 'standard',
    seed: 303, tags: ['portrait', 'character'],
  },
  {
    id: 'crash-detail',
    title: 'Crash In',
    note: 'Violent snap to detail. Good for a cut point.',
    prompt: 'an antique pocket watch on dark velvet, single hard key light, deep shadows',
    motion: 'crash_zoom_in', durationS: 4, aspectRatio: '16:9', resolution: '720p', bitrate: 'high',
    seed: 404, tags: ['macro', 'punch'],
  },
  {
    id: 'vertical-city',
    title: 'Vertical Tilt',
    note: 'Built for phone-first framing.',
    prompt: 'looking up a glass skyscraper canyon, clouds moving overhead, cold blue daylight',
    motion: 'tilt_up', durationS: 6, aspectRatio: '9:16', resolution: '1080p', bitrate: 'standard',
    seed: 505, tags: ['vertical', 'architecture'],
  },
  {
    id: 'handheld-diner',
    title: 'Handheld Diner',
    note: 'Operator drift. Reads as documentary.',
    prompt: 'an empty diner at 3am, rain on the window, red neon sign outside, film grain',
    motion: 'handheld', durationS: 8, aspectRatio: '16:9', resolution: '720p', bitrate: 'standard',
    seed: 606, tags: ['documentary', 'night'],
  },
  {
    id: 'desert-pan',
    title: 'Desert Pan',
    note: 'Lateral sweep across emptiness.',
    prompt: 'a cracked salt flat stretching to distant mountains, heat shimmer, high sun',
    motion: 'pan_right', durationS: 12, aspectRatio: '21:9', resolution: '1080p', bitrate: 'standard',
    seed: 707, tags: ['landscape', 'wide'],
  },
  {
    id: 'pullback-space',
    title: 'Pull Back',
    note: 'Dolly out to reveal context.',
    prompt: 'an astronaut drifting past the curve of a planet, visor catching the sunrise, hard vacuum light',
    motion: 'dolly_out', durationS: 10, aspectRatio: '16:9', resolution: '1080p', bitrate: 'high',
    seed: 808, tags: ['sci-fi', 'reveal'],
  },
  {
    id: 'square-product',
    title: 'Square Product',
    note: 'Static frame, square crop. Built for feeds.',
    prompt: 'a matte black ceramic cup on polished concrete, soft north light, minimal styling',
    motion: 'static', durationS: 4, aspectRatio: '1:1', resolution: '1080p', bitrate: 'standard',
    seed: 909, tags: ['product', 'clean'],
  },
]

export const presetToParams = (p: Preset): string =>
  new URLSearchParams({
    prompt: p.prompt,
    motion: p.motion,
    duration: String(p.durationS),
    aspect: p.aspectRatio,
    resolution: p.resolution,
    bitrate: p.bitrate,
  }).toString()
