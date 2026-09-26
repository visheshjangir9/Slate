/** Shared formatting. Pure, so it can be unit tested without a DOM. */

/** mm:ss for a media time in seconds. Clamps junk (NaN, Infinity, negatives) to 0:00. */
export function timecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function fileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return '—'
  if (bytes < 1_000) return `${Math.max(0, Math.round(bytes))} B`
  if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(0)} KB`
  return `${(bytes / 1_000_000).toFixed(2)} MB`
}

/** Compact relative time: "just now", "4m ago", "3h ago", "2d ago". */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const s = Math.max(0, (now - then) / 1000)
  if (s < 45) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86_400)}d ago`
}

/**
 * A link that downloads rather than navigates.
 *
 * The download attribute is ignored for cross-origin URLs, which is what a
 * Supabase Storage public URL is. Storage honours `?download=<name>` by
 * sending Content-Disposition: attachment, so the file really saves.
 */
export function downloadHref(url: string, filename: string): string {
  if (!/\/storage\/v1\/object\/public\//.test(url)) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}download=${encodeURIComponent(filename)}`
}
