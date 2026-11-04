'use client'
// Email sign-in on Olexweb Meet's sign-in sheet: password, or an emailed code; create an account; forgot password.
// /api/meet/email (lib/meet/emailauth.js). After signing in, carries on where the person was going (next).
import { useEffect, useRef, useState } from 'react'

const onMeetApp = () => typeof location !== 'undefined' && location.hostname.startsWith('meet.')
const go = (next) => { const n = next || '/'; location.assign(onMeetApp() ? n : '/meet' + (n === '/' ? '' : n.replace(/^\//, ''))) }
async function call(body) {
  const r = await fetch('/api/meet/email', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'That didn’t work. Try again.'); return j
}

export default function EmailSignIn({ next }) {
  const [mode, setMode] = useState('signin'), [f, setF] = useState({ name: '', email: '', password: '', code: '', newPw: '' })
  const [purpose, setPurpose] = useState('signin'), [busy, setBusy] = useState(false), [err, setErr] = useState(''), [note, setNote] = useState(''), [wait, setWait] = useState(0)
  const codeRef = useRef(null), set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  useEffect(() => { if (!wait) return; const t = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(t) }, [wait])
  useEffect(() => { if (mode === 'code' && codeRef.current) codeRef.current.focus() }, [mode])
  async function run(fn) { setBusy(true); setErr(''); try { await fn() } catch (e) { setErr(e.message) } setBusy(false) }
  const toCode = (p, msg) => { setPurpose(p); setMode('code'); setNote(msg); setWait(60); setF((x) => ({ ...x, code: '' })) }

  const signIn = (e) => { e.preventDefault(); run(async () => { await call({ action: 'password', email: f.email, password: f.password }); go(next) }) }
  const signUp = (e) => { e.preventDefault(); run(async () => { const r = await call({ action: 'signup', name: f.name, email: f.email, password: f.password }); toCode('signup', r.message) }) }
  const askCode = (p) => run(async () => { if (!f.email) throw new Error('Type your email first.'); const r = await call({ action: 'code', email: f.email, purpose: p }); toCode(p, r.message) })
  const verify = (e) => { e.preventDefault(); run(async () => { await call({ action: 'verify', email: f.email, code: f.code, ...(purpose === 'reset' ? { password: f.newPw } : {}) }); go(next) }) }
  const resend = () => run(async () => {
    const r = purpose === 'signup' ? await call({ action: 'signup', name: f.name, email: f.email, password: f.password }) : await call({ action: 'code', email: f.email, purpose })
    setNote(r.message); setWait(60)
  })

  return (<div className="es">
    {mode === 'signin' ? <form onSubmit={signIn}>
      <label className="mh-f"><span>Email</span><input type="email" autoComplete="email" value={f.email} onChange={set('email')} required /></label>
      <label className="mh-f"><span>Password</span><input type="password" autoComplete="current-password" value={f.password} onChange={set('password')} required /></label>
      <button className="mh-btn mh-go es-wide" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      <div className="es-links"><button type="button" onClick={() => askCode('signin')} disabled={busy}>Email me a code instead</button><button type="button" onClick={() => askCode('reset')} disabled={busy}>Forgot password?</button></div>
      <p className="es-switch">New here? <button type="button" onClick={() => { setMode('signup'); setErr('') }}>Create an account</button></p>
    </form> : mode === 'signup' ? <form onSubmit={signUp}>
      <label className="mh-f"><span>Your name</span><input autoComplete="name" maxLength={80} value={f.name} onChange={set('name')} required /></label>
      <label className="mh-f"><span>Email</span><input type="email" autoComplete="email" value={f.email} onChange={set('email')} required /></label>
      <label className="mh-f"><span>Password (at least 8 characters)</span><input type="password" autoComplete="new-password" minLength={8} value={f.password} onChange={set('password')} required /></label>
      <button className="mh-btn mh-go es-wide" disabled={busy}>{busy ? 'Sending a code…' : 'Create account'}</button>
      <p className="es-switch">Have an account? <button type="button" onClick={() => { setMode('signin'); setErr('') }}>Sign in</button></p>
    </form> : <form onSubmit={verify}>
      <p className="es-note" role="status">{note || 'Check your inbox for a 6-digit code.'} The code is for <b>{f.email}</b>.</p>
      <label className="mh-f"><span>6-digit code</span><input ref={codeRef} className="es-code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={f.code}
        onChange={(e) => setF({ ...f, code: e.target.value.replace(/[^\d]/g, '').slice(0, 6) })} required /></label>
      {purpose === 'reset' ? <label className="mh-f"><span>New password (at least 8 characters)</span><input type="password" autoComplete="new-password" minLength={8} value={f.newPw} onChange={set('newPw')} required /></label> : null}
      <button className="mh-btn mh-go es-wide" disabled={busy || f.code.length !== 6}>{busy ? 'Checking…' : purpose === 'reset' ? 'Save and sign in' : purpose === 'signup' ? 'Confirm and create account' : 'Sign in'}</button>
      <div className="es-links"><button type="button" onClick={resend} disabled={busy || wait > 0}>{wait ? `Send again in ${wait}s` : 'Send the code again'}</button><button type="button" onClick={() => { setMode('signin'); setErr('') }}>Use another email</button></div>
    </form>}
    {err ? <p className="es-err" role="alert">{err}</p> : null}
  </div>)
}
