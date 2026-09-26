import jpeg from 'jpeg-js'

/** A fake key that looks real enough to pass validation. Never a real credential. */
export const FAKE_GOOGLE_KEY = 'AIzaTEST-not-a-real-key-000000000000000'
export const FAKE_OPENAI_KEY = 'sk-test-not-a-real-key-0000000000000000'

/** The smallest valid PNG header: signature + IHDR with the given size. */
export function pngBytes(width: number, height: number): Uint8Array {
  const b = new Uint8Array(33)
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
  const dv = new DataView(b.buffer)
  dv.setUint32(16, width)
  dv.setUint32(20, height)
  b.set([8, 6, 0, 0, 0], 24)
  return b
}

/** A real, decodable JPEG (flat grey). */
export function jpegBytes(width: number, height: number): Uint8Array {
  const data = Buffer.alloc(width * height * 4, 128)
  return new Uint8Array(jpeg.encode({ width, height, data }, 80).data)
}

export const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64')

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** Every argument ever passed to console.*, joined, for "the key never appears" checks. */
export function captureConsole() {
  const lines: string[] = []
  const methods = ['log', 'info', 'warn', 'error', 'debug'] as const
  const originals = methods.map((m) => console[m])
  methods.forEach((m) => {
    console[m] = (...args: unknown[]) => { lines.push(args.map((a) => (a instanceof Error ? `${a.message} ${a.stack}` : String(a))).join(' ')) }
  })
  return {
    text: () => lines.join('\n'),
    restore: () => methods.forEach((m, i) => { console[m] = originals[i] }),
  }
}

export const FAKE_OPENROUTER_KEY = 'sk-or-test-not-a-real-key-000000000000'
export const FAKE_ANTHROPIC_KEY = 'sk-ant-test-not-a-real-key-00000000000'
export const FAKE_MISTRAL_KEY = 'test-mistral-not-a-real-key-000000000'

function box(type: string, ...parts: Uint8Array[]): Uint8Array {
  const len = 8 + parts.reduce((n, p) => n + p.byteLength, 0)
  const out = new Uint8Array(len)
  new DataView(out.buffer).setUint32(0, len)
  out.set(new TextEncoder().encode(type), 4)
  let o = 8
  for (const p of parts) { out.set(p, o); o += p.byteLength }
  return out
}

function u32s(...n: number[]): Uint8Array {
  const b = new Uint8Array(n.length * 4)
  const dv = new DataView(b.buffer)
  n.forEach((v, i) => dv.setUint32(i * 4, v >>> 0))
  return b
}

/**
 * A structurally valid MP4 (ISO BMFF) container: ftyp, then moov with a
 * movie header and one track of the given handler. No real frames: enough
 * for the validator, which checks structure, not decodability.
 */
export function mp4Bytes({ durationS = 8, width = 1280, height = 720, handler = 'vide' } = {}): Uint8Array {
  const ftyp = box('ftyp', new TextEncoder().encode('isom'), u32s(0x200), new TextEncoder().encode('isomiso2mp41'))
  // mvhd v0: version/flags, created, modified, timescale, duration, then padding.
  const mvhd = box('mvhd', u32s(0, 0, 0, 1000, Math.round(durationS * 1000)), new Uint8Array(80))
  // tkhd v0 is 84 bytes of body; width and height are the last two 16.16 values.
  const tkhdBody = new Uint8Array(84)
  const tv = new DataView(tkhdBody.buffer)
  tv.setUint32(76, width << 16)
  tv.setUint32(80, height << 16)
  const tkhd = box('tkhd', tkhdBody)
  const hdlr = box('hdlr', u32s(0, 0), new TextEncoder().encode(handler), u32s(0, 0, 0), new Uint8Array([0]))
  const trak = box('trak', tkhd, box('mdia', hdlr))
  const moov = box('moov', mvhd, trak)
  const mdat = box('mdat', new Uint8Array(256))
  const out = new Uint8Array(ftyp.byteLength + moov.byteLength + mdat.byteLength)
  out.set(ftyp, 0); out.set(moov, ftyp.byteLength); out.set(mdat, ftyp.byteLength + moov.byteLength)
  return out
}

export const bytesResponse = (bytes: Uint8Array, type = 'video/mp4', status = 200) =>
  new Response(bytes.slice().buffer, { status, headers: { 'Content-Type': type, 'Content-Length': String(bytes.byteLength) } })
