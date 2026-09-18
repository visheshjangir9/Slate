/** Shared vocabulary for the Slate generation engine. Pure types, no runtime deps. */

export const ASPECT_RATIOS = ['21:9', '16:9', '4:3', '1:1', '4:5', '9:16'] as const
export type AspectRatio = (typeof ASPECT_RATIOS)[number]

export const RESOLUTIONS = ['480p', '720p', '1080p'] as const
export type Resolution = (typeof RESOLUTIONS)[number]

export const BITRATES = ['standard', 'high'] as const
export type Bitrate = (typeof BITRATES)[number]

export const MIN_DURATION_S = 4
export const MAX_DURATION_S = 30
export const DEFAULT_FPS = 30

export interface Dimensions {
  width: number
  height: number
}

/**
 * A camera transform at one instant.
 *
 * `x` and `y` are offsets of the image centre expressed as a fraction of the
 * DESTINATION width/height, so they stay resolution-independent. `rotate` is
 * degrees clockwise. `scale` is relative to the cover-fit baseline, so 1 means
 * "exactly fills the frame".
 */
export interface Transform {
  scale: number
  x: number
  y: number
  rotate: number
}

export type MotionId =
  | 'static'
  | 'dolly_in'
  | 'dolly_out'
  | 'pan_left'
  | 'pan_right'
  | 'tilt_up'
  | 'tilt_down'
  | 'crash_zoom_in'
  | 'crash_zoom_out'
  | 'orbit_left'
  | 'orbit_right'
  | 'crane_up'
  | 'handheld'

export interface MotionPreset {
  id: MotionId
  label: string
  description: string
  badge?: 'TOP' | 'NEW'
  /** Transform at normalised time t in [0,1]. */
  at(t: number): Transform
}

export interface RenderSpec {
  motion: MotionId
  durationS: number
  aspectRatio: AspectRatio
  resolution: Resolution
  bitrate: Bitrate
  fps?: number
  /** Deterministic jitter source for handheld-style motion. */
  seed?: number
}
