'use client'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from './icons'
import { toast, Sheet } from './ui'

async function call(payload) {
  try {
    const r = await fetch('/admin/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'same-origin' })
    const j = await r.json().catch(() => ({}))
    if (r.status === 401) { window.location.assign('/admin/login'); return { error: 'Sign in again.' } }
    return r.ok ? j : { error: j.error || 'Something went wrong. Try again.' }
  } catch { return { error: 'No connection. Try again.' } }
}
const ago = (d) => { const m = Math.round((Date.now() - new Date(d)) / 60000); return m < 60 ? `${Math.max(1, m)} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago` }

export default function ReviewsBoard({ items, link, isOwner, canReviews, canTestimonials }) {
  const router = useRouter()
  const [tab, setTab] = useState('waiting'), [busy, setBusy] = useState(null), [adding, setAdding] = useState(false), [url, setUrl] = useState(link)
  const waiting = items.filter((r) => r.status === 'waiting'), published = items.filter((r) => r.status === 'published')
  const list = tab === 'published' ? published : waiting
  async function decide(id, action, done) {
    setBusy(id); const r = await call({ action, id }); setBusy(null)
    if (r.error) toast(r.error); else { toast(done, action === 'approve'); router.refresh() }
  }
  async function linkAction(action) {
    if (action === 'link-new' && url && !window.confirm('Make a new link? The current link will stop working.')) return
    if (action === 'link-off' && !window.confirm('Switch the link off? Clients with it won\u2019t be able to send reviews.')) return
    const r = await call({ action }); if (r.error) { toast(r.error); return }
    setUrl(action === 'link-new' ? r.link : null); toast(action === 'link-new' ? 'New link ready.' : 'Link switched off.')
  }
  async function copy() { try { await navigator.clipboard.writeText(url); toast('Link copied.') } catch { toast('Couldn\u2019t copy. Press and hold the link to copy it.') } }
  const tabs = [['waiting', `Waiting (${waiting.length})`], ['published', 'Published'], ...(isOwner ? [['share', 'Ask for a review']] : [])]
  const close = useCallback(() => setAdding(false), [])
  const waMsg = 'Hi! Thank you for working with Olexweb. Would you share a short review of your experience? It takes two minutes: ' + url

  return (<>
    <div className="top"><h1 className="d">Reviews</h1>{canTestimonials ? <button className="btn btn-green" onClick={() => setAdding(true)}>Add</button> : null}</div>
    <div className="seg" role="group" aria-label="Show">{tabs.map(([k, l]) => <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}</div>
    {tab === 'share' ? (
      <div className="share">
        <b className="d" style={{ fontSize: 20, fontWeight: 700, fontStretch: '90%' }}>{url ? 'Send this link to a client.' : 'Make a link to send to clients.'}</b>
        <p style={{ color: 'var(--dim)', margin: '6px 0 0' }}>They write their review on a simple page. It waits here until you approve it.</p>
        {url ? (<>
          <code>{url.replace('https://', '')}</code>
          <div className="acts"><button className="btn btn-green" onClick={copy}>Copy link</button>
            <a className="btn btn-line" href={'https://wa.me/?text=' + encodeURIComponent(waMsg)} target="_blank" rel="noopener noreferrer">Share on WhatsApp</a>
            <a className="btn btn-line" href={url.replace('https://olexweb.com', '')} target="_blank" rel="noopener">See what clients see</a></div>
          <div className="acts" style={{ marginTop: 14 }}><button className="btn btn-line" onClick={() => linkAction('link-new')}>Make a new link</button><button className="btn btn-bad" onClick={() => linkAction('link-off')}>Switch off</button></div>
          <p className="note">Making a new link or switching it off stops the current one working straight away.</p>
        </>) : <p style={{ marginTop: 14 }}><button className="btn btn-green" onClick={() => linkAction('link-new')}>Make a review link</button></p>}
      </div>
    ) : !list.length ? <div className="empty">{tab === 'waiting' ? 'Nothing waiting. New reviews from your link will appear here.' : 'No published reviews yet.'}</div>
      : list.map((r) => (<article className="review" key={r.id}>
        <div className="who"><span><b>{r.name}</b><span>{r.role}</span></span><span className="pill">{r.source === 'link' ? 'From your link' : 'Typed in'}</span></div>
        {r.stars ? <div className="stars" aria-label={r.stars + ' out of 5'}>{'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}</div> : null}
        <blockquote>{r.text}</blockquote>
        <div className="who"><span>{ago(r.created_at)}</span>
          {!canReviews ? <span className="locked">{Icon.lock}Only Olaitan can approve</span>
            : r.status === 'waiting' ? <span className="acts"><button className="btn btn-bad" disabled={busy === r.id} onClick={() => decide(r.id, 'reject', 'Rejected.')}>Reject</button><button className="btn btn-green" disabled={busy === r.id} onClick={() => decide(r.id, 'approve', 'Approved.')}>Approve</button></span>
            : <button className="btn btn-line" disabled={busy === r.id} onClick={() => decide(r.id, 'unpublish', 'Unpublished.')}>Unpublish</button>}</div>
      </article>))}
    {adding ? <AddTestimonial canReviews={canReviews} onClose={close} onDone={() => { setAdding(false); router.refresh() }} /> : null}
  </>)
}

function AddTestimonial({ canReviews, onClose, onDone }) {
  const [f, setF] = useState({ name: '', role: '', text: '', stars: 0, consent: false }), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  async function save() {
    setBusy(true); setErr('')
    const r = await call({ action: 'add', data: { ...f, stars: f.stars || null } }); setBusy(false)
    if (r.error) { setErr(r.error); return }
    toast(r.status === 'published' ? 'Published.' : 'Sent to Olaitan for approval.', r.status === 'published'); onDone()
  }
  return (<Sheet title="Add a testimonial" onClose={onClose} foot={<button className="btn btn-green" disabled={busy} onClick={save}>{canReviews ? 'Publish' : 'Send for approval'}</button>}>
    <div className="field"><label htmlFor="t1">Client name</label><input className="input" id="t1" value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
    <div className="field"><label htmlFor="t2">Role and business</label><input className="input" id="t2" value={f.role} maxLength={120} onChange={(e) => setF({ ...f, role: e.target.value })} /></div>
    <div className="field"><label htmlFor="t3">What they said</label><textarea className="input" id="t3" value={f.text} maxLength={800} onChange={(e) => setF({ ...f, text: e.target.value })} /></div>
    <div className="field"><span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--dim)' }}>Rating (optional)</span>
      <div style={{ display: 'flex', gap: 4 }}>{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" aria-label={n + ' out of 5'} aria-pressed={f.stars === n} onClick={() => setF({ ...f, stars: f.stars === n ? 0 : n })}
        style={{ appearance: 'none', background: 'none', border: 0, cursor: 'pointer', fontSize: 26, padding: 2, color: n <= f.stars ? 'var(--green)' : 'rgba(242,239,233,.25)' }}>★</button>)}</div></div>
    <div className="switch"><span><b>I have their permission to show this</b></span><input type="checkbox" className="toggle" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} aria-label="I have their permission to show this" /></div>
    {err ? <p className="err" role="alert">{err}</p> : null}
  </Sheet>)
}
