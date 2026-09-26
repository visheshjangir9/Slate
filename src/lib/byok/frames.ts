import 'server-only'
import { blobStore } from '@/lib/store'
import { OUTPUTS_BUCKET } from '@/lib/env'
import { ByokError } from './errors'
import { inspectImage } from './media'
import type { FirstFrame } from './adapters/types'

/**
 * A first frame for image-to-video must be an image the user uploaded to
 * Slate's own storage. It is read back through the blob store, never fetched
 * from an arbitrary URL, so a request can never make the server reach an
 * address the user chose.
 */
const PUBLIC_PREFIX = `/storage/v1/object/public/${OUTPUTS_BUCKET}/`
const SAFE_KEY = /^[A-Za-z0-9._-]{1,200}$/

export function ownStorageKey(url: string): string | null {
  try {
    const u = new URL(url, 'http://slate.local')
    const base = process.env.SUPABASE_URL
    let key: string | null = null
    if (base) {
      // Durable storage: only Slate's own public bucket.
      if (u.origin === new URL(base).origin && u.pathname.startsWith(PUBLIC_PREFIX)) key = decodeURIComponent(u.pathname.slice(PUBLIC_PREFIX.length))
    } else if (u.pathname.startsWith('/api/blob/')) {
      // Local memory storage (development only).
      key = decodeURIComponent(u.pathname.slice('/api/blob/'.length))
    }
    return key && SAFE_KEY.test(key) ? key : null
  } catch {
    return null
  }
}

/** The one URL a provider may fetch the frame from: rebuilt from the key, never taken from the request. */
function canonicalUrl(key: string, original: string): string {
  const base = process.env.SUPABASE_URL
  return base ? `${new URL(base).origin}${PUBLIC_PREFIX}${encodeURIComponent(key)}` : original
}

export async function loadFirstFrame(url: string): Promise<FirstFrame> {
  const key = ownStorageKey(url)
  if (!key) throw new ByokError('byok_unsupported')
  const blob = await blobStore().get(key)
  if (!blob) throw new ByokError('byok_unsupported')
  const info = inspectImage(blob.bytes)
  if (!info) throw new ByokError('byok_unsupported')
  return { bytes: blob.bytes, mime: info.mime, url: canonicalUrl(key, url) }
}
