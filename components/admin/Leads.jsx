'use client'
// The Leads inbox: enquiries from olexweb.com/start, with status, notes and a quick reply; and WhatsApp taps by page.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from './ui'

async function call(payload) {
  try {
    const r = await fetch('/admin/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'same-origin' })
    const j = await r.json().catch(() => ({}))
    if (r.status === 401) { window.location.assign('/admin/login'); return { error: 'Sign in again.' } }
    return r.ok ? j : { error: j.error || 'Something went wrong. Try again.' }
  } catch { return { error: 'No connection. Try again.' } }
}
const when = (d) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' })
const STATES = [['new', 'New'], ['contacted', 'Contacted'], ['won', 'Won'], ['lost', 'Lost']]
function reply(l) {
  const first = l.name.split(' ')[0], msg = `Hi ${first}, this is Olaitan from Olexweb. Thank you for your project details. When is a good time to talk?`
  if (l.contact.includes('@')) return { label: 'Reply by email', href: `mailto:${l.contact}?subject=${encodeURIComponent('Your project with Olexweb')}&body=${encodeURIComponent(msg)}` }
  const digits = l.contact.replace(/[^0-9]/g, '').replace(/^0/, '234')
  return { label: 'Reply on WhatsApp', href: `https://wa.me/${digits}?text=${encodeURIComponent(msg)}` }
}

export default function LeadsBoard({ leads, summary, status }) {
  const router = useRouter()
  return (<>
    <div className="top"><h1 className="d">Leads</h1></div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
      {[['New', summary.new], ['Last 30 days', summary.month], ['Won', summary.won], ['All time', summary.total]].map(([k, v]) => (
        <div key={k} className="stat"><strong className="d">{v}</strong><span>{k}</span></div>))}
    </div>
    <div className="seg" role="group" aria-label="Show">
      {[['all', 'All'], ...STATES].map(([k, l]) => <a key={k} className="segl" href={'/admin/leads' + (k === 'all' ? '' : '?status=' + k)} aria-pressed={status === k}>{l}</a>)}
    </div>
    {leads.length ? leads.map((l) => <Lead key={l.id} l={l} onDone={() => router.refresh()} />)
      : <div className="empty">{status === 'all' ? 'No enquiries yet. People can send their project details at olexweb.com/start (linked from Work with me).' : 'Nothing here.'}</div>}
    <h2 className="section-t">WhatsApp taps by page (last 30 days)</h2>
    {summary.taps.length ? <ul className="rows">{summary.taps.map((t) => <li key={t.page} className="row"><span><span className="row-t">{t.page === '/' ? 'Homepage' : t.page}</span><span className="row-s">People who tapped a WhatsApp button on this page</span></span><span className="pill">{t.n}</span></li>)}</ul>
      : <div className="empty">No taps counted yet.</div>}
    <p className="note">Taps are counted without cookies or personal data. Enquiries are kept to reply and to follow up; delete any you no longer need.</p>
  </>)
}

function Lead({ l, onDone }) {
  const [notes, setNotes] = useState(l.notes || ''), [busy, setBusy] = useState(false), r = reply(l)
  async function save(patch, msg) { setBusy(true); const x = await call({ action: 'update', id: l.id, ...patch }); setBusy(false); if (x.error) toast(x.error); else { toast(msg); onDone() } }
  async function remove() { if (!window.confirm(`Delete the enquiry from ${l.name}? This can’t be undone.`)) return; const x = await call({ action: 'delete', id: l.id }); if (x.error) toast(x.error); else { toast('Deleted.'); onDone() } }
  return (<article className="review" style={{ marginBottom: 12 }}>
    <div className="who"><span><b>{l.name}</b><span>{l.business ? l.business + ' · ' : ''}{l.contact}</span></span><span className={'pill ' + (l.status === 'new' ? 'live' : l.status === 'won' ? 'res' : '')}>{(STATES.find((s) => s[0] === l.status) || [])[1]}</span></div>
    <p style={{ margin: '10px 0', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{l.need}</p>
    <p className="note" style={{ margin: '0 0 10px' }}>{when(l.created_at)}{l.budget ? ' · Budget: ' + l.budget : ''}{l.timeline ? ' · ' + l.timeline : ''}{l.source ? ' · Came from ' + l.source : ''}{l.page ? ' · Page ' + l.page : ''}</p>
    <div className="acts" style={{ flexWrap: 'wrap' }}>
      <a className="btn btn-green" href={r.href} target="_blank" rel="noopener noreferrer" onClick={() => { if (l.status === 'new') save({ status: 'contacted' }, 'Marked as contacted.') }}>{r.label}</a>
      <select className="input" value={l.status} disabled={busy} onChange={(e) => save({ status: e.target.value }, 'Status saved.')} aria-label="Status" style={{ width: 'auto' }}>{STATES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <button type="button" className="btn btn-line" onClick={remove}>Delete</button>
    </div>
    <div className="field" style={{ marginTop: 10 }}><label htmlFor={'n' + l.id}>Notes</label><textarea id={'n' + l.id} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} style={{ minHeight: 70 }} />
      {notes !== (l.notes || '') ? <button type="button" className="btn btn-line" style={{ marginTop: 8 }} disabled={busy} onClick={() => save({ notes }, 'Notes saved.')}>Save notes</button> : null}</div>
  </article>)
}
