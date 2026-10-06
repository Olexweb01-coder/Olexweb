'use client'
import { useState } from 'react'
export default function ReviewForm({ token, stamp }) {
  const [stars, setStars] = useState(0), [text, setText] = useState(''), [consent, setConsent] = useState(false)
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false), [sent, setSent] = useState(false)
  async function send(e) {
    e.preventDefault(); const f = new FormData(e.currentTarget)
    // tell people straight away, before anything is sent (the server checks all of this again)
    const name = String(f.get('name') || '').trim()
    const problem = name.length < 2 ? 'Add your name.' : !stars ? 'Choose a rating.' : text.trim().length < 20 ? 'Write a few more words about working with Olexweb.' : !consent ? 'Tick the box to let Olexweb show your review.' : ''
    if (problem) { setErr(problem); return }
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ token, stamp, name: f.get('name'), role: f.get('role'), text, stars, consent, website: f.get('website') }) })
      const j = await r.json().catch(() => ({}))
      if (r.ok) setSent(true); else setErr(j.error || 'Something went wrong. Try again.')
    } catch { setErr('No connection. Your review is still here; try again.') } finally { setBusy(false) }
  }
  const mark = <div className="auth-mark"><img src="/studio/mark.png" alt="" width="26" height="30" />Olexweb</div>
  if (sent) return (<main className="auth"><div className="auth-box" style={{ maxWidth: 520 }}>{mark}
    <h1 className="d">Thank you.</h1><p className="lead">Olaitan will read your review before it appears on olexweb.com.</p><p><a className="btn btn-line" href="/">Visit olexweb.com</a></p></div></main>)
  return (<main className="auth"><form className="auth-box" style={{ maxWidth: 520 }} onSubmit={send} noValidate>
    {mark}
    <h1 className="d">How was working with Olexweb?</h1>
    <p className="lead">Your words help other businesses decide. Olaitan reads every review before it appears on olexweb.com.</p>
    <div className="field"><label htmlFor="rn">Your name</label><input className="input" id="rn" name="name" autoComplete="name" maxLength={80} required /></div>
    <div className="field"><label htmlFor="rr">Your role and business</label><input className="input" id="rr" name="role" maxLength={120} placeholder="For example: Founder, Mojatech Electrical" /></div>
    <div className="field"><span id="rl" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--dim)' }}>Rating</span>
      <div role="radiogroup" aria-labelledby="rl" style={{ display: 'flex', gap: 4 }}>
        {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={n + ' out of 5'} onClick={() => setStars(n)}
          style={{ appearance: 'none', background: 'none', border: 0, cursor: 'pointer', fontSize: 30, lineHeight: 1, padding: 2, color: n <= stars ? 'var(--green)' : 'rgba(242,239,233,.25)' }}>★</button>)}
      </div></div>
    <div className="field"><label htmlFor="rt">Your review</label><textarea className="input" id="rt" value={text} onChange={(e) => setText(e.target.value)} maxLength={800} /><span className="count-hint">{text.length} / 800</span></div>
    <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}><label htmlFor="ws">Website</label><input id="ws" name="website" tabIndex={-1} autoComplete="off" /></div>
    <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, color: 'var(--dim)', margin: '4px 0 18px' }}><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 4, accentColor: 'var(--green)' }} /> Olexweb may show my name, role and review on its website.</label>
    <p className="err" role="alert">{err}</p>
    <button className="btn btn-green btn-wide" type="submit" disabled={busy}>{busy ? 'Sending\u2026' : 'Send review'}</button>
    <p className="note">Protected against spam. Nothing appears on the site until Olaitan approves it.</p>
  </form></main>)
}
