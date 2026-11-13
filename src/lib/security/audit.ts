/**
 * Suspicious-activity log.
 *
 * One JSON line per event under a fixed tag, so the hosting platform's log
 * search (or a log drain) can filter on `[slate:security]` and alert on a
 * burst. Only facts about the request are written: never a password, token,
 * key, email address or request body.
 */
export type SecurityEventName =
  | 'rate_limited'
  | 'cross_origin_blocked'
  | 'auth_failed'
  | 'payment_rejected'
  | 'upload_rejected'
  | 'still_denied'

type Detail = Record<string, string | number | boolean | undefined>

export function securityEvent(event: SecurityEventName, detail: Detail = {}): void {
  console.warn('[slate:security]', JSON.stringify({ event, at: new Date().toISOString(), ...detail }))
}
