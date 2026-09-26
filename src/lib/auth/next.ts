/**
 * Where to send someone after signing in. Only same-site paths, never an auth
 * page, so the parameter can't bounce anyone off-site or into a loop.
 */
export function safeNext(raw: string | null | undefined, fallback = '/studio'): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback
  if (/^\/(sign-in|login|api)(\/|\?|$)/.test(raw)) return fallback
  return raw
}

/** Rebuild a path with its query, for use as a `next` target. */
export function withQuery(path: string, params: Record<string, string | string[] | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach((x) => q.append(k, x))
    else if (v !== undefined) q.set(k, v)
  }
  const s = q.toString()
  return s ? `${path}?${s}` : path
}
