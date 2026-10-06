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
  const [list, setList] = useState(items), [edit, setEdit] = useState(null)
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
    <div className="top"><h1 className="d">Projects</h1><button className="btn btn-green" onClick={() => setEdit({ isNew: true, data: { kind: 'Client website', built: [] } })}>Add</button></div>
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
