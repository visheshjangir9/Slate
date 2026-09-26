import {
  type AspectRatio,
  type Bitrate,
  type Dimensions,
  type Resolution,
  DEFAULT_FPS,
} from './types'

/** Width-to-height ratio for each supported aspect. */
const RATIO: Record<AspectRatio, number> = {
  '21:9': 21 / 9,
  '16:9': 16 / 9,
  '4:3': 4 / 3,
  '1:1': 1,
  '4:5': 4 / 5,
  '9:16': 9 / 16,
}

/** A resolution tier names the MINOR axis, the way 720p does in practice. */
const MINOR_AXIS: Record<Resolution, number> = {
  '480p': 480,
  '720p': 720,
  '1080p': 1080,
}

/** H.264 requires even dimensions on both axes; odd values fail to encode. */
export const roundEven = (n: number): number => Math.max(2, Math.round(n / 2) * 2)

export const ratioOf = (aspect: AspectRatio): number => RATIO[aspect]

/**
 * Pixel dimensions for an aspect + resolution pair.
 *
 * The tier pins the shorter side, so 720p is 1280x720 in landscape and
 * 720x1280 in portrait — matching how every video tool labels these.
 */
export function dimensionsFor(aspect: AspectRatio, resolution: Resolution): Dimensions {
  const ratio = RATIO[aspect]
  const minor = MINOR_AXIS[resolution]
  return ratio >= 1
    ? { width: roundEven(minor * ratio), height: roundEven(minor) }
    : { width: roundEven(minor), height: roundEven(minor / ratio) }
}

/** Bits per pixel per frame for each tier. Standard ~= half the data of High. */
const BPP: Record<Bitrate, number> = { standard: 0.1, high: 0.2 }

const MIN_BITRATE = 500_000
const MAX_BITRATE = 40_000_000

/**
 * Target encoder bitrate. This is the one setting that is genuinely a lie in
 * most clone projects — here it is passed straight to VideoEncoder, so the
 * two tiers produce measurably different file sizes.
 */
export function bitrateFor(dims: Dimensions, tier: Bitrate, fps: number = DEFAULT_FPS): number {
  const raw = dims.width * dims.height * fps * BPP[tier]
  return Math.round(Math.min(MAX_BITRATE, Math.max(MIN_BITRATE, raw)))
}

export function frameCount(durationS: number, fps: number = DEFAULT_FPS): number {
  return Math.max(1, Math.round(durationS * fps))
}
