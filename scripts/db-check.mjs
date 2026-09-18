/** Verify the Supabase project is ready. Prints no secrets. */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#') || !t.includes('=')) continue
  const [k, ...rest] = t.split('=')
  env[k.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '')
}
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })

let ready = true

// NB: do NOT use { head: true } here. supabase-js does not surface a 404 for a
// HEAD request, so a missing table reports as error:null / count:null and this
// check silently passes. Use a real body-returning select instead.
const { data: probe, error: tErr } = await sb.from('generations').select('id').limit(1)
if (tErr || probe === null) {
  console.log(`  table generations : MISSING (${tErr?.code ?? 'no data'} ${(tErr?.message ?? '').slice(0, 70)})`)
  ready = false
} else {
  const { count } = await sb.from('generations').select('*', { count: 'exact', head: true })
  console.log(`  table generations : OK (${count ?? 0} rows)`)
}

const { data: buckets } = await sb.storage.listBuckets()
for (const id of ['outputs', 'references']) {
  const b = (buckets ?? []).find((x) => x.id === id)
  if (b) console.log(`  bucket ${id.padEnd(11)}: OK (public=${b.public}, limit=${b.file_size_limit ?? 'default'})`)
  else { console.log(`  bucket ${id.padEnd(11)}: MISSING`); ready = false }
}

console.log(ready ? '\nREADY' : '\nNOT READY — apply supabase/schema.sql')
process.exit(ready ? 0 : 1)
