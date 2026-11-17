'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from './icons'
import { act, toast, Sheet, ImagePicker, Notice } from './ui'

const KINDS = ['Client website', 'Own product (SaaS)', 'Own product (AI)']
const PILL = { live: ['live', 'Live'], hidden: ['', 'Hidden'], draft: ['draft', 'Draft'], waiting: ['draft', 'Waiting for approval'] }
const thumb = (src) => (src || '').replace(/-full\.webp$/, '.webp')

export default function ProjectsBoard({ items, canPublish, isOwner }) {
  const router = useRouter()
  const [list, setList] = useState(items), [edit, setEdit] = useState(null), [link, setLink] = useState(false)
  const drag = useRef(null), rows = useRef([])
  useEffect(() => { if (!drag.current) setList(items) }, [items])     // after a save, show the fresh list from the server

  function down(e, i) {
    if (!canPublish) return
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { active: true, from: i, y: e.clientY, h: rows.current[i] ? rows.current[i].offsetHeight : 64, moved: false }
  }
  function move(e) {
    const d = drag.current; if (!d || !d.active) return
    const steps = Math.round((e.clientY - d.y) / d.h)
    if (!steps) return
    const to = Math.max(0, Math.min(list.length - 1, d.from + steps)); if (to === d.from) return
    const next = list.slice(); const [it] = next.splice(d.from, 1); next.splice(to, 0, it)
    setList(next); d.y += (to - d.from) * d.h; d.from = to; d.moved = true
  }
  async function up() {
    const d = drag.current; drag.current = null; if (!d || !d.moved) return
    const r = await act({ action: 'reorder', type: 'project', order: list.map((p) => p.id) })
    if (r.error) { toast(r.error); setList(items) } else { toast('Order saved.'); router.refresh() }
  }
  const close = useCallback(() => setEdit(null), [])

  return (<>
    <div className="top"><h1 className="d">Projects</h1><div style={{ display: 'flex', gap: 8 }}><button className="btn btn-line" onClick={() => setLink(true)}>Add from a link</button><button className="btn btn-green" onClick={() => setEdit({ isNew: true, data: { kind: 'Client website', built: [] } })}>Add</button></div></div>
    {link ? <FromLink onClose={() => setLink(false)} onDone={(r) => { setLink(false); router.refresh(); setEdit({ isNew: false, data: { ...r.data, id: r.id, status: 'draft' } }) }} /> : null}
    <Notice />
    <ul className="rows" onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      {list.map((p, i) => (
        <li key={p.id} ref={(el) => (rows.current[i] = el)} className="row click" onClick={() => setEdit({ data: p })}>
          {p.image ? <img className="thumb" src={thumb(p.image)} alt="" width="64" height="44" /> : <span className="thumb" />}
          <span><span className="row-t">{p.name}</span><span className="row-s">{p.kind}</span></span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={'pill ' + (PILL[p.status] || PILL.draft)[0]}>{(PILL[p.status] || PILL.draft)[1]}</span>
            {canPublish ? <span className="handle" role="button" aria-label={'Drag to move ' + p.name} style={{ touchAction: 'none' }} onPointerDown={(e) => down(e, i)} onClick={(e) => e.stopPropagation()}>{Icon.grip}</span> : null}
          </span>
        </li>))}
    </ul>
    <p className="note">{canPublish ? 'Drag the handle to change the order on the Portfolio page. Hidden projects stay saved but don\u2019t show on the site.' : 'Only Olaitan can change the order or what is live. You can add drafts and send them for approval.'}</p>
    {edit ? <ProjectEditor key={edit.data.id || 'new'} item={edit} canPublish={canPublish} isOwner={isOwner} onClose={close} onDone={() => { setEdit(null); router.refresh() }} /> : null}
  </>)
}

function ProjectEditor({ item, canPublish, isOwner, onClose, onDone }) {
  const p = item.data, [f, setF] = useState({ name: p.name || '', kind: p.kind || 'Client website', role: p.role || '', text: p.text || '', built: p.built || [], result: p.result || '', url: p.url || '', image: p.image || '' })
  const [chip, setChip] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const [id, setId] = useState(p.id || null)
  const status = p.status || 'draft', locked = !canPublish && ['live', 'hidden'].includes(status)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  function addChip() { const c = chip.trim(); if (c && !f.built.includes(c)) setF({ ...f, built: [...f.built, c] }); setChip('') }

  async function go(action, done) {
    setBusy(true); setErr('')
    let r = { id }
    if (!locked && ['save', 'publish', 'submit'].includes(action)) { r = await act({ action: 'save', type: 'project', id, data: f }); if (!r.error) setId(r.id) }
    if (!r.error && action !== 'save') r = await act({ action, type: 'project', id: r.id })
    setBusy(false)
    if (r.error) { setErr(r.error); return }
    toast(done, action === 'publish'); onDone()
  }
  const isLive = status === 'live'
  const foot = locked ? null : canPublish
    ? (isLive ? <><button className="btn btn-line" disabled={busy} onClick={() => go('hide', 'Hidden from the site.')}>Hide from site</button><button className="btn btn-green" disabled={busy} onClick={() => go('publish', 'Published.')}>Save changes</button></>
              : <><button className="btn btn-line" disabled={busy} onClick={() => go('save', 'Draft saved.')}>Save draft</button><button className="btn btn-green" disabled={busy} onClick={() => go('publish', 'Published.')}>Publish</button></>)
    : <><button className="btn btn-line" disabled={busy} onClick={() => go('save', 'Draft saved.')}>Save draft</button><button className="btn btn-green" disabled={busy} onClick={() => go('submit', 'Sent to Olaitan for approval.')}>Send for approval</button></>

  return (<Sheet title={item.isNew ? 'Add a project' : f.name || 'Project'} onClose={onClose} foot={foot}>
    {locked ? <p className="read-only">This project is on the site. Only Olaitan can change it.</p> : null}
    <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0 }}>
      <ImagePicker value={f.image} onChange={(v) => setF({ ...f, image: v })} kind="screenshot" label="Screenshot" />
      {id ? <Shots id={id} image={f.image} onPick={(v) => setF({ ...f, image: v })} /> : null}
      <div className="field"><label htmlFor="pj1">Name</label><input className="input" id="pj1" value={f.name} onChange={set('name')} maxLength={80} /></div>
      <div className="field"><label htmlFor="pj2">Type</label><select className="input" id="pj2" value={f.kind} onChange={set('kind')}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select></div>
      <div className="field"><label htmlFor="pj3">Your role</label><input className="input" id="pj3" value={f.role} onChange={set('role')} maxLength={120} /></div>
      <div className="field"><label htmlFor="pj4">Description</label><textarea className="input" id="pj4" value={f.text} onChange={set('text')} maxLength={1000} /></div>
      <div className="field"><label htmlFor="pj5">What was built</label>
        <div className="chips">{f.built.map((b) => <span className="chip" key={b}>{b}<button type="button" aria-label={'Remove ' + b} onClick={() => setF({ ...f, built: f.built.filter((x) => x !== b) })}>&times;</button></span>)}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}><input className="input" id="pj5" value={chip} onChange={(e) => setChip(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChip() } }} placeholder="For example: Admin system" maxLength={60} /><button type="button" className="btn btn-line" onClick={addChip}>Add</button></div></div>
      <div className="field"><label htmlFor="pj6">The result</label><textarea className="input" id="pj6" style={{ minHeight: 70 }} value={f.result} onChange={set('result')} maxLength={600} /></div>
      <div className="field"><label htmlFor="pj7">Live address</label><input className="input" id="pj7" value={f.url} onChange={set('url')} inputMode="url" placeholder="https://" maxLength={300} /></div>
    </fieldset>
    {err ? <p className="err" role="alert">{err}</p> : null}
    {isOwner && !item.isNew ? <p style={{ marginTop: 22 }}><button className="btn btn-bad" disabled={busy} onClick={() => go('bin', 'Moved to the bin.')}>Move to bin</button></p> : null}
    {isOwner && !item.isNew ? <p className="note">Items in the bin are kept for 30 days. Only you can empty it.</p> : null}
  </Sheet>)
}

// Install 28: a project from a link. Olex AI reads the site and fills the project in; the factory takes the screenshots.
function FromLink({ onClose, onDone }) {
  const [url, setUrl] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState('')
  async function go(e) {
    e.preventDefault(); if (!url.trim()) return; setBusy(true); setErr('')
    try {
      const r = await fetch('/admin/api/portfolio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action: 'from-link', url }) }), j = await r.json().catch(() => ({}))
      if (r.status === 401) { window.location.assign('/admin/login'); return }
      if (!r.ok) { setErr(j.error || 'That didn’t work. Try again.'); setBusy(false); return }
      toast('Read the site and filled it in. Screenshots are on the way.'); onDone(j)
    } catch { setErr('No connection. Try again.'); setBusy(false) }
  }
  return (<Sheet title="Add from a link" onClose={busy ? () => {} : onClose} foot={<button className="btn btn-green" form="pfl" disabled={busy || !url.trim()}>{busy ? 'Reading the site…' : 'Read the site'}</button>}>
    <form id="pfl" onSubmit={go}>
      <div className="field"><label htmlFor="pfl1">The website you built</label><input className="input" id="pfl1" value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" placeholder="https://" maxLength={300} autoFocus disabled={busy} /></div>
      <p className="note">Olex AI reads the site (the home page and a few inside pages) and fills in the name, type, your role, description, what was built and the result, only from what&rsquo;s on the site. Then real screenshots are taken: the whole page, the first screen, the best sections and the phone view. It&rsquo;s saved as a draft for you to check. Reading takes about 30 seconds; screenshots about 3 minutes.</p>
      {err ? <p className="err" role="alert">{err}</p> : null}
    </form>
  </Sheet>)
}
function Shots({ id, image, onPick }) {
  const [s, setS] = useState(null), [busy, setBusy] = useState(false)
  useEffect(() => {
    let stop = false, t = null
    const load = async () => {
      try { const r = await fetch('/admin/api/portfolio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action: 'shots', id }) }), j = await r.json()
        if (stop) return; setS(j); if (['waiting', 'taking'].includes(j.status)) t = setTimeout(load, 5000)
        else if (j.status === 'done' && !image && j.shots && j.shots[0]) onPick((j.shots.find((x) => x.label === 'The whole page') || j.shots[0]).url)
      } catch { if (!stop) t = setTimeout(load, 8000) }
    }
    load(); return () => { stop = true; clearTimeout(t) }
  }, [id, busy]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!s || s.status === 'none') return null
  async function again() { setBusy(true); await fetch('/admin/api/portfolio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action: 'retry-shots', id }) }).catch(() => {}); setBusy(false) }
  return (<div className="field pf-shots"><label>Screenshots from the site</label>
    {['waiting', 'taking'].includes(s.status) ? <p className="note">{s.status === 'waiting' ? 'Starting the browser…' : 'Taking screenshots…'} ({(s.shots || []).length} so far). You can keep editing; they appear here.</p> : null}
    {s.status === 'failed' ? <p className="err">{s.error || 'The screenshots didn’t work.'} <button type="button" className="btn btn-line" onClick={again} disabled={busy}>Try again</button></p> : null}
    {(s.shots || []).length ? <div className="pf-grid">{s.shots.map((x) => <button type="button" key={x.url} className={'pf-pick' + (image === x.url ? ' on' : '')} onClick={() => onPick(x.url)} aria-pressed={image === x.url}>
      <img src={x.url} alt={x.label} loading="lazy" /><span>{x.label}{image === x.url ? ' ✓' : ''}</span></button>)}</div> : null}
    {(s.shots || []).length ? <p className="note">Tap one to use it. The whole page looks best on the portfolio.</p> : null}
    <style>{`.pf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-top:8px}.pf-pick{padding:0;border:2px solid var(--line);border-radius:10px;overflow:hidden;background:none;cursor:pointer;text-align:left;color:inherit;font:inherit}.pf-pick.on{border-color:var(--green)}.pf-pick img{display:block;width:100%;height:150px;object-fit:cover;object-position:top}.pf-pick span{display:block;padding:6px 8px;font-size:12.5px}`}</style>
  </div>)
}
