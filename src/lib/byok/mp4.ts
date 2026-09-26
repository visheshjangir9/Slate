/**
 * Strict enough MP4 (ISO BMFF) validation for provider output.
 *
 * A file counts as a playable video only when it has an `ftyp` box first, a
 * `moov` box with a movie header giving a positive duration, and at least one
 * track whose handler is `vide` with non-zero dimensions. HTML, JSON, a
 * truncated download or an audio-only file all fail here, before anything is
 * stored or marked complete.
 */
export interface Mp4Info {
  brand: string
  durationS: number
  width: number
  height: number
}

interface Box { type: string; start: number; end: number; body: number }

function boxes(b: Uint8Array, from: number, to: number): Box[] {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const out: Box[] = []
  let i = from
  while (i + 8 <= to) {
    let size = dv.getUint32(i)
    const type = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7])
    let body = i + 8
    if (size === 1) {
      if (i + 16 > to) break
      const hi = dv.getUint32(i + 8), lo = dv.getUint32(i + 12)
      size = hi * 2 ** 32 + lo
      body = i + 16
    } else if (size === 0) {
      size = to - i
    }
    if (size < body - i || i + size > to) break
    out.push({ type, start: i, end: i + size, body })
    i += size
  }
  return out
}

const child = (b: Uint8Array, box: Box, type: string) => boxes(b, box.body, box.end).find((x) => x.type === type)

export function inspectMp4(b: Uint8Array): Mp4Info | null {
  if (b.byteLength < 64) return null
  const top = boxes(b, 0, b.byteLength)
  if (top[0]?.type !== 'ftyp') return null
  const brand = String.fromCharCode(...b.subarray(top[0].body, top[0].body + 4))
  const moov = top.find((x) => x.type === 'moov')
  if (!moov) return null
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)

  const mvhd = child(b, moov, 'mvhd')
  if (!mvhd) return null
  const v = b[mvhd.body]
  const timescale = v === 1 ? dv.getUint32(mvhd.body + 20) : dv.getUint32(mvhd.body + 12)
  const duration = v === 1 ? dv.getUint32(mvhd.body + 24) * 2 ** 32 + dv.getUint32(mvhd.body + 28) : dv.getUint32(mvhd.body + 16)
  if (!timescale || !duration) return null

  for (const trak of boxes(b, moov.body, moov.end).filter((x) => x.type === 'trak')) {
    const mdia = child(b, trak, 'mdia')
    const hdlr = mdia && child(b, mdia, 'hdlr')
    if (!hdlr) continue
    const handler = String.fromCharCode(...b.subarray(hdlr.body + 8, hdlr.body + 12))
    if (handler !== 'vide') continue
    const tkhd = child(b, trak, 'tkhd')
    if (!tkhd) continue
    // Width and height are 16.16 fixed point at the end of the track header.
    const w = dv.getUint32(tkhd.end - 8) >>> 16
    const h = dv.getUint32(tkhd.end - 4) >>> 16
    if (w > 0 && h > 0 && w <= 8192 && h <= 8192) return { brand, durationS: duration / timescale, width: w, height: h }
  }
  return null
}
