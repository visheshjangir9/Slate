import { ArrayBufferTarget, Muxer } from 'mp4-muxer'
import type { Dimensions } from './types'

export interface EncodeOptions {
  dims: Dimensions
  fps: number
  /** Target bits per second, handed straight to the encoder. */
  bitrate: number
  totalFrames: number
  /** Paint frame `index` (normalised time `t`) onto the supplied context. */
  renderFrame: (ctx: CanvasRenderingContext2D, index: number, t: number) => void
  onProgress?: (done: number, total: number) => void
  signal?: AbortSignal
}

export interface EncodeResult {
  blob: Blob
  container: 'mp4' | 'webm'
  codec: string
  dims: Dimensions
  durationS: number
  bytes: number
  elapsedMs: number
}

/**
 * H.264 profiles from most to least capable. Browsers differ on which levels
 * they will accept for 1080p, so the first supported config wins rather than
 * hardcoding one and failing on Safari.
 */
const AVC_CANDIDATES = ['avc1.640034', 'avc1.640028', 'avc1.4d0032', 'avc1.4d0028', 'avc1.42E01E']

export const hasWebCodecs = (): boolean =>
  typeof globalThis !== 'undefined' &&
  typeof (globalThis as { VideoEncoder?: unknown }).VideoEncoder === 'function' &&
  typeof (globalThis as { VideoFrame?: unknown }).VideoFrame === 'function'

async function pickCodec(dims: Dimensions, bitrate: number, fps: number): Promise<string | null> {
  for (const codec of AVC_CANDIDATES) {
    try {
      const { supported } = await VideoEncoder.isConfigSupported({
        codec, width: dims.width, height: dims.height, bitrate, framerate: fps,
      })
      if (supported) return codec
    } catch {
      // Probing an unsupported config throws on some browsers; keep looking.
    }
  }
  return null
}

function makeCanvas(dims: Dimensions): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = dims.width
  canvas.height = dims.height
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('2D canvas context unavailable')
  return { canvas, ctx }
}

/** Real H.264 in a real MP4 container via WebCodecs. The primary path. */
export async function encodeToMp4(opts: EncodeOptions): Promise<EncodeResult> {
  const { dims, fps, bitrate, totalFrames, renderFrame, onProgress, signal } = opts
  const started = performance.now()

  if (!hasWebCodecs()) throw new Error('WebCodecs unavailable')
  const codec = await pickCodec(dims, bitrate, fps)
  if (!codec) throw new Error('No supported H.264 configuration for this size')

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: dims.width, height: dims.height, frameRate: fps },
    fastStart: 'in-memory',
  })

  let encodeError: Error | null = null
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { encodeError = e instanceof Error ? e : new Error(String(e)) },
  })
  encoder.configure({ codec, width: dims.width, height: dims.height, bitrate, framerate: fps })

  const { canvas, ctx } = makeCanvas(dims)
  const frameDurUs = Math.round(1_000_000 / fps)
  const gop = Math.max(1, Math.round(fps * 2))

  try {
    for (let i = 0; i < totalFrames; i++) {
      if (signal?.aborted) throw new Error('Cancelled')
      if (encodeError) throw encodeError

      renderFrame(ctx, i, totalFrames === 1 ? 0 : i / (totalFrames - 1))

      const frame = new VideoFrame(canvas, { timestamp: i * frameDurUs, duration: frameDurUs })
      encoder.encode(frame, { keyFrame: i % gop === 0 })
      frame.close()

      // Yield so the encoder queue drains and the tab stays responsive.
      if (encoder.encodeQueueSize > 8) {
        await new Promise<void>((r) => setTimeout(r, 0))
      }
      onProgress?.(i + 1, totalFrames)
    }

    await encoder.flush()
    if (encodeError) throw encodeError
    muxer.finalize()
  } finally {
    if (encoder.state !== 'closed') encoder.close()
  }

  const buffer = muxer.target.buffer
  const blob = new Blob([buffer], { type: 'video/mp4' })
  return {
    blob, container: 'mp4', codec, dims,
    durationS: totalFrames / fps,
    bytes: blob.size,
    elapsedMs: Math.round(performance.now() - started),
  }
}

/**
 * MediaRecorder fallback for browsers without WebCodecs. Records in real time,
 * so it is slower, but it still yields a genuine playable file rather than an
 * error screen.
 */
export async function encodeToWebm(opts: EncodeOptions): Promise<EncodeResult> {
  const { dims, fps, bitrate, totalFrames, renderFrame, onProgress, signal } = opts
  const started = performance.now()
  const { canvas, ctx } = makeCanvas(dims)

  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    .find((m) => MediaRecorder.isTypeSupported(m))
  if (!mime) throw new Error('MediaRecorder supports no WebM profile here')

  const stream = canvas.captureStream(fps)
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate })
  const chunks: BlobPart[] = []
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }

  const done = new Promise<void>((resolve) => { rec.onstop = () => resolve() })
  rec.start()

  const frameMs = 1000 / fps
  for (let i = 0; i < totalFrames; i++) {
    if (signal?.aborted) { rec.stop(); throw new Error('Cancelled') }
    renderFrame(ctx, i, totalFrames === 1 ? 0 : i / (totalFrames - 1))
    onProgress?.(i + 1, totalFrames)
    await new Promise<void>((r) => setTimeout(r, frameMs))
  }

  rec.stop()
  await done
  stream.getTracks().forEach((t) => t.stop())

  const blob = new Blob(chunks, { type: mime })
  return {
    blob, container: 'webm', codec: mime, dims,
    durationS: totalFrames / fps,
    bytes: blob.size,
    elapsedMs: Math.round(performance.now() - started),
  }
}

/** Preferred path with automatic degradation. Always returns a real video file. */
export async function encodeVideo(opts: EncodeOptions): Promise<EncodeResult> {
  if (hasWebCodecs()) {
    try {
      return await encodeToMp4(opts)
    } catch (err) {
      if (opts.signal?.aborted) throw err
      // Fall through: a real WebM beats a broken MP4.
    }
  }
  return encodeToWebm(opts)
}
