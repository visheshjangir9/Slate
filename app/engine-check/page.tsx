'use client'

/**
 * Temporary engine harness (Phase 2 verification only — not part of the product).
 * Exercises motion -> render -> encode end to end and reports hard numbers.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ASPECT_RATIOS, BITRATES, RESOLUTIONS, MOTIONS, DEFAULT_FPS,
  type AspectRatio, type Bitrate, type MotionId, type Resolution,
  bitrateFor, dimensionsFor, frameCount, getMotion,
  drawFrame, drawTestPattern, applyVignette, hasWebCodecs,
  encodeVideo, type EncodeResult,
} from '@/lib/engine'

type Status = 'idle' | 'sourcing' | 'encoding' | 'done' | 'error'

export default function EngineCheck() {
  const [motion, setMotion] = useState<MotionId>('dolly_in')
  const [aspect, setAspect] = useState<AspectRatio>('16:9')
  const [resolution, setResolution] = useState<Resolution>('720p')
  const [bitrate, setBitrate] = useState<Bitrate>('standard')
  const [duration, setDuration] = useState(4)
  const [useRemote, setUseRemote] = useState(false)
  // Capability detection must happen AFTER mount: the server has no
  // VideoEncoder, so probing during render desynchronises hydration.
  const [webcodecs, setWebcodecs] = useState<boolean | null>(null)
  useEffect(() => setWebcodecs(hasWebCodecs()), [])

  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<EncodeResult | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const dims = dimensionsFor(aspect, resolution)
  const total = frameCount(duration, DEFAULT_FPS)
  const bps = bitrateFor(dims, bitrate, DEFAULT_FPS)

  const run = useCallback(async () => {
    setStatus('sourcing'); setError(null); setResult(null); setProgress(0)
    if (url) URL.revokeObjectURL(url)
    setUrl(null)
    const ac = new AbortController()
    abortRef.current = ac

    try {
      let source: HTMLImageElement | HTMLCanvasElement
      if (useRemote) {
        // Verified 2026-09-18: Pollinations returns 403 {"error":"Missing Turnstile
        // token"} whenever an Origin header is present, but 200 from a serverless
        // request with no Origin. The browser therefore can NEVER fetch the still
        // directly -- it must be proxied by our server (Phase 3). This fixture is a
        // genuine Pollinations FLUX output, served same-origin, so the engine can be
        // validated against photographic entropy today.
        const img = new Image()
        await new Promise<void>((res, rej) => {
          img.onload = () => res()
          img.onerror = () => rej(new Error('fixture load failed'))
          img.src = '/fixtures/sample-still.jpg'
        })
        source = img
      } else {
        const c = document.createElement('canvas')
        c.width = dims.width; c.height = dims.height
        const cx = c.getContext('2d')
        if (!cx) throw new Error('no 2d context')
        drawTestPattern(cx, dims)
        source = c
      }

      const preset = getMotion(motion, 7)
      setStatus('encoding')
      const out = await encodeVideo({
        dims, fps: DEFAULT_FPS, bitrate: bps, totalFrames: total, signal: ac.signal,
        renderFrame: (ctx, _i, t) => {
          drawFrame(ctx, source, dims, preset.at(t))
          applyVignette(ctx, dims)
        },
        onProgress: (d, n) => setProgress(Math.round((d / n) * 100)),
      })

      setResult(out)
      setUrl(URL.createObjectURL(out.blob))
      setStatus('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStatus('error')
    }
  }, [aspect, resolution, bitrate, duration, motion, useRemote, dims, total, bps, url])

  const busy = status === 'sourcing' || status === 'encoding'

  return (
    <main style={{ fontFamily: 'ui-sans-serif, system-ui', padding: 24, maxWidth: 940, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Slate — engine check</h1>
      <p style={{ color: '#666', marginTop: 0 }}>
        WebCodecs: <b data-testid="webcodecs">
          {webcodecs === null ? 'checking…' : webcodecs ? 'available' : 'MISSING (WebM fallback)'}
        </b>
      </p>

      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', margin: '16px 0' }}>
        <label>Motion<br />
          <select data-testid="motion" value={motion} onChange={(e) => setMotion(e.target.value as MotionId)} style={{ width: '100%' }}>
            {MOTIONS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
        <label>Aspect<br />
          <select data-testid="aspect" value={aspect} onChange={(e) => setAspect(e.target.value as AspectRatio)} style={{ width: '100%' }}>
            {ASPECT_RATIOS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label>Resolution<br />
          <select data-testid="resolution" value={resolution} onChange={(e) => setResolution(e.target.value as Resolution)} style={{ width: '100%' }}>
            {RESOLUTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label>Bitrate<br />
          <select data-testid="bitrate" value={bitrate} onChange={(e) => setBitrate(e.target.value as Bitrate)} style={{ width: '100%' }}>
            {BITRATES.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        <label>Duration {duration}s<br />
          <input data-testid="duration" type="range" min={4} max={30} value={duration}
                 onChange={(e) => setDuration(Number(e.target.value))} style={{ width: '100%' }} />
        </label>
        <label style={{ alignSelf: 'end' }}>
          <input data-testid="remote" type="checkbox" checked={useRemote} onChange={(e) => setUseRemote(e.target.checked)} />{' '}
          real AI still (fixture)
        </label>
      </div>

      <p style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, color: '#444' }} data-testid="spec">
        {dims.width}x{dims.height} · {total} frames @ {DEFAULT_FPS}fps · {(bps / 1e6).toFixed(2)} Mbps
      </p>

      <button data-testid="run" onClick={run} disabled={busy}
              style={{ padding: '10px 18px', fontSize: 15, cursor: busy ? 'wait' : 'pointer' }}>
        {busy ? `${status}… ${progress}%` : 'Generate'}
      </button>

      <div data-testid="status" style={{ marginTop: 16 }}>status: {status}</div>
      {error && <pre data-testid="error" style={{ color: '#b00', whiteSpace: 'pre-wrap' }}>{error}</pre>}

      {result && url && (
        <section style={{ marginTop: 16 }}>
          <pre data-testid="result" style={{ background: '#f5f5f5', padding: 12, fontSize: 13 }}>
{JSON.stringify({
  container: result.container,
  codec: result.codec,
  dims: `${result.dims.width}x${result.dims.height}`,
  durationS: result.durationS,
  bytes: result.bytes,
  megabytes: +(result.bytes / 1e6).toFixed(2),
  measuredMbps: +((result.bytes * 8) / result.durationS / 1e6).toFixed(2),
  elapsedMs: result.elapsedMs,
}, null, 2)}
          </pre>
          <video data-testid="video" src={url} controls loop autoPlay muted
                 style={{ maxWidth: '100%', border: '1px solid #ddd' }} />
          <p><a data-testid="download" href={url} download={`slate-${motion}.${result.container}`}>download</a></p>
        </section>
      )}
    </main>
  )
}
