/**
 * Create the storage buckets Slate needs. Idempotent.
 * Reads .env.local directly so it can run outside Next. Never prints a key.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#') || !t.includes('=')) continue
  const [k, ...rest] = t.split('=')
  env[k.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '')
}

const url = env.SUPABASE_URL
const key = env.SUPABASE_SECRET_KEY
if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local')
  process.exit(1)
}

const sb = createClient(url, key, { auth: { persistSession: false } })

const BUCKETS = [
  {
    id: 'outputs',
    public: true,
    fileSizeLimit: 50 * 1024 * 1024,
    allowedMimeTypes: ['video/mp4', 'video/webm', 'image/jpeg', 'image/png', 'image/webp'],
  },
  {
    id: 'references',
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
]

const { data: existing, error: listErr } = await sb.storage.listBuckets()
if (listErr) { console.error('listBuckets failed:', listErr.message); process.exit(1) }
const have = new Set((existing ?? []).map((b) => b.id))

for (const b of BUCKETS) {
  const opts = {
    public: b.public,
    fileSizeLimit: b.fileSizeLimit,
    allowedMimeTypes: b.allowedMimeTypes,
  }
  if (have.has(b.id)) {
    const { error } = await sb.storage.updateBucket(b.id, opts)
    console.log(`  ${b.id.padEnd(12)} exists -> ${error ? 'update FAILED: ' + error.message : 'updated'}`)
  } else {
    const { error } = await sb.storage.createBucket(b.id, opts)
    console.log(`  ${b.id.padEnd(12)} ${error ? 'create FAILED: ' + error.message : 'created'}`)
  }
}

const { data: after } = await sb.storage.listBuckets()
console.log('\nbuckets now:', (after ?? []).map((b) => `${b.id}(public=${b.public})`).join(', ') || 'none')
