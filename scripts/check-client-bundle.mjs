#!/usr/bin/env node
/**
 * After `next build`, prove no server secret reached the browser bundle.
 *
 * Usage: node scripts/check-client-bundle.mjs
 *
 * Scans every file Next serves to browsers (.next/static) for the value of
 * each server-only variable present in the environment. Exits 1 on a hit,
 * printing only the variable's name. To test without real keys, build with
 * dummy canary values (see README, "Security checks").
 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const SERVER_ONLY = [
  'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY', 'LTXV_API_KEY',
  'CLOUDFLARE_API_TOKEN', 'DEVICE_COOKIE_SECRET',
]
const STATIC = new URL('../.next/static/', import.meta.url).pathname

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else yield p
  }
}

const watched = SERVER_ONLY.filter((n) => (process.env[n] ?? '').length >= 8)
if (!watched.length) {
  console.error('No server secrets in the environment to look for. Set canary values and rebuild.')
  process.exit(2)
}
let scanned = 0
const hits = []
for await (const file of walk(STATIC)) {
  const text = await readFile(file, 'utf8')
  scanned++
  for (const name of watched) if (text.includes(process.env[name])) hits.push(`${name} in ${file.slice(STATIC.length)}`)
}
if (hits.length) {
  console.error(`LEAK: server secret found in the browser bundle:\n  ${hits.join('\n  ')}`)
  process.exit(1)
}
console.log(`OK: ${scanned} browser files scanned, none contain ${watched.join(', ')}.`)
