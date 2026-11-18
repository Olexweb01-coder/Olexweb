'use client'
// Install 31: the automation's switches, all in one card at the top of Automation → Today. One row per switch: what it
// is, what happens when it's on (or off), and a big ON/OFF. Plus what needs you, with the button right there.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from './ui'
export default function ControlPanel({ switches = [], waiting = 0 }) {
  const router = useRouter(), [list, setList] = useState(switches), [busy, setBusy] = useState('')
  async function flip(s) {
    setBusy(s.key)
    try {
      const r = await fetch('/admin/api/switches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ key: s.key, on: !s.on }) }), j = await r.json().catch(() => ({}))
      if (r.status === 401) { window.location.assign('/admin/login'); return }
      if (!r.ok) { toast(j.error || 'That didn’t work. Try again.'); return }
      setList(j.switches); toast(`${s.name}: ${!s.on ? 'ON' : 'OFF'}`); router.refresh()
    } catch { toast('No connection. Try again.') } finally { setBusy('') }
  }
  async function approveAll() {
    setBusy('approve')
    try { const r = await fetch('/admin/api/youtube', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action: 'plan-approve-all' }) }), j = await r.json().catch(() => ({}))
      toast(r.ok ? `${j.approved} approved. They’re made and posted at their times.` : (j.error || 'That didn’t work.')); router.refresh() } catch { toast('No connection. Try again.') } finally { setBusy('') }
  }
  return (<section className="cp" aria-label="Switches">
    {waiting ? <div className="cp-need"><div><b>{waiting} video{waiting === 1 ? '' : 's'} wait{waiting === 1 ? 's' : ''} for your approval</b><span>Nothing posts until you approve. Look first, or approve them all.</span></div>
      <div className="cp-acts"><a className="cp-btn cp-line" href="/admin/automation/plan">Look first</a><button className="cp-btn cp-go" disabled={!!busy} onClick={approveAll}>{busy === 'approve' ? 'Approving…' : 'Approve all'}</button></div></div> : null}
    <h2 className="cp-h">Your switches</h2>
    {list.map((s) => (<div key={s.key} className="cp-row">
      <div className="cp-txt"><b>{s.name}</b><span>{s.on ? s.onText : s.offText}</span>{s.warn ? <em>{s.warn}</em> : null}</div>
      <button className={'cp-tog' + (s.on ? ' on' : '')} role="switch" aria-checked={s.on} aria-label={s.name} disabled={!!busy} onClick={() => flip(s)}><i /><span>{busy === s.key ? '…' : s.on ? 'ON' : 'OFF'}</span></button>
    </div>))}
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
  </section>)
}
const CSS = `
.cp{margin:0 0 18px;padding:18px 20px;border:1px solid var(--line);border-radius:18px;background:var(--raise,rgba(255,255,255,.03))}
.cp-h{margin:4px 0 6px;font-size:18px}
.cp-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 0;border-top:1px solid var(--line)}
.cp-row:first-of-type{border-top:0}
.cp-txt{display:flex;flex-direction:column;gap:3px;min-width:0}.cp-txt b{font-size:16px}.cp-txt span{font-size:14px;color:var(--dim);line-height:1.4}.cp-txt em{font-style:normal;font-size:13.5px;color:#ff8a8a}
.cp-tog{flex:none;display:flex;align-items:center;gap:8px;width:96px;height:44px;padding:4px;border-radius:999px;border:0;background:#3a3d3a;color:#fff;cursor:pointer;font:800 13px inherit}
.cp-tog i{width:36px;height:36px;border-radius:999px;background:#fff;transition:transform .15s}.cp-tog span{flex:1;text-align:center}
.cp-tog.on{background:var(--green,#8fe36a);color:#06140a;flex-direction:row-reverse}.cp-tog:disabled{opacity:.6}
.cp-need{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:14px 16px;margin-bottom:12px;border-radius:14px;background:rgba(245,166,35,.14);border:1px solid rgba(245,166,35,.45)}
.cp-need div:first-child{display:flex;flex-direction:column;gap:3px}.cp-need span{font-size:14px;color:var(--dim)}
.cp-acts{display:flex;gap:8px;flex-wrap:wrap}.cp-btn{padding:11px 18px;border-radius:999px;font:800 14.5px inherit;cursor:pointer;text-decoration:none;border:1px solid var(--line)}
.cp-go{background:var(--green,#8fe36a);color:#06140a;border-color:transparent}.cp-line{background:none;color:var(--paper,#f2efe9)}
@media (max-width:560px){.cp{padding:14px}.cp-tog{width:84px}}
`
