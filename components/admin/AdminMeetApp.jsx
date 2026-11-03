'use client'
// Admin → Meetings → Meet app: the people who signed in to meet.olexweb.com, and reports from meetings.
// Ban a host: signed out everywhere, their open meetings end, and they can't sign in again. Unban; dismiss a report.
import { useCallback, useEffect, useState } from 'react'
import { toast } from './ui'

const P = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const day = (iso) => { if (!iso) return ''; const d = new Date(new Date(iso).getTime() + 3600e3); return `${d.getUTCDate()} ${P[d.getUTCMonth()]} ${d.getUTCFullYear()}` }   // Lagos, same on server and browser
const REASON = { spam: 'Spam or scam', abuse: 'Abuse or harassment', illegal: 'Illegal or harmful content', other: 'Something else' }

export default function AdminMeetApp() {
  const [d, setD] = useState(null), [search, setSearch] = useState(''), [busy, setBusy] = useState(''), [tab, setTab] = useState('reports')
  const load = useCallback(async (s = search) => {
    const r = await fetch('/admin/api/meetings', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'meet-admin', search: s }) }).catch(() => null)
    if (r && r.ok) setD(await r.json())
  }, [search])
  useEffect(() => { load('') }, []) // eslint-disable-line react-hooks/exhaustive-deps
  async function act(body, ok) {
    setBusy(body.action + body.id)
    try {
      const r = await fetch('/admin/api/meetings', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), j = await r.json().catch(() => ({}))
      if (!r.ok) { toast(j.error || 'That didn’t work.'); return } toast(typeof ok === 'function' ? ok(j) : ok); await load()
    } finally { setBusy('') }
  }
  function ban(u) {
    const reason = prompt(`Ban ${u.name || u.email}? They’re signed out, their open meetings end, and they can’t sign in again.\n\nReason (only you see it):`, '')
    if (reason === null) return
    act({ action: 'ban', id: u.id, reason }, (j) => `Banned.${j.ended ? ` ${j.ended} open meeting${j.ended === 1 ? '' : 's'} ended.` : ''}`)
  }
  if (!d) return <section className="mg-box"><h2>Meet app</h2><p className="mg-dim">Loading…</p></section>
  const userById = Object.fromEntries(d.users.map((u) => [u.id, u]))
  return (<section className="mg-box ma">
    <h2>Meet app <span className="mg-dim">{d.counts.users} account{d.counts.users === 1 ? '' : 's'}{d.counts.banned ? `, ${d.counts.banned} banned` : ''}</span></h2>
    <div className="seg" role="group" aria-label="Show"><button type="button" aria-pressed={tab === 'reports'} onClick={() => setTab('reports')}>Reports{d.counts.open ? ` (${d.counts.open} new)` : ''}</button><button type="button" aria-pressed={tab === 'users'} onClick={() => setTab('users')}>Accounts</button></div>
    {tab === 'reports' ? (d.reports.length ? <ul className="mg-list">{d.reports.map((r) => <li key={r.id} className={r.status === 'open' ? 'ma-open' : ''}>
      <div className="mg-main"><b>{REASON[r.reason]}{r.status !== 'open' ? <span className="mg-dim"> ({r.status === 'dismissed' ? 'dismissed' : 'acted on'})</span> : null}</b>
        <span className="mg-dim">“{r.title || r.code}” hosted by {r.host_user ? (r.host_name || r.host_email || 'a Meet account') : 'you'}, {day(r.created_at)}{r.reporter_name ? `, reported by ${r.reporter_name}` : ''}</span>
        {r.note ? <span className="ma-note">{r.note}</span> : null}</div>
      <div className="mg-acts">
        {r.status === 'open' && r.host_user && !r.host_banned && userById[r.host_user] ? <button className="btn btn-bad" disabled={!!busy} onClick={() => ban(userById[r.host_user])}>Ban the host</button> : null}
        {r.status === 'open' ? <button className="btn btn-line" disabled={!!busy} onClick={() => act({ action: 'dismiss', id: r.id }, 'Report dismissed.')}>Dismiss</button> : null}
      </div></li>)}</ul> : <p className="mg-dim">No reports. People in a meeting can report it from People or the More menu.</p>)
    : <>
      <form className="ma-search" onSubmit={(e) => { e.preventDefault(); load(search) }}><input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email" aria-label="Search accounts" /><button className="btn btn-line">Search</button></form>
      {d.users.length ? <ul className="mg-list">{d.users.map((u) => <li key={u.id}>
        <div className="mg-main"><b>{u.name || '(no name)'}{u.role === 'owner' ? <span className="ma-tag">You</span> : null}{u.banned_at ? <span className="ma-tag ma-bad">Banned</span> : null}</b>
          <span className="mg-dim">{u.email || 'no email'}{u.email && !u.email_verified ? ' (not verified)' : ''}. Signs in with {u.via || '?'}. {u.meetings} meeting{u.meetings === 1 ? '' : 's'}. Joined {day(u.created_at)}.</span>
          {u.banned_at ? <span className="ma-note">Banned {day(u.banned_at)}{u.banned_reason ? `: ${u.banned_reason}` : ''}</span> : null}</div>
        <div className="mg-acts">{u.role === 'owner' ? null : u.banned_at ? <button className="btn btn-line" disabled={!!busy} onClick={() => act({ action: 'unban', id: u.id }, 'Unbanned. They can sign in again.')}>Unban</button> : <button className="btn btn-bad" disabled={!!busy} onClick={() => ban(u)}>Ban</button>}</div>
      </li>)}</ul> : <p className="mg-dim">{search ? 'No accounts match.' : 'Nobody has signed in to the Meet app yet.'}</p>}
    </>}
    <style dangerouslySetInnerHTML={{ __html: `.ma h2 .mg-dim{font-weight:500;font-size:14px;margin-left:6px}.ma .seg{margin-bottom:10px}
.ma-open{background:linear-gradient(90deg,rgba(255,138,138,.08),transparent);border-radius:14px;padding-left:12px!important;padding-right:12px!important}
.ma-note{font-size:13.5px;color:var(--paper);opacity:.85;overflow-wrap:anywhere}
.ma-tag{display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;font-size:11.5px;font-weight:800;background:rgba(143,227,106,.14);color:var(--green)}.ma-tag.ma-bad{background:rgba(255,138,138,.14);color:var(--bad,#ff8a8a)}
.ma-search{display:flex;gap:8px;margin:0 0 6px;max-width:520px}.ma-search .input{flex:1}` }} />
  </section>)
}
