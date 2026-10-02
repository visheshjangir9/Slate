'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { fetchFormToken, signIn, signUp, useAuth, type AuthError } from '@/lib/client/auth'
import { safeNext } from '@/lib/auth/next'
import { EMAIL_MAX, PASSWORD_MAX, validateCredentials, type CredentialErrors } from '@/lib/auth/validate'
import { MotionPreview, useLoadedImage } from '@/components/studio/MotionPreview'
import { Mark } from '@/components/shell/Wordmark'
import { Button, FieldLabel, Segmented, buttonClass } from '@/components/ui/primitives'
import { IconArrowRight } from '@/components/ui/icons'

type Mode = 'signin' | 'signup'
type Fields = CredentialErrors
type Touched = Partial<Record<keyof Fields, boolean>>

/** Matches MIN_FILL_MS on the server, plus margin for the token's trip here. */
const TOKEN_MIN_AGE_MS = 2_200
/** Refresh well inside the server's two-hour limit. */
const TOKEN_MAX_AGE_MS = 60 * 60_000
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

const inputCls = (bad: boolean) =>
  `h-12 w-full rounded-[var(--radius-ctl)] border bg-[#0e0e0f] px-3.5 text-[15px] text-ink placeholder:text-ink-4
   transition-colors focus:outline-none ${bad ? 'border-danger/70' : 'border-line-strong focus:border-ink-3'}`

export function LoginPanel() {
  const params = useSearchParams()
  const next = safeNext(params.get('next'))
  const auth = useAuth()
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'signup' ? 'signup' : 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [fields, setFields] = useState<Fields>({})
  const [touched, setTouched] = useState<Touched>({})
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<AuthError | null>(null)
  // Bot protection: the honeypot stays empty for people; the token is signed by the server.
  const [website, setWebsite] = useState('')
  const token = useRef<{ value: string; at: number } | null>(null)
  const art = useLoadedImage('/explore/featured-hero.jpg')

  // Only sign-up needs a token: fetch one as soon as that form is on screen.
  useEffect(() => {
    if (mode !== 'signup' || token.current) return
    let alive = true
    void fetchFormToken().then((value) => { if (alive && value) token.current = { value, at: Date.now() } })
    return () => { alive = false }
  }, [mode])

  /** A token old enough to pass the server's speed check, fetched again if it is missing or stale. */
  const readyToken = async (): Promise<string | null> => {
    if (!token.current || Date.now() - token.current.at > TOKEN_MAX_AGE_MS) {
      const value = await fetchFormToken()
      token.current = value ? { value, at: Date.now() } : null
    }
    if (!token.current) return null
    const wait = TOKEN_MIN_AGE_MS - (Date.now() - token.current.at)
    if (wait > 0) await sleep(wait) // a password manager can fill and submit faster than the check allows
    return token.current.value
  }

  // Errors appear once a field has been left (or on submit), then update as you type.
  const revalidate = (nextTouched: Touched, nextEmail = email, nextPassword = password) => {
    const all = validateCredentials(mode, nextEmail, nextPassword)
    setFields({
      ...(nextTouched.email && all.email ? { email: all.email } : {}),
      ...(nextTouched.password && all.password ? { password: all.password } : {}),
    })
  }
  const blur = (field: keyof Fields) => {
    const next = { ...touched, [field]: true }
    setTouched(next)
    revalidate(next)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const local = validateCredentials(mode, email, password)
    setTouched({ email: true, password: true })
    setFields(local)
    if (Object.keys(local).length) {
      document.getElementById(local.email ? 'email' : 'password')?.focus()
      return
    }

    setBusy(true)
    const guard = { website, formToken: mode === 'signup' ? await readyToken() : null }
    const r = mode === 'signin' ? await signIn(email.trim(), password, guard) : await signUp(email.trim(), password, guard)
    if (!r.ok) {
      setFields((r.error.fields ?? {}) as Fields)
      setError(r.error.fields ? null : r.error)
      setBusy(false)
      return
    }
    // Hard navigation, so every view loads fresh under the new session.
    window.location.assign(next)
  }

  const switchMode = (m: Mode) => { setMode(m); setError(null); setFields({}); setTouched({}) }

  return (
    <main id="main" className="grid flex-1 lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-line lg:block">
        <div className="graded absolute inset-0">
          <MotionPreview motion="dolly_in" source={art} aspect={4 / 5} longEdge={1100} durationMs={8000}
            label="Sample frame with a live Dolly In, the same transform the renderer uses" />
        </div>
        <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_180px_60px_rgba(8,8,9,0.6)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0c0c0d]/95 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-10 xl:p-14">
          <p aria-hidden className="display text-[clamp(2.6rem,5vw,5rem)] uppercase leading-[0.86] tracking-[-0.05em]">
            Imagine.<br />Create.<br /><span className="text-signal">Move.</span>
          </p>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-2">
            Your Studio, history and assets live in your account, on any browser.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center px-4 py-14 sm:px-8">
        <div className="w-full max-w-[400px]">
          <span className="flex items-center gap-2 lg:hidden"><Mark size={26} /></span>

          {auth.status === 'user' ? (
            <div>
              <p className="eyebrow text-ink-3">Signed in</p>
              <h1 className="display display-s mt-3 break-all">{auth.user?.email}</h1>
              <Link href={next} className={buttonClass('contrast', 'lg', 'mt-8 w-full')}>
                Continue to Studio <IconArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <>
              <h1 className="display text-[clamp(2.2rem,4vw,3.25rem)] leading-[0.9] tracking-[-0.045em] max-lg:mt-6">
                {mode === 'signin' ? 'Sign in to Slate' : 'Create your account'}
              </h1>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-3">
                {mode === 'signin'
                  ? 'Pick up where you left off. Your library is where you left it.'
                  : 'Free. An email and a password is all it takes.'}
              </p>

              <div className="mt-8">
                <Segmented<Mode> label="Account mode" value={mode} options={['signin', 'signup']} onChange={switchMode}
                  render={(m) => (m === 'signin' ? 'Sign In' : 'Create Account')} />
              </div>

              <form onSubmit={submit} className="relative mt-6 flex flex-col gap-5" noValidate>
                <div>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <input id="email" name="email" type="email" inputMode="email" autoComplete="email" value={email}
                    required maxLength={EMAIL_MAX} spellCheck={false} autoCapitalize="none"
                    onChange={(e) => { setEmail(e.target.value); revalidate(touched, e.target.value) }}
                    onBlur={() => blur('email')} aria-invalid={Boolean(fields.email)}
                    aria-describedby={fields.email ? 'email-error' : undefined}
                    className={inputCls(Boolean(fields.email))} />
                  {fields.email && <p id="email-error" className="mt-1.5 text-xs text-danger">{fields.email}</p>}
                </div>
                <div>
                  <FieldLabel htmlFor="password" hint={mode === 'signup' ? '8+ characters' : undefined}>Password</FieldLabel>
                  <div className="relative">
                    <input id="password" name="password" type={showPassword ? 'text' : 'password'}
                      autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                      required minLength={mode === 'signup' ? 8 : undefined} maxLength={PASSWORD_MAX}
                      value={password} onChange={(e) => { setPassword(e.target.value); revalidate(touched, email, e.target.value) }}
                      onBlur={() => blur('password')} aria-invalid={Boolean(fields.password)}
                      aria-describedby={fields.password ? 'password-error' : undefined}
                      className={`${inputCls(Boolean(fields.password))} pr-16`} />
                    <button type="button" onClick={() => setShowPassword((v) => !v)} aria-pressed={showPassword}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute inset-y-1 right-1 rounded-[4px] px-3 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3 hover:text-ink">
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {fields.password && <p id="password-error" className="mt-1.5 text-xs text-danger">{fields.password}</p>}
                </div>

                {/* Honeypot: invisible and unreachable for people; bots that fill every field give themselves away. */}
                <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
                  <label htmlFor="website">Leave this field empty</label>
                  <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off"
                    value={website} onChange={(e) => setWebsite(e.target.value)} />
                </div>

                {error && (
                  <p role="alert" className="rounded-[var(--radius-ctl)] border border-danger/40 bg-danger/10 px-3 py-2.5 text-[13px] text-danger">
                    {error.message}
                    {error.code === 'email_exists' && (
                      <button type="button" onClick={() => switchMode('signin')} className="ml-1 underline underline-offset-2">
                        Sign in instead
                      </button>
                    )}
                  </p>
                )}

                <Button type="submit" variant="contrast" size="lg" disabled={busy} className="mt-1 uppercase tracking-[0.06em]">
                  {busy ? 'One moment…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
                </Button>
                {mode === 'signup' && (
                  <p className="text-[12px] leading-relaxed text-ink-3">
                    By creating an account you agree to the{' '}
                    <Link href="/terms" className="text-ink-2 underline underline-offset-2 hover:text-signal">Terms</Link> and{' '}
                    <Link href="/privacy" className="text-ink-2 underline underline-offset-2 hover:text-signal">Privacy Policy</Link>.
                  </p>
                )}
              </form>

              <p className="mt-6 text-[13px] text-ink-3">
                {mode === 'signin' ? 'New to Slate? ' : 'Already have an account? '}
                <button type="button" onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
                  className="text-ink underline underline-offset-2 hover:text-signal">
                  {mode === 'signin' ? 'Create an account' : 'Sign in'}
                </button>
              </p>
              <Link href="/" className="mt-8 inline-flex text-[13px] text-ink-3 hover:text-ink">← Back to the homepage</Link>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
