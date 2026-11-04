'use client'
// Admin → Mail: Olexweb Mail, Olaitan's own email platform. Pipes (your server, Resend, Mailjet) with today's and this
// month's use and their health; a test send; every email sent (search); and the do-not-send list.
import { useCallback, useEffect, useState } from 'react'
import { toast } from './ui'

const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const when = (iso) => { if (!iso) return ''; const d = new Date(new Date(iso).getTime() + 3600e3); return `${d.getUTCDate()} ${M[d.getUTCMonth()]}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}` }   // Lagos, same on server and browser
const num = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
const STATUS = { sent: 'Sent', failed: 'Failed', suppressed: 'Not sent (do-not-send)', skipped: 'Skipped (limits)', queued: 'Sending', bounced: 'Bounced', complained: 'Marked as spam' }
const SETUP = { own: 'Your own server isn’t connected yet. It switches on once OWN_MAIL_URL and OWN_MAIL_TOKEN are in Vercel (after Oracle approves port 25).',
  resend: 'Add RESEND_API_KEY in Vercel to switch it on.', mailjet: 'Add MAILJET_API_KEY and MAILJET_SECRET_KEY in Vercel to switch it on.' }

async function call(body) {
  const r = await fetch('/admin/api/mail', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'That didn’t work.'); return j
}

export default function AdminMail({ me }) {
  const [o, setO] = useState(null), [tab, setTab] = useState('log'), [log, setLog] = useState(null), [sup, setSup] = useState(null)
  const [search, setSearch] = useState(''), [testTo, setTestTo] = useState(me || ''), [busy, setBusy] = useState(''), [add, setAdd] = useState({ email: '', note: '' })
  const load = useCallback(async () => {
    try { setO(await call({ action: 'overview' })); setLog((await call({ action: 'log', search })).messages); setSup((await call({ action: 'suppressions' })).list) } catch (e) { toast(e.message) }
  }, [search])
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  async function test(e) {
    e.preventDefault(); setBusy('test')
    try { const r = await call({ action: 'test', to: testTo }); toast(`Sent through ${o.pipes.find((p) => p.pipe === r.pipe).name}. Check the inbox.`) } catch (err) { toast(err.message) }
    setBusy(''); load()
  }
  async function suppress(e) {
    e.preventDefault(); setBusy('add')
    try { await call({ action: 'suppress', email: add.email, note: add.note }); setAdd({ email: '', note: '' }); toast('Added. Nothing will be sent to that address.') } catch (err) { toast(err.message) }
    setBusy(''); load()
  }
  async function unsuppress(email) { if (!confirm(`Allow emails to ${email} again?`)) return; await call({ action: 'unsuppress', email }).catch((e) => toast(e.message)); load() }
  if (!o) return <div className="ml"><h1 className="d">Mail</h1><p className="mg-dim">Loading…</p><style dangerouslySetInnerHTML={{ __html: CSS }} /></div>

  return (<div className="ml">
    <div className="top"><h1 className="d">Mail</h1></div>
    <p className="ml-lead">Olexweb Mail: your own email platform. Every email from the site goes through it, trying your pipes in order.
      Sending as <b>{o.from}</b>.{o.ready ? '' : ' No pipe is set up yet, so nothing can be sent.'}</p>

    <section className="ml-pipes" aria-label="Pipes">{o.pipes.map((p, i) => <div key={p.pipe} className={'ml-pipe' + (!p.ready ? ' off' : p.resting ? ' rest' : '')}>
      <div className="ml-ph"><span className="ml-n">{i + 1}</span><b>{p.name}</b><em>{!p.ready ? 'Not set up' : p.resting ? 'Resting' : 'Working'}</em></div>
      {p.ready ? <>
        <div className="ml-bar" aria-label={`${p.today} of ${p.dayLimit} today`}><i style={{ width: Math.min(100, (p.today / Math.max(1, p.dayLimit)) * 100) + '%' }} /></div>
        <small>{num(p.today)} of {num(p.dayLimit)} today, {num(p.month)} of {num(p.monthLimit)} this month</small>
        {p.resting ? <small className="ml-bad">Resting until {when(p.restUntil)} after: {p.lastError}</small> : p.lastError && p.lastFail ? <small className="mg-dim">Last problem {when(p.lastFail)}: {p.lastError}</small> : null}
      </> : <small className="mg-dim">{SETUP[p.pipe]}</small>}
    </div>)}</section>

    <form className="ml-test" onSubmit={test}><label><span className="mg-lab">Send a test email to</span><input className="input" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} required /></label>
      <button className="btn btn-green" disabled={!o.ready || busy === 'test'}>{busy === 'test' ? 'Sending…' : 'Send test'}</button></form>

    <div className="seg ml-tabs" role="tablist"><button type="button" role="tab" aria-selected={tab === 'log'} aria-pressed={tab === 'log'} onClick={() => setTab('log')}>Sent ({num(o.totals.day)} today)</button>
      <button type="button" role="tab" aria-selected={tab === 'sup'} aria-pressed={tab === 'sup'} onClick={() => setTab('sup')}>Do-not-send ({sup ? sup.length : 0})</button></div>

    {tab === 'log' ? <section className="mg-box">
      <form className="ml-search" onSubmit={(e) => { e.preventDefault(); load() }}><input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by address or subject" aria-label="Search sent email" /><button className="btn btn-line">Search</button></form>
      {log && log.length ? <div className="ml-wrap"><table className="ml-table"><thead><tr><th>When</th><th>To</th><th>Subject</th><th>Status</th><th>Pipe</th></tr></thead>
        <tbody>{log.map((m) => <tr key={m.id} className={'ml-' + m.status}><td>{when(m.created_at)}</td><td>{m.to_email}</td><td>{m.subject}<small>{m.source}, {m.kind}</small></td>
          <td>{STATUS[m.status] || m.status}{m.error ? <small>{m.error}</small> : null}</td><td>{m.pipe ? (o.pipes.find((p) => p.pipe === m.pipe) || {}).name : '–'}</td></tr>)}</tbody></table></div>
        : <p className="mg-dim">Nothing sent yet.</p>}
    </section> : <section className="mg-box">
      <p className="mg-dim">Addresses here are never emailed: ones that bounced or marked email as spam (added automatically), and any you add. This keeps your sending reputation healthy.</p>
      <form className="ml-add" onSubmit={suppress}><input className="input" type="email" value={add.email} onChange={(e) => setAdd({ ...add, email: e.target.value })} placeholder="name@example.com" required aria-label="Address" />
        <input className="input" value={add.note} onChange={(e) => setAdd({ ...add, note: e.target.value })} placeholder="Why (only you see this)" aria-label="Why" /><button className="btn btn-line" disabled={busy === 'add'}>Add</button></form>
      {sup && sup.length ? <ul className="mg-list">{sup.map((s) => <li key={s.email}><div className="mg-main"><b>{s.email}</b><span className="mg-dim">{s.reason === 'manual' ? 'Added by you' : s.reason === 'bounce' ? 'Bounced' : s.reason === 'complaint' ? 'Marked as spam' : s.reason}, {when(s.created_at)}{s.note ? `: ${s.note}` : ''}</span></div>
        <div className="mg-acts"><button className="btn btn-line" onClick={() => unsuppress(s.email)}>Allow again</button></div></li>)}</ul> : <p className="mg-dim">The list is empty.</p>}
    </section>}
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
  </div>)
}
const CSS = `.ml{display:grid;gap:14px;max-width:960px}.ml-lead{margin:0;color:var(--dim);line-height:1.6;max-width:72ch}.ml-lead b{color:var(--paper)}
.ml-pipes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.ml-pipe{display:grid;gap:6px;align-content:start;padding:14px;border-radius:16px;border:1px solid var(--line);background:rgba(242,239,233,.02)}
.ml-pipe.off{opacity:.75}.ml-pipe.rest{border-color:rgba(240,179,94,.45)}
.ml-ph{display:flex;align-items:center;gap:8px}.ml-ph b{flex:1}.ml-ph em{font-style:normal;font-size:12px;font-weight:700;padding:2px 9px;border-radius:999px;background:rgba(143,227,106,.14);color:var(--green)}
.ml-pipe.off .ml-ph em{background:rgba(242,239,233,.08);color:var(--dim)}.ml-pipe.rest .ml-ph em{background:rgba(240,179,94,.16);color:#f0b35e}
.ml-n{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:800;background:rgba(242,239,233,.08)}
.ml-bar{height:8px;border-radius:999px;background:rgba(242,239,233,.08);overflow:hidden}.ml-bar i{display:block;height:100%;background:var(--green);border-radius:999px}
.ml-pipe small{font-size:13px;line-height:1.5}.ml-bad{color:#f0b35e}
.ml-test{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap}.ml-test label{display:grid;gap:6px;flex:1 1 260px;max-width:420px}
.ml-tabs{justify-self:start}.ml-search,.ml-add{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}.ml-search .input,.ml-add .input{flex:1 1 220px}
.ml-wrap{overflow-x:auto}.ml-table{width:100%;border-collapse:collapse;font-size:14px}.ml-table th,.ml-table td{padding:9px 10px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}
.ml-table th{font-size:12.5px;color:var(--dim)}.ml-table td small{display:block;color:var(--dim);font-size:12px;margin-top:2px}
.ml-failed td:nth-child(4),.ml-bounced td:nth-child(4),.ml-complained td:nth-child(4){color:#ef7a6a}.ml-suppressed td:nth-child(4),.ml-skipped td:nth-child(4){color:#f0b35e}
@media (max-width:760px){.ml-pipes{grid-template-columns:1fr}}`
