#!/usr/bin/env node
/**
 * The social preview card: public/og.jpg (1200x630).
 *
 * Usage: node scripts/generate-og-image.mjs
 *
 * Rendered with next/og (Satori) in the site's own type, then saved as a
 * ~100 KB JPEG. A static file rather than a route: crawlers get it instantly,
 * and it stays under the size limits of WhatsApp, LinkedIn and X previews.
 * Every page's og:image and twitter:image point at it (SITE.ogImage in
 * src/lib/site.ts, used by the root layout and pageMetadata).
 */
import { readFile, writeFile } from 'node:fs/promises'
import { createElement as h } from 'react'
import { ImageResponse } from 'next/og.js'
import sharp from 'sharp'

const root = new URL('../', import.meta.url).pathname
const font = (pkg, file) => readFile(`${root}node_modules/@fontsource/${pkg}/files/${file}`)

const W = 1200
const H = 630
const PANEL = 640
const SIGNAL = '#ff8a3d'
const INK = '#f4f1ec'
const GROUND = '#0b0b0c'

// The still, cropped to the right-hand side and passed in as a data URL.
const still = await sharp(`${root}public/media/stills/hero-still-02.jpg`)
  .resize(W - PANEL, H, { fit: 'cover', position: 'centre' })
  .jpeg({ quality: 90 })
  .toBuffer()
const photo = `data:image/jpeg;base64,${still.toString('base64')}`

const mark = h('svg', { width: 40, height: 40, viewBox: '0 0 20 20' },
  h('rect', { x: 2.5, y: 7, width: 15, height: 10.5, rx: 1.8, fill: SIGNAL, fillOpacity: 0.2 }),
  h('rect', { x: 2.5, y: 7, width: 15, height: 10.5, rx: 1.8, stroke: SIGNAL, strokeWidth: 1.1, fill: 'none' }),
  h('path', { d: 'M3 7.4 L7 3.6 L9.7 3.6 L5.7 7.4 Z', fill: SIGNAL }),
  h('path', { d: 'M8.6 7.4 L12.6 3.6 L15.3 3.6 L11.3 7.4 Z', fill: SIGNAL }),
)

const line = (text, color) =>
  h('span', { style: { color, fontFamily: 'Bricolage', fontWeight: 800, fontSize: 104, lineHeight: 0.9, letterSpacing: -5 } }, text)

const card = h('div', { style: { width: W, height: H, display: 'flex', position: 'relative', background: GROUND } },
  h('img', { src: photo, width: W - PANEL, height: H, style: { position: 'absolute', top: 0, left: PANEL } }),
  h('div', { style: {
    position: 'absolute', top: 0, left: 0, width: PANEL, height: H, display: 'flex', flexDirection: 'column',
    justifyContent: 'space-between', padding: '60px 64px', background: GROUND,
  } },
    h('div', { style: { display: 'flex', alignItems: 'center', gap: 14 } },
      mark,
      h('span', { style: { fontFamily: 'Bricolage', fontWeight: 800, fontSize: 38, color: INK, letterSpacing: -1 } }, 'Slate'),
    ),
    h('div', { style: { display: 'flex', flexDirection: 'column' } },
      line('IMAGINE.', INK), line('CREATE.', INK), line('MOVE.', SIGNAL),
      h('span', { style: { marginTop: 30, fontFamily: 'Geist', fontWeight: 500, fontSize: 28, lineHeight: 1.35, color: '#c9c3bb', maxWidth: 500 } },
        'AI video, images and real camera motion in one studio.'),
    ),
  ),
)

const png = await new ImageResponse(card, {
  width: W,
  height: H,
  fonts: [
    { name: 'Bricolage', data: await font('bricolage-grotesque', 'bricolage-grotesque-latin-800-normal.woff'), weight: 800, style: 'normal' },
    { name: 'Geist', data: await font('geist-sans', 'geist-sans-latin-500-normal.woff'), weight: 500, style: 'normal' },
  ],
}).arrayBuffer()

const out = await sharp(Buffer.from(png)).jpeg({ quality: 84, mozjpeg: true }).toBuffer()
await writeFile(`${root}public/og.jpg`, out)
console.log(`Wrote public/og.jpg (${Math.round(out.length / 1024)} KB)`)
