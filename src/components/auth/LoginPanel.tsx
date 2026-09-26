'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { signIn, signUp, useAuth, type AuthError } from '@/lib/client/auth'
import { safeNext } from '@/lib/auth/next'
import { MotionPreview, useLoadedImage } from '@/components/studio/MotionPreview'
import { Mark } from '@/components/shell/Wordmark'
import { Button, FieldLabel, Segmented, buttonClass } from '@/components/ui/primitives'
import { IconArrowRight } from '@/components/ui/icons'

type Mode = 'signin' | 'signup'
type Fields = Partial<Record<'email' | 'password', string>>

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Mirrors the server schema so most mistakes are caught before a round trip. */
function validate(mode: Mode, email: string, password: string): Fields {
  const f: Fields = {}
  if (!email.trim()) f.email = 'Enter your email'
  else if (!EMAIL.test(email.trim())) f.email = 'Enter a valid email address'
  if (!password) f.password = 'Enter your password'
  else if (mode === 'signup' && password.length < 8) f.password = 'Use at least 8 characters'
  else if (password.length > 72) f.password = 'Use 72 characters or fewer'
  return f
}

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
  const [error, setError] = useState<AuthError | null>(null)
  const art = useLoadedImage('/explore/featured-hero.jpg')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const local = validate(mode, email, password)
    setFields(local)
    if (Object.keys(local).length) return

    setBusy(true)
    const r = mode === 'signin' ? await signIn(email.trim(), password) : await signUp(email.trim(), password)
    if (!r.ok) {
      setFields((r.error.fields ?? {}) as Fields)
      setError(r.error.fields ? null : r.error)
      setBusy(false)
      return
    }
    // Hard navigation, so every view loads fresh under the new session.
    window.location.assign(next)
  }

  const switchMode = (m: Mode) => { setMode(m); setError(null); setFields({}) }

  return (
    <main className="grid flex-1 lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-line lg:block">
        <div className="graded absolute inset-0">
          <MotionPreview motion="dolly_in" source={art} aspect={4 / 5} longEdge={1100} durationMs={8000}
            label="Sample frame with a live Dolly In, the same transform the renderer uses" />
        </div>
        <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_180px_60px_rgba(8,8,9,0.6)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0c0c0d]/95 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-10 xl:p-14">
          <h1 className="display text-[clamp(2.6rem,5vw,5rem)] uppercase leading-[0.86] tracking-[-0.05em]">
            Imagine.<br />Create.<br /><span className="text-signal">Move.</span>
          </h1>
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
              <h2 className="display display-s mt-3 break-all">{auth.user?.email}</h2>
              <Link href={next} className={buttonClass('contrast', 'lg', 'mt-8 w-full')}>
                Continue to Studio <IconArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <>
              <h2 className="display text-[clamp(2.2rem,4vw,3.25rem)] leading-[0.9] tracking-[-0.045em] max-lg:mt-6">
                {mode === 'signin' ? 'Sign in to Slate' : 'Create your account'}
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-3">
                {mode === 'signin'
                  ? 'Pick up where you left off. Your library is where you left it.'
                  : 'Free. An email and a password is all it takes.'}
              </p>

              <div className="mt-8">
                <Segmented<Mode> label="Account mode" value={mode} options={['signin', 'signup']} onChange={switchMode}
                  render={(m) => (m === 'signin' ? 'Sign In' : 'Create Account')} />
              </div>

              <form onSubmit={submit} className="mt-6 flex flex-col gap-5" noValidate>
                <div>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <input id="email" name="email" type="email" inputMode="email" autoComplete="email" value={email}
                    onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(fields.email)}
                    aria-describedby={fields.email ? 'email-error' : undefined}
                    className={inputCls(Boolean(fields.email))} />
                  {fields.email && <p id="email-error" className="mt-1.5 text-xs text-danger">{fields.email}</p>}
                </div>
                <div>
                  <FieldLabel htmlFor="password" hint={mode === 'signup' ? '8+ characters' : undefined}>Password</FieldLabel>
                  <input id="password" name="password" type="password"
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={Boolean(fields.password)}
                    aria-describedby={fields.password ? 'password-error' : undefined}
                    className={inputCls(Boolean(fields.password))} />
                  {fields.password && <p id="password-error" className="mt-1.5 text-xs text-danger">{fields.password}</p>}
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
