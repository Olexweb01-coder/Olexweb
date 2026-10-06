'use client'
import { useState } from 'react'
async function call(url, payload) {
  try { const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'same-origin' }); const j = await r.json().catch(() => ({})); return r.ok ? j : { error: j.error || 'Something went wrong. Try again.' } }
  catch { return { error: 'No connection. Try again.' } }
}
export default function JoinFlow({ token, email }) {
  const [step, setStep] = useState('account'), [qr, setQr] = useState(null), [codes, setCodes] = useState([]), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  async function account(e) {
    e.preventDefault(); const f = new FormData(e.currentTarget)
    if (f.get('password') !== f.get('again')) { setErr('The two passwords don\u2019t match.'); return }
    setBusy(true); setErr(''); const r = await call('/admin/api/join/start', { token, name: f.get('name'), password: f.get('password') }); setBusy(false)
    if (r.error) setErr(r.error); else { setQr(r); setStep('code') }
  }
  async function code(e) {
    e.preventDefault(); const f = new FormData(e.currentTarget)
    setBusy(true); setErr(''); const r = await call('/admin/api/join/finish', { token, code: f.get('code') }); setBusy(false)
    if (r.error) setErr(r.error); else { setCodes(r.recovery); setStep('done') }
  }
  const mark = <div className="auth-mark"><img src="/studio/mark.png" alt="" width="26" height="30" />Olexweb</div>
  return (<main className="auth">
    {step === 'account' ? (<form key="a" className="auth-box" onSubmit={account} noValidate>{mark}
      <h1 className="d">Join the Olexweb admin.</h1><p className="lead">You’re invited as an editor, as {email}.</p>
      <div className="field"><label htmlFor="jn">Your name</label><input className="input" id="jn" name="name" autoComplete="name" maxLength={80} required /></div>
      <div className="field"><label htmlFor="jp">Choose a password</label><input className="input" id="jp" name="password" type="password" autoComplete="new-password" minLength={10} required /></div>
      <div className="field"><label htmlFor="ja">Type it again</label><input className="input" id="ja" name="again" type="password" autoComplete="new-password" required /></div>
      <p className="err" role="alert">{err}</p>
      <button className="btn btn-green btn-wide" type="submit" disabled={busy}>{busy ? 'Saving\u2026' : 'Continue'}</button>
      <p className="note">At least 10 characters. Next, you’ll set up an authenticator app.</p></form>)
    : step === 'code' ? (<form key="c" className="auth-box" onSubmit={code} noValidate>{mark}
      <h1 className="d">Set up two-step sign-in.</h1><p className="lead">Scan this with an authenticator app (Google Authenticator or Microsoft Authenticator), then type the 6-digit code it shows.</p>
      <div style={{ width: 200, margin: '0 auto 12px', borderRadius: 12, overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: qr.qr }} />
      <p className="note" style={{ textAlign: 'center', marginTop: 0 }}>Can’t scan? Type this key into the app: <b style={{ color: 'var(--paper)', letterSpacing: '.06em' }}>{qr.key}</b></p>
      <div className="field"><label htmlFor="jc">6-digit code</label><input className="input code" id="jc" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required /></div>
      <p className="err" role="alert">{err}</p>
      <button className="btn btn-green btn-wide" type="submit" disabled={busy}>{busy ? 'Checking\u2026' : 'Finish'}</button></form>)
    : (<div className="auth-box">{mark}
      <h1 className="d">You’re in.</h1><p className="lead">Save these recovery codes somewhere safe. Each works once if you lose your phone. They won’t be shown again.</p>
      <div className="share" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontWeight: 700, letterSpacing: '.04em' }}>{codes.map((c) => <span key={c}>{c}</span>)}</div>
      <p style={{ marginTop: 18 }}><a className="btn btn-green btn-wide" href="/admin/login">Sign in</a></p></div>)}
  </main>)
}
