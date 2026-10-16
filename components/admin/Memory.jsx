'use client'
// What Olex AI has learned: lessons (from corrections, your feedback, or added here) and how its answers are rated.
// Edit a lesson, switch it off for a while, or delete it. Every chat uses the active ones.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from './ui'
import { Icon } from './icons'

const KINDS = [['rule', 'Rule'], ['preference', 'Preference'], ['fact', 'About you'], ['code', 'Coding']]
const FROM = { chat: 'Learned in chat', feedback: 'From your feedback', you: 'Added by you' }
const LABEL = { groq: 'Groq', gemini: 'Gemini', cloudflare: 'Cloudflare', openrouter: 'OpenRouter', nvidia: 'NVIDIA', zai: 'Z.ai', mistral: 'Mistral', cohere: 'Cohere', cerebras: 'Cerebras' }
async function call(payload) {
  try { const r = await fetch('/admin/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(payload) }); const j = await r.json().catch(() => ({}))
    if (r.status === 401) { window.location.assign('/admin/login'); return {} } return r.ok ? j : { error: j.error || 'Something went wrong. Try again.' } } catch { return { error: 'No connection. Try again.' } }
}

export default function Memory({ lessons: start, stats }) {
  const router = useRouter()
  const [list, setList] = useState(start), [filter, setFilter] = useState('all'), [edit, setEdit] = useState(null), [add, setAdd] = useState({ kind: 'rule', text: '' })
  const shown = list.filter((l) => filter === 'all' || l.kind === filter)
  async function save(l) {
    const r = await call({ action: 'memory-save', id: l.id, kind: l.kind, text: l.text, active: l.active }); if (r.error) { toast(r.error); return false }
    setList((all) => (l.id ? all.map((x) => (x.id === l.id ? { ...x, ...l } : x)) : [{ ...l, id: r.id, source: 'you', active: true }, ...all])); return true
  }
  async function remove(l) {
    if (!window.confirm('Delete this lesson? Olex AI will stop following it.')) return
    const r = await call({ action: 'memory-delete', id: l.id }); if (r.error) { toast(r.error); return }
    setList((all) => all.filter((x) => x.id !== l.id)); toast('Deleted.')
  }
  const total = stats.up + stats.down
  return (<>
    <div className="top"><h1 className="d">Memory</h1></div>
    <p className="note" style={{ marginTop: -14 }}>What Olex AI has learned from you. It follows the active lessons in every chat and article. Correct it in chat (“never do that”, “I prefer…”) and it saves the lesson here; you can always change it.</p>

    <form className="mem-add" onSubmit={async (e) => { e.preventDefault(); if (await save({ ...add, active: true })) { setAdd({ kind: add.kind, text: '' }); toast('Saved. Olex AI will follow it from the next message.') } }}>
      <select className="input" value={add.kind} onChange={(e) => setAdd({ ...add, kind: e.target.value })} aria-label="Kind">{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      <input className="input" value={add.text} onChange={(e) => setAdd({ ...add, text: e.target.value })} maxLength={300} placeholder="Teach it something, e.g. Always quote prices in naira." aria-label="New lesson" />
      <button type="submit" className="btn btn-green" disabled={add.text.trim().length < 4}>Add</button>
    </form>

    <div className="seg" role="group" aria-label="Show" style={{ margin: '18px 0 12px' }}>
      {[['all', 'All'], ...KINDS].map(([k, l]) => <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}{k === 'all' ? ` (${list.length})` : ''}</button>)}
    </div>
    {shown.length ? <ul className="rows mem-list">{shown.map((l) => (<li key={l.id} className={'row mem' + (l.active ? '' : ' off')}>
      {edit && edit.id === l.id ? <form className="mem-edit" onSubmit={async (e) => { e.preventDefault(); if (await save(edit)) { setEdit(null); toast('Saved.') } }}>
        <select className="input" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })} aria-label="Kind">{KINDS.map(([k, x]) => <option key={k} value={k}>{x}</option>)}</select>
        <input className="input" autoFocus value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value })} maxLength={300} aria-label="Lesson" />
        <button type="submit" className="btn btn-green">Save</button><button type="button" className="btn btn-line" onClick={() => setEdit(null)}>Cancel</button>
      </form> : <>
        <span className="ic">{Icon.memory}</span>
        <span><span className="row-t">{l.text}</span><span className="row-s">{(KINDS.find(([k]) => k === l.kind) || [, 'Rule'])[1]} · {FROM[l.source] || 'Learned'}{l.active ? '' : ' · switched off'}</span></span>
        <span className="mem-acts">
          <button type="button" className="btn btn-line" onClick={() => save({ ...l, active: !l.active })}>{l.active ? 'Switch off' : 'Switch on'}</button>
          <button type="button" className="btn btn-line" onClick={() => setEdit({ ...l })}>Edit</button>
          <button type="button" className="btn btn-line" onClick={() => remove(l)} aria-label={'Delete ' + l.text}>{Icon.bin}</button>
        </span></>}
    </li>))}</ul> : <div className="empty">{list.length ? 'Nothing of this kind yet.' : 'Nothing learned yet. Correct Olex AI in chat, rate its answers, or add a lesson above.'}</div>}

    <h2 className="section-t">How its answers are rated</h2>
    {total ? <div className="share">
      <p style={{ margin: 0 }}><b>{stats.up}</b> good and <b>{stats.down}</b> bad, out of {total} rated answers. Answers you like become examples for similar questions; providers you often rate down answer later.</p>
      {stats.by.length ? <ul className="rows" style={{ marginTop: 12 }}>{stats.by.map((p) => <li key={p.id} className="row"><span className="row-t">{LABEL[p.id] || p.id}</span><span className="row-s">{p.ups} good, {p.downs} bad{p.ups + p.downs >= 5 && p.ups / (p.ups + p.downs) < 0.5 ? ' · answering later for now' : ''}</span></li>)}</ul> : null}
    </div> : <p className="note">No answers rated yet. Use the thumbs under any answer in chat.</p>}
    {stats.recent.length ? <><h2 className="section-t">What you said was wrong</h2>
      <ul className="rows">{stats.recent.map((r) => <li key={r.id} className="row"><a className="row-t" href={'/admin?c=' + r.chat_id}>{r.feedback}</a><span className="row-s">{r.written_by || ''}</span></li>)}</ul></> : null}
  </>)
}
