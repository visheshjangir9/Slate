import { ALL_PRESETS } from './presets'

/**
 * Alt text for the static artwork in /public/explore, keyed by file name.
 *
 * Recipe stills are described by the prompt that made them; the camera-motion
 * stills have no recipe, so they are described here. Written as what the
 * picture shows, never as the label of the link it sits in.
 */
const DESCRIBED: Record<string, string> = {
  'motion-dolly-in.jpg': 'A glass conservatory with tall palms and a rain-wet floor reflecting the light',
  'motion-dolly-out.jpg': 'A man on a rooftop ledge looking out over a city skyline at dusk',
  'motion-orbit-left.jpg': 'A black classic sports car parked in a wet concrete garage at night',
  'motion-crane-up.jpg': 'A lone figure in a towering brutalist concrete courtyard after rain',
  'motion-demo.jpg': 'Sunset over misty mountains, a lone tree on a ridge beside a winding road',
}

const sentence = (s: string) => {
  const t = s.trim().replace(/\s+/g, ' ')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

const FROM_PRESETS: Record<string, string> = Object.fromEntries(
  ALL_PRESETS.map((p) => [p.image, sentence(p.prompt)]),
)

/** A description of the artwork file, or `fallback` for an unknown one. */
export const artAlt = (file: string, fallback = ''): string => DESCRIBED[file] ?? FROM_PRESETS[file] ?? fallback
