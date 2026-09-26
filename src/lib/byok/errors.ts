/**
 * Every provider failure becomes one of these. Messages are fixed strings:
 * nothing from the provider's response, the request, or the key can reach
 * them, so an error can never carry a credential to a screen or a log.
 *
 * Authentication, model, and capability failures are deliberately separate:
 * a working key with the wrong model is not a bad key.
 */
export const BYOK_ERRORS = {
  byok_auth_failed: 'The provider rejected this key.',
  byok_model_unavailable: 'The provider could not find this model.',
  byok_capability_unavailable: 'This model does not provide that capability.',
  byok_unsupported: 'This request is not compatible with the selected provider adapter.',
  byok_rate_limited: 'The provider rate-limited this request. Try again later.',
  byok_timeout: 'The provider did not respond in time.',
  byok_no_credit: 'The provider account has insufficient quota.',
  byok_blocked: 'The provider declined this prompt.',
  byok_bad_output: 'The provider returned something that was not a usable image.',
  byok_bad_video: 'The provider returned something that was not a playable video.',
  byok_job_failed: 'The provider could not complete this video.',
  byok_job_expired: 'The provider’s job expired before the video could be collected.',
  byok_job_lost: 'Slate stopped following this job. The provider may still finish it on your account.',
  byok_unreachable: 'The provider could not be reached.',
  byok_failed: 'The provider could not complete this request.',
  byok_key_missing: 'Your provider key is not active in this session. Connect it again to continue.',
} as const

export type ByokErrorCode = keyof typeof BYOK_ERRORS

export class ByokError extends Error {
  constructor(public readonly code: ByokErrorCode) {
    super(BYOK_ERRORS[code])
    this.name = 'ByokError'
  }
}
