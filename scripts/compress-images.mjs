#!/usr/bin/env node
/**
 * Recompress the static JPEG artwork in /public in place.
 *
 * Usage: node scripts/compress-images.mjs [--dry]
 *
 * mozjpeg at quality 80, progressive, metadata stripped. A file is only
 * rewritten when the result is at least 5% smaller, so running this twice is
 * a no-op. Dimensions never change: the camera-motion engine draws these
 * files onto canvases sized from their pixels.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, extname } from 'node:path'
import sharp from 'sharp'

const ROOT = new URL('../public/', import.meta.url).pathname
const DRY = process.argv.includes('--dry')
const QUALITY = 80

async function* jpegs(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) yield* jpegs(p)
    else if (/\.jpe?g$/i.test(extname(e.name))) yield p
  }
}

let before = 0
let after = 0
for await (const file of jpegs(ROOT)) {
  const input = await readFile(file)
  const output = await sharp(input).jpeg({ quality: QUALITY, mozjpeg: true, progressive: true }).toBuffer()
  const keep = output.length < input.length * 0.95
  before += input.length
  after += keep ? output.length : input.length
  const rel = file.slice(ROOT.length)
  console.log(`${keep ? 'shrunk ' : 'kept   '} ${rel.padEnd(48)} ${kb(input.length)} -> ${kb(keep ? output.length : input.length)}`)
  if (keep && !DRY) await writeFile(file, output)
}
console.log(`\nTotal ${kb(before)} -> ${kb(after)} (${Math.round((1 - after / before) * 100)}% smaller)${DRY ? ' [dry run]' : ''}`)

function kb(n) { return `${Math.round(n / 1024)} KB`.padStart(8) }
