'use client'
// Join or cancel a host's membership (Install 58)
import { useState } from 'react'
export default function MemberActions({ handle, mine, price, signedIn, home, back }) {
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [done, setDone] = useState('')
  async function call(action) {
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/meet/earn', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action, handle }) })
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'That didn’t work. Try again.')
      if (j.url) { location.assign(j.url); return }
      setDone(action === 'member-cancel' ? 'Cancelled. You won’t be charged again, and you keep access until your paid month ends.' : 'Done.'); setBusy(false)
    } catch (e) { setErr(e.message); setBusy(false) }
  }
  const N = (n) => '₦' + Number(n).toLocaleString('en-NG')
  if (!signedIn) return <a className="pb-btn pb-go" href={`${home}?next=${encodeURIComponent(back)}#signin`}>Sign in to join (free account)</a>
  if (done) return <p className="pb-ok" style={{ margin: 0 }}><b>✓</b><span>{done}</span></p>
  const active = mine && ['active', 'renewing', 'paused'].includes(mine.status)
  return (<div className="pb-stack">
    {err ? <p className="pb-err" role="alert">{err}</p> : null}
    {!active ? <button className="pb-btn pb-go" disabled={busy} onClick={() => call('member-join')}>{busy ? 'Opening Paystack…' : `Join for ${N(price)} a month`}</button>
      : !mine.cancelling ? <button className="pb-btn" disabled={busy} onClick={() => { if (confirm('Cancel your membership? You keep access until your paid month ends.')) call('member-cancel') }}>Cancel membership</button> : null}
  </div>)
}
