#!/usr/bin/env node
/**
 * Raster icons from src/app/icon.svg.
 *
 * Usage: node scripts/generate-icons.mjs
 *
 *   src/app/favicon.ico      16, 32 and 48px, for browsers and tools that ignore SVG icons
 *   src/app/apple-icon.png   180px, full-bleed: iOS applies its own corner mask
 *   public/icon-192.png      web app manifest
 *   public/icon-512.png      web app manifest, also the maskable icon
 *
 * Re-run after changing icon.svg and commit the outputs.
 */
import { readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const root = new URL('../', import.meta.url).pathname
const svg = await readFile(`${root}src/app/icon.svg`, 'utf8')
const GROUND = '#0a0a0b'

/** The mark without its rounded tile, on a square ground with breathing room. */
function fullBleed(padding) {
  const inner = svg
    .replace(/<svg[^>]*>/, '')
    .replace('</svg>', '')
    .replace(/<rect width="20" height="20"[^>]*\/>/, '')
  const s = 20 + padding * 2
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-padding} ${-padding} ${s} ${s}">` +
      `<rect x="${-padding}" y="${-padding}" width="${s}" height="${s}" fill="${GROUND}"/>${inner}</svg>`,
  )
}

const png = (input, size) => sharp(input, { density: 600 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer()

/** ICO container holding PNG payloads (supported by every browser since IE Vista-era). */
function ico(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  const dir = Buffer.alloc(16 * images.length)
  let offset = 6 + dir.length
  images.forEach(({ size, data }, i) => {
    const o = i * 16
    dir.writeUInt8(size >= 256 ? 0 : size, o)
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1)
    dir.writeUInt8(0, o + 2)
    dir.writeUInt8(0, o + 3)
    dir.writeUInt16LE(1, o + 4)
    dir.writeUInt16LE(32, o + 6)
    dir.writeUInt32LE(data.length, o + 8)
    dir.writeUInt32LE(offset, o + 12)
    offset += data.length
  })
  return Buffer.concat([header, dir, ...images.map((i) => i.data)])
}

const tile = Buffer.from(svg)
const sizes = [16, 32, 48]
const icoImages = await Promise.all(sizes.map(async (size) => ({ size, data: await png(tile, size) })))
await writeFile(`${root}src/app/favicon.ico`, ico(icoImages))
await writeFile(`${root}src/app/apple-icon.png`, await png(fullBleed(2), 180))
await writeFile(`${root}public/icon-192.png`, await png(fullBleed(2), 192))
// Maskable: the mark stays inside the 80% safe zone.
await writeFile(`${root}public/icon-512.png`, await png(fullBleed(4), 512))
console.log('Wrote favicon.ico, apple-icon.png, icon-192.png, icon-512.png')
