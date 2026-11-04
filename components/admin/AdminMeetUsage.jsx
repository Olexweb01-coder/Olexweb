'use client'
// Admin → Meetings → Usage: this month's meeting minutes against your LiveKit plan, people in meetings now, the pace,
// and database storage; set your limits (presets for LiveKit's plans). Warnings and pauses: lib/meet/usage.js.
import { useEffect, useState } from 'react'
import { toast } from './ui'

const P = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const day = (iso) => { const d = new Date(iso); return `${d.getUTCDate()} ${P[d.getUTCMonth()]}` }
const num = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')       // same on server and browser
const mb = (b) => (b == null ? '?' : b >= 1024 ** 3 ? (b / 1024 ** 3).toFixed(2) + ' GB' : Math.max(1, Math.round(b / 1024 ** 2)) + ' MB')

export default function AdminMeetUsage() {
  const [d, setD] = useState(null), [edit, setEdit] = useState(null), [busy, setBusy] = useState(false)
  const call = (body) => fetch('/admin/api/meetings', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const load = async () => { const r = await call({ action: 'usage' }).catch(() => null); if (r && r.ok) setD(await r.json()) }
  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t) }, [])
  async function save() {
    setBusy(true)
    const r = await call({ action: 'limits', minutes: edit.minutes, people: edit.people }).catch(() => null), j = r ? await r.json().catch(() => ({})) : {}
    setBusy(false); if (!r || !r.ok) { toast(j.error || 'That didn’t save.'); return } toast('Limits saved.'); setEdit(null); load()
  }
  if (!d) return <section className="mg-box" id="usage"><h2>Usage this month</h2><p className="mg-dim">Loading…</p></section>
  const u = d.usage, db = d.databases, bar = Math.min(100, u.pct)
  return (<section className={'mg-box mu' + (u.level !== 'ok' ? ' mu-' + u.level : '')} id="usage">
    <div className="mu-head"><h2>Usage this month</h2><span className="mg-dim">Resets {day(u.resetsAt)}</span></div>
    {u.level === 'stop' ? <p className="mu-alert">Over 95% of this month’s minutes: <b>other hosts can’t start new meetings</b> until {day(u.resetsAt)}. Yours still work, and meetings already going carry on. Raise the limit below if you’ve upgraded.</p>
      : u.level === 'warn' ? <p className="mu-alert">Over 80% of this month’s minutes. At 95%, other hosts’ new meetings pause until the month resets.</p> : null}
    <div className="mu-grid">
      <div className="mu-stat mu-wide"><span>Meeting minutes</span><b>{num(u.minutes)} <small>of {num(u.allowance)}</small></b>
        <div className="mu-bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={u.pct} aria-label="Minutes used"><i style={{ width: bar + '%' }} /></div>
        <small>{u.pct}% used{u.projected != null ? `. At this pace, about ${num(u.projected)} by ${day(u.resetsAt)}${u.projected > u.allowance ? ' (over the limit)' : ''}` : ''}.</small></div>
      <div className="mu-stat"><span>In meetings now</span><b>{num(u.live)} <small>of {num(u.maxPeople)}</small></b><small>{u.live >= u.maxPeople ? 'Full: new people are told to try again' : 'People at once'}</small></div>
      <div className="mu-stat"><span>Databases</span><b>{mb(db.main)} <small>main</small></b><small>{db.meetOwn ? `${mb(db.meet)} Meet’s own` : 'Meet shares the main one'}. Free plan: 1 GB each. Compute time: see Neon’s dashboard.</small></div>
    </div>
    {edit ? <div className="mu-edit">
      <p className="mg-lab">Match your LiveKit plan</p>
      <div className="mu-presets">{d.presets.map((p) => <button key={p.id} type="button" className="btn btn-line" onClick={() => setEdit({ minutes: p.minutes, people: p.people })}>{p.name}</button>)}</div>
      <div className="mu-fields"><label><span className="mg-lab">Minutes a month</span><input className="input" type="number" min={100} value={edit.minutes} onChange={(e) => setEdit({ ...edit, minutes: e.target.value })} /></label>
        <label><span className="mg-lab">People at once</span><input className="input" type="number" min={2} value={edit.people} onChange={(e) => setEdit({ ...edit, people: e.target.value })} /></label></div>
      <div className="mg-acts"><button className="btn btn-green" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save limits'}</button><button className="btn btn-line" onClick={() => setEdit(null)}>Cancel</button></div>
    </div> : <button className="btn btn-line mu-change" onClick={() => setEdit({ minutes: u.allowance, people: u.maxPeople })}>Change limits</button>}
    <style dangerouslySetInnerHTML={{ __html: `.mu-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px}.mu-head h2{margin:0 0 12px}
.mu-grid{display:grid;grid-template-columns:2fr 1fr 1fr;gap:12px}.mu-stat{display:grid;gap:4px;align-content:start;padding:14px;border-radius:14px;border:1px solid var(--line)}
.mu-stat>span{font-size:13px;font-weight:600;color:var(--dim)}.mu-stat b{font-size:24px;font-weight:800;font-variant-numeric:tabular-nums}.mu-stat b small{font-size:14px;font-weight:600;color:var(--dim)}.mu-stat>small{font-size:13px;color:var(--dim);line-height:1.5}
.mu-bar{height:10px;border-radius:999px;background:rgba(242,239,233,.08);overflow:hidden;margin:4px 0}.mu-bar i{display:block;height:100%;border-radius:999px;background:var(--green);transition:width .4s}
.mu-warn .mu-bar i{background:#f0b35e}.mu-stop .mu-bar i{background:#ef7a6a}
.mu-alert{margin:0 0 12px;padding:12px 14px;border-radius:12px;background:rgba(240,179,94,.12);font-size:14.5px;line-height:1.55}.mu-stop .mu-alert{background:rgba(239,122,106,.12)}
.mu-change{margin-top:12px}.mu-edit{margin-top:14px;display:grid;gap:10px}.mu-presets{display:flex;gap:8px;flex-wrap:wrap}
.mu-fields{display:grid;grid-template-columns:repeat(2,minmax(0,220px));gap:10px}.mu-fields label{display:grid;gap:6px}
@media (max-width:760px){.mu-grid{grid-template-columns:1fr}.mu-fields{grid-template-columns:1fr 1fr}}` }} />
  </section>)
}
