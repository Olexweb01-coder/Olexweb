'use client'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { act, toast, Sheet, ImagePicker, Notice } from './ui'

const PILL = { live: ['live', 'Live'], hidden: ['', 'Hidden'], draft: ['draft', 'Draft'], waiting: ['draft', 'Waiting for approval'] }
export default function VenturesBoard({ items, isOwner }) {
  const router = useRouter(), [edit, setEdit] = useState(null), close = useCallback(() => setEdit(null), [])
  return (<>
    <div className="top"><h1 className="d">Ventures</h1><button className="btn btn-green" onClick={() => setEdit({ isNew: true, data: { text: [''] } })}>Add</button></div>
    <Notice />
    <ul className="rows">{items.map((v) => (
      <li key={v.id} className="row click" onClick={() => setEdit({ data: v })}>
        {v.image ? <img className="thumb" src={v.image.replace(/-full\.webp$/, '.webp')} alt="" width="64" height="44" /> : <span className="thumb" />}
        <span><span className="row-t">{v.name}</span><span className="row-s">{v.line}</span></span>
        <span className={'pill ' + (PILL[v.status] || PILL.draft)[0]}>{(PILL[v.status] || PILL.draft)[1]}</span></li>))}</ul>
    {edit ? <VentureEditor key={edit.data.id || 'new'} item={edit} isOwner={isOwner} onClose={close} onDone={() => { setEdit(null); router.refresh() }} /> : null}
  </>)
}
function VentureEditor({ item, isOwner, onClose, onDone }) {
  const v = item.data
  const [f, setF] = useState({ name: v.name || '', line: v.line || '', kind: v.kind || '', url: v.url || '', image: v.image || '' })
  const [paras, setParas] = useState((v.text && v.text.length ? v.text : ['']).map((t, i) => ({ t, k: i + '-' + Math.random() })))
  const [id, setId] = useState(v.id || null), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const isLive = v.status === 'live', set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  async function go(action, done) {
    setBusy(true); setErr('')
    let r = { id }
    if (['save', 'publish'].includes(action)) { r = await act({ action: 'save', type: 'venture', id, data: { ...f, text: paras.map((p) => p.t) } }); if (!r.error) setId(r.id) }
    if (!r.error && action !== 'save') r = await act({ action, type: 'venture', id: r.id })
    setBusy(false); if (r.error) { setErr(r.error); return }
    toast(done, action === 'publish'); onDone()
  }
  const foot = isLive ? <><button className="btn btn-line" disabled={busy} onClick={() => go('hide', 'Hidden from the site.')}>Hide from site</button><button className="btn btn-green" disabled={busy} onClick={() => go('publish', 'Published.')}>Save changes</button></>
    : <><button className="btn btn-line" disabled={busy} onClick={() => go('save', 'Draft saved.')}>Save draft</button><button className="btn btn-green" disabled={busy} onClick={() => go('publish', 'Published.')}>Publish</button></>
  return (<Sheet title={item.isNew ? 'Add a venture' : f.name || 'Venture'} onClose={onClose} foot={foot}>
    <ImagePicker value={f.image} onChange={(x) => setF({ ...f, image: x })} kind="screenshot" label="Screenshot of its website" />
    <div className="field"><label htmlFor="vn1">Name</label><input className="input" id="vn1" value={f.name} onChange={set('name')} maxLength={80} /></div>
    <div className="field"><label htmlFor="vn2">One line</label><input className="input" id="vn2" value={f.line} onChange={set('line')} maxLength={140} /></div>
    <div className="field"><label htmlFor="vn3">Type</label><input className="input" id="vn3" value={f.kind} onChange={set('kind')} maxLength={80} placeholder="For example: SaaS product" /></div>
    <div className="field"><label>Why it exists</label>
      {paras.map((p, i) => <textarea key={p.k} className="input" style={{ marginBottom: 8 }} value={p.t} maxLength={1500} aria-label={'Paragraph ' + (i + 1)} onChange={(e) => setParas(paras.map((x, j) => (j === i ? { ...x, t: e.target.value } : x)))} />)}
      <div className="acts"><button type="button" className="btn btn-line" onClick={() => setParas([...paras, { t: '', k: 'n' + Date.now() }])}>Add paragraph</button>{paras.length > 1 ? <button type="button" className="btn btn-line" onClick={() => setParas(paras.slice(0, -1))}>Remove last</button> : null}</div></div>
    <div className="field"><label htmlFor="vn4">Live address</label><input className="input" id="vn4" value={f.url} onChange={set('url')} inputMode="url" placeholder="https://" maxLength={300} /></div>
    {err ? <p className="err" role="alert">{err}</p> : null}
    {isOwner && !item.isNew ? <p style={{ marginTop: 22 }}><button className="btn btn-bad" disabled={busy} onClick={() => go('bin', 'Moved to the bin.')}>Move to bin</button></p> : null}
  </Sheet>)
}
