'use client'
import { useState, useRef, useEffect } from 'react'

export default function SignIn() {
  const [step, setStep] = useState('password'), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const codeRef = useRef(null)
  useEffect(() => { if (step === 'code') codeRef.current?.focus() }, [step])
  async function send(url, payload) {
    setBusy(true); setError('')
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'same-origin' })
      const j = await r.json().catch(() => ({}))
      return r.ok ? j : { error: j.error || 'Something went wrong. Try again.', restart: j.restart }
    } catch { return { error: 'No connection. Check your internet and try again.' } } finally { setBusy(false) }
  }
  async function onPassword(e) {
    e.preventDefault(); const f = new FormData(e.currentTarget)
    const r = await send('/admin/api/sign-in', { email: f.get('email'), password: f.get('password') })
    if (r.error) setError(r.error); else setStep('code')
  }
  async function onCode(e) {
    e.preventDefault(); const f = new FormData(e.currentTarget)
    const r = await send('/admin/api/verify-code', { code: f.get('code') })
    if (r.error) { setError(r.error); if (r.restart) setStep('password') } else window.location.assign('/admin')
  }
  const mark = <div className="auth-mark"><img src="/studio/mark.png" alt="" width="26" height="30" />Olexweb</div>
  return (
    <main className="auth">
      {step === 'password' ? (
        <form key="password" className="auth-box" onSubmit={onPassword} noValidate>
          {mark}
          <h1 className="d">Sign in to the admin.</h1><p className="lead">For Olaitan and invited editors only.</p>
          <div className="field"><label htmlFor="em">Email</label><input className="input" id="em" name="email" type="email" autoComplete="username" required /></div>
          <div className="field"><label htmlFor="pw">Password</label><input className="input" id="pw" name="password" type="password" autoComplete="current-password" required /></div>
          <p className="err" role="alert">{error}</p>
          <button className="btn btn-green btn-wide" type="submit" disabled={busy}>{busy ? 'Checking\u2026' : 'Continue'}</button>
          <p className="note">After 5 wrong attempts, sign-in pauses for 15 minutes. Each sign-in needs your authenticator code.</p>
        </form>
      ) : (
        <form key="code" className="auth-box" onSubmit={onCode} noValidate>
          {mark}
          <h1 className="d">Enter your code.</h1><p className="lead">Open your authenticator app and type the 6-digit code for Olexweb.</p>
          <div className="field"><label htmlFor="code">6-digit code</label><input ref={codeRef} className="input code" id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={9} required /></div>
          <p className="err" role="alert">{error}</p>
          <button className="btn btn-green btn-wide" type="submit" disabled={busy}>{busy ? 'Checking\u2026' : 'Sign in'}</button>
          <p className="note">Lost your phone? Type one of your recovery codes instead.</p>
        </form>
      )}
    </main>
  )
}
