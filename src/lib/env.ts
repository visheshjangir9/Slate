import 'server-only'

/**
 * Server-only environment access.
 *
 * Importing this from a client component is a build error, which is the point:
 * SUPABASE_SECRET_KEY bypasses row-level security, so it must never be able to
 * reach a browser bundle. Values are read lazily and never logged.
 */
export interface SupabaseEnv {
  url: string
  secretKey: string
}

/** Present without revealing anything: used to choose an adapter, not to log. */
export function hasSupabaseEnv(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
}

export function supabaseEnv(): SupabaseEnv {
  const url = process.env.SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (!url || !secretKey) {
    // Names only. Never interpolate the values into an error message.
    throw new Error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY')
  }
  return { url: url.replace(/\/$/, ''), secretKey }
}

export const OUTPUTS_BUCKET = 'outputs'
export const REFERENCES_BUCKET = 'references'
