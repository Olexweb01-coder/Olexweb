'use client'
// One form for paying on Meet's public pages (Install 58): a certificate, a bundle, a membership. The server works out
// the price and sends the person to Paystack; nothing typed here can change what is charged.
import { useState } from 'react'
export default function PayForm({ action, payload = {}, label, askName = false, askEmail = true, defaults = {}, note = null, group = null }) {
  const [name, setName] = useState(defaults.name || ''), [email, setEmail] = useState(defaults.email || ''), [busy, setBusy] = useState(false), [err, setErr] = useState('')
  async function go(asGroup) {
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/meet/earn', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action, ...payload, name, email, group: !!asGroup }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'That didn’t work. Try again.')
      if (j.url) { location.assign(j.url); return }
      if (j.serial) { location.assign((location.pathname.startsWith('/meet') ? '/meet' : '') + '/v/' + j.serial); return }
      setBusy(false)
    } catch (e) { setErr(e.message); setBusy(false) }
  }
  return (<form className="pb-stack" onSubmit={(e) => { e.preventDefault(); go(false) }}>
    {askName ? <div><label className="pb-lab" htmlFor="pf-n">Your name</label><input id="pf-n" className="pb-in" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></div> : null}
    {askEmail ? <div><label className="pb-lab" htmlFor="pf-e">Your email (your receipt and link go here)</label><input id="pf-e" className="pb-in" type="email" maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></div> : null}
    {err ? <p className="pb-err" role="alert">{err}</p> : null}
    <div className="pb-row"><button className="pb-btn pb-go" disabled={busy}>{busy ? 'Opening Paystack…' : label}</button>
      {group ? <button type="button" className="pb-btn" disabled={busy} onClick={(e) => { const f = e.currentTarget.form; if (f.reportValidity()) go(true) }}>{group}</button> : null}</div>
    {note ? <p className="pb-faint" style={{ margin: 0 }}>{note}</p> : null}
  </form>)
}
