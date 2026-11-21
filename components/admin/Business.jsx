'use client'
// Admin → Ventures (Install E): every business that makes money, side by side: income this month and the last six,
// users, status, and a way in to manage each one. Olexweb Meet's numbers are live; others get income added by hand.
import { useState } from 'react'

const naira = (n) => '₦' + Math.round(n || 0).toLocaleString('en-NG')
const mon = (m) => new Date(m + '-01T12:00:00Z').toLocaleDateString('en-GB', { month: 'short' })
async function act(body) {
  const r = await fetch('/admin/api/business', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'That didn’t work.')
  return j
}
const STATUS = { live: 'Live', building: 'Building', paused: 'Paused' }
export default function Business({ initial }) {
  const [d, setD] = useState(initial), [edit, setEdit] = useState(null), [inc, setInc] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const reload = async () => setD(await act({ action: 'list' }))
  async function run(body, after) { setBusy(true); setErr(''); try { await act(body); await reload(); if (after) after() } catch (e) { setErr(e.message) } finally { setBusy(false) } }
  const change = d.lastMonth ? Math.round(((d.thisMonth - d.lastMonth) / d.lastMonth) * 100) : null
  const thisMonth = d.months[d.months.length - 1]
  return (<div className="bz">
    <div className="bz-head"><div><h1 className="d">Ventures</h1><p>The businesses you’ve built that make money. Your public ventures list for the website is now in <a href="/admin/projects#ventures">Projects</a>.</p></div>
      <button className="btn btn-green" onClick={() => setEdit({ name: '', line: '', url: '', adminUrl: '', status: 'building', users: '', notes: '' })}>Add a venture</button></div>
    {err ? <p className="bz-err" role="alert">{err}</p> : null}
    <div className="bz-kpis">
      <div className="bz-kpi"><span>This month</span><b>{naira(d.thisMonth)}</b><small>{change == null ? 'across all ventures' : `${change >= 0 ? '▲' : '▼'} ${Math.abs(change)}% on last month`}</small></div>
      <div className="bz-kpi"><span>Last month</span><b>{naira(d.lastMonth)}</b><small>across all ventures</small></div>
      <div className="bz-kpi"><span>All time</span><b>{naira(d.allTime)}</b><small>{d.ventures.length} venture{d.ventures.length === 1 ? '' : 's'}</small></div>
    </div>
    <div className="bz-list">{d.ventures.map((v) => { const max = Math.max(1, ...d.months.map((m) => v.months[m]))
      return (<section key={v.id} className="bz-card">
        <div className="bz-top"><div><h2>{v.name} <span className={'bz-st bz-' + v.status}>{STATUS[v.status] || v.status}</span>{v.kind === 'meet' ? <span className="bz-st bz-auto">Connected</span> : null}</h2>{v.line ? <p>{v.line}</p> : null}</div>
          <div className="bz-acts">{v.adminUrl ? <a className="btn btn-green" href={v.adminUrl} {...(v.adminUrl.startsWith('http') ? { target: '_blank', rel: 'noopener' } : {})}>Manage</a> : null}
            {v.url ? <a className="btn btn-line" href={v.url} target="_blank" rel="noopener">Open ↗</a> : null}
            <button className="btn btn-line" onClick={() => setEdit({ id: v.id, name: v.name, line: v.line || '', url: v.url || '', adminUrl: v.adminUrl || '', status: v.status, users: v.users ?? '', notes: v.notes || '', kind: v.kind })}>Edit</button></div></div>
        <div className="bz-body">
          <div className="bz-nums"><div><span>This month</span><b>{naira(v.thisMonth)}</b></div><div><span>All time</span><b>{naira(v.total)}</b></div>
            <div><span>Users</span><b>{v.users == null ? '–' : v.users.toLocaleString('en-GB')}</b></div>
            {v.extra ? <><div><span>On Pro</span><b>{v.extra.pro}</b></div><div><span>Meetings, 30 days</span><b>{v.extra.meetings30}</b></div>{v.extra.tickets ? <div><span>Support waiting</span><b className="bz-warn">{v.extra.tickets}</b></div> : null}</> : null}</div>
          <div className="bz-bars" role="img" aria-label={`${v.name} income for the last six months`}>{d.months.map((m) => <div key={m} title={`${mon(m)}: ${naira(v.months[m])}`}><i style={{ height: Math.max(2, (v.months[m] / max) * 100) + '%' }} /><span>{mon(m)}</span></div>)}</div>
        </div>
        {v.kind !== 'meet' ? <div className="bz-inc">
          {inc && inc.ventureId === v.id ? <form className="bz-incform" onSubmit={(e) => { e.preventDefault(); run({ action: 'income', ...inc }, () => setInc(null)) }}>
            <input className="input" type="month" value={inc.month} onChange={(e) => setInc({ ...inc, month: e.target.value })} aria-label="Month" />
            <input className="input" type="number" min={1} value={inc.amount} onChange={(e) => setInc({ ...inc, amount: e.target.value })} placeholder="Amount (₦)" aria-label="Amount in naira" />
            <input className="input" maxLength={200} value={inc.note} onChange={(e) => setInc({ ...inc, note: e.target.value })} placeholder="Note (optional)" aria-label="Note" />
            <button className="btn btn-green" disabled={busy}>Add</button><button type="button" className="btn btn-line" onClick={() => setInc(null)}>Cancel</button></form>
            : <button className="btn btn-line" onClick={() => setInc({ ventureId: v.id, month: thisMonth, amount: '', note: '' })}>Add income</button>}
          {v.entries.length ? <ul className="bz-entries">{v.entries.map((e) => <li key={e.id}><span>{mon(e.month)} {e.month.slice(0, 4)} · <b>{naira(e.amount)}</b>{e.note ? ' · ' + e.note : ''}</span><button className="bz-x" disabled={busy} onClick={() => run({ action: 'income-delete', id: e.id })} aria-label="Remove this entry">×</button></li>)}</ul> : null}
        </div> : <p className="bz-dim">Income comes in by itself from Meet’s payments (Paystack and confirmed bank transfers).</p>}
      </section>) })}</div>

    {edit ? <div className="bz-modal" role="dialog" aria-modal="true" aria-label={edit.id ? 'Edit venture' : 'Add a venture'} onClick={(e) => { if (e.target === e.currentTarget) setEdit(null) }}>
      <form className="bz-sheet" onSubmit={(e) => { e.preventDefault(); run({ action: 'save', ...edit }, () => setEdit(null)) }}>
        <h2>{edit.id ? 'Edit ' + edit.name : 'Add a venture'}</h2>
        {[['name', 'Name'], ['line', 'One line about it'], ['url', 'Its website (https://…)'], ['adminUrl', 'Where you manage it (https://… or /admin/…)']].map(([k, l]) =>
          <label key={k}><span className="mg-lab">{l}</span><input className="input" value={edit[k]} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} required={k === 'name'} /></label>)}
        <div className="bz-two"><label><span className="mg-lab">Status</span><select className="input" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>{Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          {edit.kind !== 'meet' ? <label><span className="mg-lab">Users (optional)</span><input className="input" type="number" min={0} value={edit.users} onChange={(e) => setEdit({ ...edit, users: e.target.value })} /></label> : null}</div>
        <label><span className="mg-lab">Notes (only you see these)</span><textarea className="input" rows={3} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></label>
        <div className="bz-acts"><button className="btn btn-green" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button><button type="button" className="btn btn-line" onClick={() => setEdit(null)}>Cancel</button>
          {edit.id && edit.kind !== 'meet' ? <button type="button" className="btn btn-line bz-del" disabled={busy} onClick={() => { if (window.confirm(`Remove ${edit.name} and its income records?`)) run({ action: 'delete', id: edit.id }, () => setEdit(null)) }}>Remove</button> : null}</div>
      </form></div> : null}

    <style dangerouslySetInnerHTML={{ __html: `.bz{display:grid;gap:16px;max-width:1180px}.bz-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap}.bz-head h1{margin:0}.bz-head p{margin:4px 0 0;color:var(--dim);font-size:14px}.bz-head a{color:var(--green)}
.bz-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.bz-kpi,.bz-card{border:1px solid var(--line);background:var(--raise);border-radius:18px}.bz-kpi{display:grid;gap:3px;padding:16px}
.bz-kpi span,.bz-nums span{font-size:12.5px;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:.04em}.bz-kpi b{font-size:28px;font-weight:800;font-variant-numeric:tabular-nums}.bz-kpi small{font-size:13px;color:var(--dim)}
.bz-list{display:grid;gap:14px}.bz-card{padding:18px;display:grid;gap:14px}.bz-top{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.bz-top h2{margin:0;font-size:19px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}.bz-top p{margin:4px 0 0;color:var(--dim);font-size:14px}
.bz-st{font-size:11.5px;font-weight:800;padding:3px 9px;border-radius:999px;border:1px solid var(--line)}.bz-live{color:var(--green);border-color:rgba(143,227,106,.45)}.bz-building{color:#f0b35e;border-color:rgba(240,179,94,.45)}.bz-paused{color:var(--dim)}.bz-auto{color:#7fb8ff;border-color:rgba(127,184,255,.4)}
.bz-acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.bz-acts .btn{padding:9px 15px;font-size:14px}.bz-body{display:grid;grid-template-columns:1fr 1.1fr;gap:18px;align-items:end}
.bz-nums{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.bz-nums div{display:grid;gap:2px}.bz-nums b{font-size:19px;font-weight:800;font-variant-numeric:tabular-nums}.bz-warn{color:#ef7a6a}
.bz-bars{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;height:110px;align-items:end}.bz-bars div{display:grid;grid-template-rows:1fr auto;height:100%;gap:4px;text-align:center}.bz-bars i{align-self:end;display:block;border-radius:6px 6px 2px 2px;background:linear-gradient(180deg,var(--green),rgba(143,227,106,.4))}.bz-bars span{font-size:11.5px;color:var(--dim)}
.bz-inc{display:grid;gap:8px;justify-items:start}.bz-incform{display:flex;gap:8px;flex-wrap:wrap}.bz-incform .input{width:auto;min-width:130px}.bz-entries{list-style:none;margin:0;padding:0;display:grid;gap:4px;width:100%}.bz-entries li{display:flex;justify-content:space-between;align-items:center;font-size:14px;padding:6px 0;border-top:1px solid var(--line)}
.bz-x{appearance:none;background:none;border:0;color:var(--dim);font-size:18px;cursor:pointer;width:28px;height:28px;border-radius:50%}.bz-x:hover{background:rgba(239,122,106,.12);color:#ef7a6a}.bz-dim{margin:0;color:var(--dim);font-size:13.5px}.bz-err{color:#ef7a6a;margin:0}
.bz-modal{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.55);display:grid;place-items:center;padding:16px}.bz-sheet{width:min(560px,100%);max-height:90vh;overflow:auto;display:grid;gap:10px;padding:20px;border-radius:20px;background:var(--bg,#0d0f0d);border:1px solid var(--line)}
.bz-sheet h2{margin:0 0 4px}.bz-sheet label{display:grid;gap:4px}.bz-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}.bz-del{margin-left:auto;color:#ef7a6a}
@media (max-width:760px){.bz-kpis{grid-template-columns:1fr}.bz-body{grid-template-columns:1fr}.bz-nums{grid-template-columns:repeat(2,1fr)}}` }} />
  </div>)
}
