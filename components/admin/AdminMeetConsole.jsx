'use client'
// Admin → Olexweb Meet → Overview (Install E): a SaaS console's first screen: live numbers, the last 14 days, what needs
// you, the newest reviews and this month's busiest hosts. Refreshes itself every minute.
import { useEffect, useState } from 'react'

const naira = (n) => '₦' + Math.round(n || 0).toLocaleString('en-NG')
const num = (n) => Math.round(n || 0).toLocaleString('en-GB')
async function act(body) {
  const r = await fetch('/admin/api/meetings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'That didn’t work.')
  return j
}
export function useConsole() {
  const [d, setD] = useState(null), [err, setErr] = useState('')
  useEffect(() => {
    let stop = false
    const load = () => act({ action: 'console' }).then((j) => { if (!stop) setD(j) }, (e) => { if (!stop) setErr(e.message) })
    load(); const t = setInterval(load, 60_000)
    return () => { stop = true; clearInterval(t) }
  }, [])
  return [d, err]
}
// the strip of numbers at the top of every tab
export function Kpis({ d }) {
  if (!d) return <div className="mc-kpis mc-loading" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <div key={i} className="mc-kpi" />)}</div>
  const k = d.k, up = k.revenue_last ? Math.round(((k.revenue - k.revenue_last) / k.revenue_last) * 100) : null
  const items = [
    ['Live now', num(k.live), k.live ? 'people in meetings' : 'nobody in a meeting', k.live ? 'live' : ''],
    ['Last 24 hours', num(k.today), 'meetings'],
    ['Accounts', num(k.accounts), `+${num(k.new7)} this week`],
    ['Active hosts', num(k.hosts30), 'last 30 days'],
    ['Pro', num(k.pro), 'accounts on Pro'],
    ['Revenue', naira(k.revenue), up == null ? 'this month' : `this month · ${up >= 0 ? '▲' : '▼'} ${Math.abs(up)}%`],
  ]
  return <div className="mc-kpis">{items.map(([l, v, s, c]) => <div key={l} className={'mc-kpi' + (c ? ' mc-' + c : '')}><span>{l}</span><b>{v}</b><small>{s}</small></div>)}</div>
}
export default function AdminMeetConsole({ d, err, go }) {
  if (!d) return <section className="mg-box"><p className="mg-dim">{err || 'Loading…'}</p></section>
  const k = d.k, max = Math.max(1, ...d.days.map((x) => x.meetings)), day = (s) => new Date(s + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const needs = [[k.tickets, 'support request', 'support'], [k.transfers, 'bank transfer to confirm', 'revenue'], [k.invoices, 'unpaid invoice', 'revenue']].filter(([n]) => n)
  const srv = d.servers || {}
  return (<div className="mc-grid">
    <section className="mg-box mc-chart">
      <div className="mc-row"><h2>Last 14 days</h2><small className="mg-dim">{num(d.days.reduce((a, x) => a + x.meetings, 0))} meetings · {num(d.days.reduce((a, x) => a + x.people, 0))} joins · {(() => { const n = d.days.reduce((a, x) => a + x.signups, 0); return `${num(n)} new account${n === 1 ? '' : 's'}` })()}</small></div>
      <div className="mc-bars" role="img" aria-label="Meetings per day for the last 14 days">{d.days.map((x) => <div key={x.day} className="mc-bar" title={`${day(x.day)}: ${x.meetings} meetings, ${x.people} joins, ${x.signups} new accounts`}>
        <i style={{ height: Math.max(3, (x.meetings / max) * 100) + '%' }} /><span>{new Date(x.day + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric' })}</span></div>)}</div>
    </section>
    <section className="mg-box">
      <h2>Needs you</h2>
      {needs.length ? <ul className="mc-list">{needs.map(([n, what, tab]) => <li key={what}><span><b>{n}</b> {what}{n === 1 ? '' : 's'}</span><button className="btn btn-line" onClick={() => go(tab)}>Open</button></li>)}</ul>
        : <p className="mg-dim">All clear. Nothing is waiting for you.</p>}
      <h2 style={{ marginTop: 16 }}>Video servers</h2>
      <ul className="mc-list">
        <li><span><i className={'mc-dot mc-' + (srv.self || 'off')} />Free server</span><small className="mg-dim">{srv.self === 'ok' ? 'Working' : srv.self === 'down' ? 'Not responding: using the backup' : 'Not set up yet'}</small></li>
        <li><span><i className={'mc-dot mc-' + (srv.cloud ? 'ok' : 'off')} />Backup (LiveKit Cloud)</span><small className="mg-dim">{srv.cloud ? 'Ready' : 'Not set up'}</small></li>
      </ul>
    </section>
    <section className="mg-box">
      <div className="mc-row"><h2>Latest reviews</h2>{k.rating ? <small className="mg-dim">★ {k.rating} from {k.ratings} in 30 days</small> : null}</div>
      {d.reviews.length ? <ul className="mc-list">{d.reviews.map((r, i) => <li key={i} className="mc-review"><span><b className="mc-stars">{'★'.repeat(r.stars)}</b> “{r.review}”</span><small className="mg-dim">{r.title}</small></li>)}</ul> : <p className="mg-dim">No written reviews yet.</p>}
    </section>
    <section className="mg-box">
      <h2>Busiest hosts this month</h2>
      {d.hosts.length ? <ul className="mc-list">{d.hosts.map((h, i) => <li key={i}><span><b>{h.name || h.email}</b></span><small className="mg-dim">{h.meetings} meetings · {num(h.people)} joins</small></li>)}</ul> : <p className="mg-dim">No hosts yet this month.</p>}
    </section>
  </div>)
}
export const CONSOLE_CSS = `.mc-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap}.mc-head h1{margin:0}.mc-head p{margin:4px 0 0;color:var(--dim);font-size:14px}
.mc-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}.mc-kpi{display:grid;gap:3px;padding:14px;border-radius:16px;border:1px solid var(--line);background:var(--raise);min-height:78px}
.mc-kpi span{font-size:12.5px;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:.04em}.mc-kpi b{font-size:24px;font-weight:800;font-variant-numeric:tabular-nums}.mc-kpi small{font-size:12.5px;color:var(--dim)}
.mc-kpi.mc-live b{color:var(--green)}.mc-loading .mc-kpi{animation:mc-pulse 1.4s ease-in-out infinite}@keyframes mc-pulse{50%{opacity:.5}}
.mc-tabs{display:flex;gap:4px;overflow-x:auto;border-bottom:1px solid var(--line);scrollbar-width:none}.mc-tabs button{appearance:none;background:none;border:0;border-bottom:2px solid transparent;color:var(--dim);font:inherit;font-weight:700;font-size:14.5px;padding:10px 14px;cursor:pointer;white-space:nowrap;display:inline-flex;gap:6px;align-items:center}
.mc-tabs button[aria-selected=true]{color:var(--paper,inherit);border-bottom-color:var(--green)}.mc-tabs i{font-style:normal;font-size:11px;min-width:18px;height:18px;border-radius:9px;background:#ef7a6a;color:#fff;display:grid;place-items:center;padding:0 5px}
.mc-grid{display:grid;grid-template-columns:1.5fr 1fr;gap:14px}.mc-chart{grid-column:1/-1}.mc-row{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap}
.mc-bars{display:grid;grid-template-columns:repeat(14,1fr);gap:6px;height:150px;align-items:end;margin-top:8px}.mc-bar{display:grid;grid-template-rows:1fr auto;height:100%;gap:4px;text-align:center}
.mc-bar i{align-self:end;display:block;border-radius:6px 6px 2px 2px;background:linear-gradient(180deg,var(--green),rgba(143,227,106,.45));min-height:3px}.mc-bar span{font-size:11px;color:var(--dim)}
.mc-list{list-style:none;margin:0;padding:0;display:grid;gap:2px}.mc-list li{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid var(--line);font-size:14.5px}.mc-list li:first-child{border-top:0}
.mc-review{align-items:flex-start!important;flex-direction:column}.mc-stars{color:#f5c542}.mc-dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:8px;background:#777}.mc-dot.mc-ok{background:var(--green)}.mc-dot.mc-down{background:#ef7a6a}
@media (max-width:1100px){.mc-kpis{grid-template-columns:repeat(3,1fr)}}@media (max-width:760px){.mc-grid{grid-template-columns:1fr}.mc-kpis{grid-template-columns:repeat(2,1fr)}}`
