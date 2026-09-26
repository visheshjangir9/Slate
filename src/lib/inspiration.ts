import type { AspectRatio } from '@/lib/engine/types'

/**
 * Prompt ideas for the Video workflow's empty stage. Written by hand, stored
 * locally: showing one costs nothing and calls no model. Each describes what
 * a generative video model does well: the scene itself moving (people,
 * weather, light, cloth, traffic), not a camera move over a still.
 */
export interface PromptIdea {
  category: string
  prompt: string
  /** Suggested settings, shown as metadata; LTX-2 renders 4, 6 or 8 seconds. */
  durationS: 4 | 6 | 8
  aspectRatio: AspectRatio
}

export const PROMPT_IDEAS: PromptIdea[] = [
  {
    category: 'Cinematic',
    durationS: 6, aspectRatio: '21:9',
    prompt: 'A lone lighthouse keeper climbs a spiral iron staircase at dusk, storm lantern swinging in one hand. Wind rattles the salt-crusted windows; waves detonate against the rocks far below. Warm lantern light against cold blue exterior, slow handheld push behind him, anamorphic flares, 35mm film grain.',
  },
  {
    category: 'Product',
    durationS: 6, aspectRatio: '1:1',
    prompt: 'A matte black wristwatch rotates slowly on a wet slate plinth while fine mist drifts across the frame. A single hard key light rakes across the brushed steel case and catches each droplet as it beads and runs down the strap. Pure black background, shallow depth of field, macro lens, premium commercial finish.',
  },
  {
    category: 'Portrait',
    durationS: 6, aspectRatio: '4:5',
    prompt: 'Close-up of an elderly fisherman in a yellow oilskin looking out to sea as light rain begins. Drops gather on the brim of his hat, his eyes narrow against the wind, and a faint smile breaks as a gull passes overhead. Overcast soft light, muted teal and ochre palette, 85mm lens, shallow focus.',
  },
  {
    category: 'Automotive',
    durationS: 8, aspectRatio: '21:9',
    prompt: 'A dark green 1970s coupe drifts through a tight hairpin on a wet mountain pass at dawn, tyres throwing arcs of spray, headlights cutting through low cloud. Low tracking shot level with the front wheel, pine forest blurring past, cool morning light with warm sodium reflections on the tarmac.',
  },
  {
    category: 'Architecture',
    durationS: 6, aspectRatio: '16:9',
    prompt: 'Morning light sweeps across the curved concrete atrium of a brutalist library as long shadows retreat across the floor. A few early readers cross the space, dust drifts through the shafts of sun, and pages turn at a distant table. Symmetrical wide composition, quiet and monumental, natural colour.',
  },
  {
    category: 'Fashion',
    durationS: 6, aspectRatio: '9:16',
    prompt: 'A model in a long ivory silk coat walks toward camera along an empty rooftop at golden hour. The wind lifts the coat into slow ripples and loose strands of hair catch the backlight; the city skyline sits soft and hazy behind her. Editorial look, warm rim light, 50mm lens, gentle slow motion.',
  },
  {
    category: 'Landscape',
    durationS: 8, aspectRatio: '21:9',
    prompt: 'Fog pours over a jagged mountain ridge like a slow waterfall at sunrise, spilling into the pine valley below while the first light turns the peaks rose-gold. Birds cross the frame in a loose line. Wide, still composition from a high vantage point, crisp air, natural colour grade, epic scale.',
  },
  {
    category: 'Documentary',
    durationS: 6, aspectRatio: '16:9',
    prompt: 'Inside a small family bakery before sunrise, a baker dusts flour across a wooden bench and folds dough with practised hands while steam rises from a tray of fresh loaves. A single warm bulb, flour hanging in the air, handheld observational camera, natural sound feel, honest and unposed.',
  },
  {
    category: 'Night',
    durationS: 6, aspectRatio: '16:9',
    prompt: 'A narrow Tokyo side street after rain, neon signs reflected in deep puddles as a cyclist glides through with a clear umbrella. Steam drifts from a ramen stall, a vending machine hums in blue light, and a passing train flickers light across the wet walls. Moody cyan and magenta palette, cinematic night.',
  },
  {
    category: 'Action',
    durationS: 4, aspectRatio: '16:9',
    prompt: 'A trail runner sprints down a scree slope in the high desert, each stride kicking up plumes of red dust that hang in the low sun. Stones skitter away underfoot as she leaps a dry gully. Low-angle tracking shot, fast shutter, hard side light, sweat and grit in sharp detail.',
  },
  {
    category: 'Nature',
    durationS: 6, aspectRatio: '16:9',
    prompt: 'A red fox steps carefully across a frozen lake at first light, pausing to listen as fine snow blows across the ice around its paws. Its breath clouds in the cold air and the far shoreline glows pink. Long-lens wildlife look, compressed perspective, soft pastel dawn, quiet and patient.',
  },
  {
    category: 'Food',
    durationS: 4, aspectRatio: '4:5',
    prompt: 'Hot espresso pours in a slow ribbon into a clear glass of ice and milk, the dark coffee blooming into swirling marble patterns as the ice cracks and shifts. Top-down three-quarter angle on a travertine counter, soft window light, macro detail, clean café aesthetic.',
  },
  {
    category: 'Sci-fi',
    durationS: 8, aspectRatio: '21:9',
    prompt: 'Inside a vast orbital hangar, a small crew in worn flight suits walks beneath the hull of a docked freighter as maintenance drones drift past trailing sparks. Earth turns slowly beyond the open bay doors. Practical, grounded sci-fi look, cool industrial light, volumetric haze, wide lens.',
  },
]

/**
 * A random idea, avoiding `exclude` (the last one shown) so a refresh or
 * "New idea" always changes what is on screen.
 */
export function pickIdea(exclude: number | null, random: () => number = Math.random): number {
  const n = PROMPT_IDEAS.length
  if (n < 2) return 0
  const i = Math.floor(random() * (exclude === null ? n : n - 1))
  return exclude !== null && i >= exclude ? i + 1 : i
}
