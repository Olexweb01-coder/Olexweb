'use client'
// Shared by the Meet app and the admin: the host's "Ask people for details" settings, and the attendance list after a meeting.
// Styles use the colour names both places define (--paper, --dim, --line, --green), scoped with gf- / ga- classes.
import { useEffect, useState } from 'react'

export const DEFAULT_FORM = { on: false, phone: 'required', email: 'optional', org: false, question: '', keep: 30 }
export const formFrom = (f) => (f ? { on: true, phone: f.phone, email: f.email, org: !!f.org, question: f.question || '', keep: f.keep ?? 30 } : { ...DEFAULT_FORM })
const KEEP = [[30, '30 days'], [90, '90 days'], [365, '1 year'], [0, 'Until I delete them']]
const keepWords = (k) => (k ? (k === 365 ? '1 year' : `${k} days`) : 'until the host deletes them')

function Level({ label, value, onChange }) {
  return (<div className="gf-row"><span>{label}</span><div className="gf-seg" role="group" aria-label={label}>
    {[['required', 'Required'], ['optional', 'Optional'], ['off', 'Don’t ask']].map(([v, l]) => <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>)}
  </div></div>)
}
export function FormSettings({ value, onChange }) {
  const f = value || DEFAULT_FORM, set = (k, v) => onChange({ ...f, [k]: v })
  return (<div className="gf">
    <label className="gf-on"><input type="checkbox" checked={!!f.on} onChange={(e) => set('on', e.target.checked)} /><span><b>Ask people for details when they join</b><small>You get an attendance list after the meeting. Most meetings don’t need this.</small></span></label>
    {f.on ? <div className="gf-body">
      <div className="gf-row"><span>Name</span><em>Always asked</em></div>
      <Level label="Phone number" value={f.phone} onChange={(v) => set('phone', v)} />
      <Level label="Email" value={f.email} onChange={(v) => set('email', v)} />
      <label className="gf-check"><input type="checkbox" checked={!!f.org} onChange={(e) => set('org', e.target.checked)} />Organisation or role (optional for them)</label>
      <label className="gf-field"><span>Your own question (optional for them)</span><input value={f.question} maxLength={160} placeholder="e.g. What would you like to learn?" onChange={(e) => set('question', e.target.value)} /></label>
      <label className="gf-field"><span>Keep their details for</span><select value={f.keep} onChange={(e) => set('keep', Number(e.target.value))}>{KEEP.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <p className="gf-note">Only you see these details. Guests see exactly what’s asked and how long it’s kept, and they’re deleted automatically after that.</p>
    </div> : null}
    <style dangerouslySetInnerHTML={{ __html: `
.gf{display:grid;gap:10px;margin:4px 0 14px;width:100%}
.gf-on{display:flex;gap:10px;align-items:flex-start;cursor:pointer}.gf-on input{margin-top:3px}.gf-on span{display:grid}.gf-on small{color:var(--dim);font-size:13px}
.gf input[type=checkbox]{width:17px;height:17px;accent-color:var(--green);flex:none}
.gf-body{display:grid;gap:10px;padding:12px 14px;border-radius:14px;border:1px solid var(--line)}
.gf-row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:14px;font-weight:600}.gf-row em{font-style:normal;color:var(--dim);font-weight:500}
.gf-seg{display:flex;padding:3px;gap:2px;border-radius:999px;border:1px solid var(--line)}
.gf-seg button{appearance:none;border:0;background:none;color:var(--dim);padding:6px 11px;border-radius:999px;font:inherit;font-size:13px;font-weight:600;cursor:pointer}
.gf-seg button[aria-pressed=true]{background:rgba(143,227,106,.16);color:var(--paper)}
.gf-check{display:flex;gap:10px;align-items:center;font-size:14px;cursor:pointer}
.gf-field{display:grid;gap:6px}.gf-field span{font-size:13px;font-weight:600;color:var(--dim)}
.gf-field input,.gf-field select{width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--line);background:transparent;color:inherit;font:inherit;font-size:15px;color-scheme:dark}
.gf-note{margin:0;font-size:13px;color:var(--dim);line-height:1.5}` }} />
  </div>)
}

// The attendance list (host only, after the meeting ends): who joined, when, for how long, and what they gave; CSV; delete.
const GA_CSS = `
.ga-modal{position:fixed;inset:0;z-index:80;display:grid;place-items:center;padding:16px;background:rgba(0,0,0,.6)}
.ga-card{width:100%;max-width:960px;max-height:calc(100dvh - 32px);overflow:auto;padding:22px;border-radius:22px;background:#151815;color:#f2efe9;border:1px solid rgba(242,239,233,.1);font-size:14.5px}
.ga-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.ga-head h2{margin:0;font-size:20px;font-weight:800}
.ga-x{appearance:none;border:0;background:none;color:rgba(242,239,233,.64);font-size:26px;width:40px;height:40px;border-radius:50%;cursor:pointer}.ga-x:hover{background:rgba(242,239,233,.06)}
.ga-dim{color:rgba(242,239,233,.64);margin:8px 0 14px}.ga-err{color:#ef7a6a}
.ga-wrap{overflow-x:auto;border-radius:14px;border:1px solid rgba(242,239,233,.1)}
.ga-table{width:100%;border-collapse:collapse;font-size:14px}.ga-table th,.ga-table td{padding:10px 12px;text-align:left;border-bottom:1px solid rgba(242,239,233,.08);white-space:nowrap}
.ga-table th{font-size:12.5px;color:rgba(242,239,233,.64);font-weight:700;background:rgba(242,239,233,.03)}.ga-table td:last-child,.ga-table th:last-child{text-align:right;font-variant-numeric:tabular-nums}
.ga-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
.ga-btn{display:inline-flex;align-items:center;padding:11px 18px;border-radius:999px;border:1px solid rgba(242,239,233,.2);background:none;color:#f2efe9;font:inherit;font-weight:700;text-decoration:none;cursor:pointer}
.ga-go{background:#8fe36a;border-color:#8fe36a;color:#0e1a0b}.ga-quiet{border-color:transparent;color:rgba(242,239,233,.64)}`

export function Attendance({ code, onClose, onDeleted }) {
  const [a, setA] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => {
    fetch('/api/meet/attendance?code=' + encodeURIComponent(code), { credentials: 'same-origin', cache: 'no-store' }).then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) setErr(j.error || 'Couldn’t open the list.'); else setA(j) }).catch(() => setErr('No connection. Try again.'))
  }, [code])
  async function remove() {
    if (!confirm('Delete this attendance list and everyone’s details now? This can’t be undone.')) return
    setBusy(true)
    const r = await fetch('/api/meet/attendance', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', code }) }).catch(() => null)
    setBusy(false); if (r && r.ok) { onDeleted && onDeleted(); onClose() } else setErr('Couldn’t delete it. Try again.')
  }
  const t = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return (<div className="ga-modal" role="dialog" aria-modal="true" aria-label="Attendance" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
    <div className="ga-card">
      <div className="ga-head"><h2>Attendance{a ? `: ${a.title}` : ''}</h2><button className="ga-x" onClick={onClose} aria-label="Close">×</button></div>
      {err ? <p className="ga-err">{err}</p> : !a ? <p className="ga-dim">Loading…</p> : <>
        <p className="ga-dim">{a.people.length} {a.people.length === 1 ? 'join' : 'joins'}. Details are kept {a.keepUntil ? 'until ' + new Date(a.keepUntil).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : 'until you delete them'}.</p>
        {a.people.length ? <div className="ga-wrap"><table className="ga-table"><thead><tr><th>Name</th>{a.form.phone !== 'off' ? <th>Phone</th> : null}{a.form.email !== 'off' ? <th>Email</th> : null}{a.form.org ? <th>Organisation or role</th> : null}{a.form.question ? <th>{a.form.question}</th> : null}<th>Joined</th><th>Left</th><th>Minutes</th></tr></thead>
          <tbody>{a.people.map((p, i) => <tr key={i}><td>{p.name}</td>{a.form.phone !== 'off' ? <td>{p.phone || ''}</td> : null}{a.form.email !== 'off' ? <td>{p.email || ''}</td> : null}{a.form.org ? <td>{p.org || ''}</td> : null}{a.form.question ? <td>{p.answer || ''}</td> : null}<td>{t(p.joinedAt)}</td><td>{t(p.leftAt)}</td><td>{p.minutes}</td></tr>)}</tbody></table></div>
          : <p className="ga-dim">Nobody joined with details.</p>}
        <div className="ga-acts"><a className="ga-btn ga-go" href={`/api/meet/attendance?code=${encodeURIComponent(code)}&format=csv`} download>Download CSV (Excel, Sheets)</a><button className="ga-btn ga-quiet" disabled={busy} onClick={remove}>Delete the list now</button></div>
      </>}
    </div>
    <style dangerouslySetInnerHTML={{ __html: GA_CSS }} />
  </div>)
}
export { keepWords }

// AI notes in the Meet app: make them from this device's recording (or the AI note taker), then read, copy, download.
// Runs on meet.olexweb.com itself, because that's where the recording's audio is kept (each address has its own storage).
export function NotesPanel({ code, title, make, onClose }) {
  const [n, setN] = useState(null), [step, setStep] = useState(''), [err, setErr] = useState('')
  useEffect(() => {
    let live = true
    ;(async () => {
      const lib = await import('./notes')
      try {
        if (make) { const r = await lib.makeNotes(code, (s) => live && setStep(s), lib.MEET_ROUTES); if (live) setN({ notes: r.notes, by: r.by, at: new Date().toISOString(), transcript: r.transcript, title }) }
        else { const r = await fetch('/api/meet/notes?code=' + encodeURIComponent(code), { credentials: 'same-origin', cache: 'no-store' }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'No notes yet.'); if (live) setN(j) }
      } catch (e) { if (live) setErr(e.message || 'The notes couldn’t be made. Try again.') }
    })()
    return () => { live = false }
  }, [code, make, title])
  async function copy() { const lib = await import('./notes'); try { await navigator.clipboard.writeText(lib.notesText(n.title || title, n.notes, n.at)); setStep('Copied.') } catch { setStep('Copy didn’t work here. Use Download.') } }
  async function dl(kind) { const lib = await import('./notes'); if (kind === 'md') lib.download(`${n.title || title} notes.md`, lib.notesText(n.title || title, n.notes, n.at)); else lib.download(`${n.title || title} transcript.txt`, n.transcript, 'text/plain') }
  const x = n && n.notes
  return (<div className="ga-modal" role="dialog" aria-modal="true" aria-label="AI notes" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
    <div className="ga-card ga-notes">
      <div className="ga-head"><h2>AI notes{title ? `: ${title}` : ''}</h2><button className="ga-x" onClick={onClose} aria-label="Close">×</button></div>
      {err ? <p className="ga-err">{err}</p> : !x ? <p className="ga-dim" role="status">{step || 'Getting ready…'}</p> : <>
        <p className="ga-sum">{x.summary}</p>
        {[['Main points', x.points], ['Decisions', x.decisions], ['Open questions', x.questions]].map(([h, items]) => items && items.length ? <section key={h}><h3>{h}</h3><ul>{items.map((t, i) => <li key={i}>{t}</li>)}</ul></section> : null)}
        {x.actions && x.actions.length ? <section><h3>Action items</h3><ul>{x.actions.map((a, i) => <li key={i}><b>{a.what}</b>{a.who || a.when ? ` (${[a.who, a.when].filter(Boolean).join(', ')})` : ''}</li>)}</ul></section> : null}
        <p className="ga-dim">Written by {n.by || 'Olex AI'} from the recording. Check names and numbers before sharing.{step ? ' ' + step : ''}</p>
        <div className="ga-acts"><button className="ga-btn ga-go" onClick={copy}>Copy notes</button><button className="ga-btn" onClick={() => dl('md')}>Download</button>{n.transcript ? <button className="ga-btn" onClick={() => dl('txt')}>Transcript</button> : null}</div>
      </>}
    </div>
    <style dangerouslySetInnerHTML={{ __html: GA_CSS + `.ga-notes{max-width:640px}.ga-sum{font-size:16px;line-height:1.6;margin:12px 0}.ga-notes h3{margin:16px 0 6px;font-size:14px;color:#8fe36a}.ga-notes ul{margin:0;padding-left:18px;display:grid;gap:5px;line-height:1.55}` }} />
  </div>)
}
