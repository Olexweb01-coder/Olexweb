'use client'
// Admin → Meet → Revenue → Bonus Pro (Install 58k): give Pro with a reason, a welcome bonus for new accounts, and every
// bonus with a Cancel (with a reason they see). Bonus Pro ends by itself on its date.
import { useEffect, useState } from 'react'

async function act(body) {
  const r = await fetch('/admin/api/meetings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'That didn’t work.'); return j
}
const day = (s) => new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
export default function AdminBonus() {
  const [d, setD] = useState(null), [g, setG] = useState({ email: '', days: 7, reason: 'Thank you for joining early. Here’s a week of Pro, on us.' }), [w, setW] = useState(null)
  const [why, setWhy] = useState({}), [busy, setBusy] = useState(''), [msg, setMsg] = useState(''), [err, setErr] = useState('')
  const load = () => act({ action: 'bonus-list' }).then((j) => { setD(j); setW((x) => x || j.welcome) }, (e) => setErr(e.message))
  useEffect(() => { load() }, [])
  async function run(key, body, done) { setBusy(key); setErr(''); setMsg(''); try { const j = await act(body); setMsg(typeof done === 'function' ? done(j) : done); await load(); return true } catch (e) { setErr(e.message); return false } finally { setBusy('') } }
  if (!d || !w) return <section className="mg-box"><p className="mg-dim">{err || 'Loading…'}</p></section>
  const live = d.grants.filter((x) => x.active), past = d.grants.filter((x) => !x.active).slice(0, 20)
  return (<section className="mg-box">
    <h2>Bonus Pro</h2>
    <p className="mg-dim">Free Pro with a reason they see in their notifications. It ends by itself on its date. Money they earn meanwhile still reaches their bank; new paid sales stop when Pro ends.</p>
    <h3 style={{ fontSize: 15, margin: '14px 0 6px' }}>Give Pro</h3>
    <div className="mb-prices"><label><span className="mg-lab">Email (or all)</span><input className="input" value={g.email} onChange={(e) => setG({ ...g, email: e.target.value })} placeholder="someone@email.com or all" /></label>
      <label><span className="mg-lab">Days</span><input className="input" type="number" min={1} value={g.days} onChange={(e) => setG({ ...g, days: e.target.value })} /></label></div>
    <label><span className="mg-lab">Reason (they see this)</span><input className="input" maxLength={300} value={g.reason} onChange={(e) => setG({ ...g, reason: e.target.value })} /></label>
    <button className="btn btn-green" disabled={!!busy || !g.email.trim() || !g.reason.trim()} onClick={() => { if (g.email.trim().toLowerCase() === 'all' && !confirm(`Give ${g.days} days of Pro to every Meet account?`)) return; run('g', { action: 'give-pro', ...g }, (j) => `Pro given to ${j.people} account${j.people === 1 ? '' : 's'}. They were told.`) }}>{busy === 'g' ? 'Giving…' : 'Give Pro'}</button>

    <h3 style={{ fontSize: 15, margin: '22px 0 6px' }}>Welcome bonus for new accounts</h3>
    <p className="mg-dim">Every new account gets this the moment it signs up, including people who came through an invite link. 0 days = off.</p>
    <div className="mb-prices"><label><span className="mg-lab">Days (0 = off)</span><input className="input" type="number" min={0} max={365} value={w.days} onChange={(e) => setW({ ...w, days: e.target.value })} /></label>
      <label><span className="mg-lab">Offer ends (optional)</span><input className="input" type="date" value={w.until || ''} onChange={(e) => setW({ ...w, until: e.target.value })} /></label></div>
    <label><span className="mg-lab">Reason (they see this)</span><input className="input" maxLength={300} value={w.reason} onChange={(e) => setW({ ...w, reason: e.target.value })} placeholder="Thank you for joining early. Here’s a week of Pro, on us." /></label>
    <button className="btn btn-line" disabled={!!busy} onClick={() => run('w', { action: 'welcome-bonus', ...w }, Number(w.days) > 0 ? `New accounts now get ${w.days} days of Pro.` : 'Welcome bonus is off.')}>{busy === 'w' ? 'Saving…' : 'Save welcome bonus'}</button>
    <p className="mg-dim" style={{ fontSize: 13 }}>Now: {d.welcome.days > 0 ? `${d.welcome.days} days for every new account${d.welcome.until ? `, until ${day(d.welcome.until)}` : ''}.` : 'off.'}</p>

    <h3 style={{ fontSize: 15, margin: '22px 0 6px' }}>Active bonuses ({live.length})</h3>
    {live.length ? <ul className="mb-list">{live.map((x) => <li key={x.id} style={{ flexWrap: 'wrap' }}><span><b>{x.name || x.email}</b> · {x.days} days ({x.kind === 'welcome' ? 'welcome' : 'gift'}) · until {day(x.ends)}<br /><small className="mg-dim">{x.reason}</small></span>
      <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><input className="input" style={{ marginBottom: 0, minWidth: 180 }} placeholder="Why cancel? (they see it)" value={why[x.id] || ''} onChange={(e) => setWhy({ ...why, [x.id]: e.target.value })} />
        <button className="btn btn-line" disabled={!!busy || !(why[x.id] || '').trim()} onClick={() => run('c' + x.id, { action: 'bonus-cancel', id: x.id, reason: why[x.id] }, 'Bonus cancelled. They were told why.')}>{busy === 'c' + x.id ? 'Cancelling…' : 'Cancel bonus'}</button></span></li>)}</ul>
      : <p className="mg-dim">No active bonuses.</p>}
    {past.length ? <details style={{ marginTop: 10 }}><summary className="mg-dim">Ended and cancelled</summary><ul className="mb-list">{past.map((x) => <li key={x.id}><span>{x.name || x.email} · {x.days} days · {x.cancelled ? `cancelled: ${x.cancelReason}` : `ended ${day(x.ends)}`}</span></li>)}</ul></details> : null}
    {msg ? <p className="mb-ok">{msg}</p> : null}{err ? <p className="mb-err">{err}</p> : null}
  </section>)
}
