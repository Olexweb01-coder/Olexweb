'use client'
// YouTube → Scripts: each picked idea's Short, scene by scene, with the checks it passed and the quotes behind its claims.
// Edit any line, choose the title, then approve it for the factory.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from './ui'

const card = { padding: 18, borderRadius: 20, background: 'var(--raise)', border: '1px solid var(--line)' }
const dim = { color: 'var(--dim)' }
const h3 = { margin: '0 0 8px', fontSize: 14, fontWeight: 700 }
const STATUS = { needs_review: ['Needs your eye', 'draft'], draft: ['Ready for review', 'res'], approved: ['Approved for the factory', 'live'], rendering: ['In the factory', 'res'], rendered: ['Rendered', 'live'], uploaded: ['Uploaded', 'live'], failed: ['Failed', 'draft'] }
const TYPE = { hook: 'Hook', demo: 'The site', infographic: 'Infographic', talk: 'Talk', url: 'Address', cta: 'Follow' }
const POSE = { shocked: '😮', pointing: '👉', thinking: '🤔', dancing: '🕺', waving: '👋', idle: '🙂' }

async function call(body) {
  const r = await fetch('/admin/api/youtube', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (r.status === 401) { window.location.assign('/admin/login'); return null }
  if (!r.ok) throw new Error(j.error || 'Something went wrong. Try again.')
  return j
}

export default function YouTubeScripts({ data }) {
  const router = useRouter(), [busy, setBusy] = useState(null), [err, setErr] = useState('')
  async function run(key, body, msg) {
    setBusy(key); setErr('')
    try { const j = await call(body); if (j) { toast(typeof msg === 'function' ? msg(j) : msg); router.refresh() } } catch (e) { setErr(e.message) } finally { setBusy(null) }
  }
  return (<>
    <p style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.55, ...dim }}>Each picked idea gets a 20–35 second script. The checks run in code: a short hook first, one cut per line, real footage of the site, no year numbers, and every fact backed by a quote from the site’s own page. In Autopilot, a script that passes everything is approved by itself.</p>
    {err ? <p className="err" role="alert" style={{ margin: '0 0 12px' }}>{err}</p> : null}
    {data.waiting.length ? <section style={{ ...card, marginBottom: 12 }} aria-label="Waiting for a script">
      <h2 style={{ ...h3, fontSize: 16 }}>Picked, waiting for a script</h2>
      <div style={{ display: 'grid', gap: 8 }}>{data.waiting.map((w) => <div key={w.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span><b>{w.name}</b> <span style={dim}>· {w.score}/100</span></span>
        <button className="btn btn-green" disabled={!!busy} onClick={() => run('w' + w.id, { action: 'write-script', id: w.id }, (j) => j.status === 'needs_review' ? 'Written, but it needs your eye.' : 'Script written.')}>{busy === 'w' + w.id ? 'Writing… (about a minute)' : 'Write script now'}</button>
      </div>)}</div>
    </section> : null}
    {data.scripts.length ? <div style={{ display: 'grid', gap: 12 }}>{data.scripts.map((s) => <Script key={s.id} s={s} busy={busy} run={run} />)}</div>
      : !data.waiting.length ? <section style={card}><p style={{ margin: 0, lineHeight: 1.6, ...dim }}>No scripts yet. Pick an idea with “Make a video” on the Ideas tab and its script appears here.</p></section> : null}
  </>)
}

function Script({ s, busy, run }) {
  const sc = s.script.scenes, pk = s.package, [st, pill] = STATUS[s.status] || [s.status, 'draft']
  const editable = ['draft', 'needs_review', 'approved'].includes(s.status)
  const [edit, setEdit] = useState(null)
  const failed = (s.checks || []).filter((c) => !c.ok)
  function start() { setEdit({ scenes: sc.map((x) => ({ text: x.text, big: x.big || '' })), title: pk.title, titles: pk.titles, description: pk.description, hashtags: (pk.hashtags || []).join(' ') }) }
  const save = () => run('s' + s.id, { action: 'save-script', id: s.id, edit: { ...edit, hashtags: edit.hashtags.split(/\s+/).filter(Boolean) } }, (j) => { setEdit(null); return j.status === 'needs_review' ? `Saved (${j.seconds}s), but a check still fails.` : `Saved and checked: ${j.seconds}s.` })
  return (<article style={{ ...card, display: 'grid', gap: 14, borderColor: s.status === 'needs_review' ? 'rgba(255,209,102,.45)' : 'var(--line)' }} aria-labelledby={'sc' + s.id}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0 }}>
        <h2 id={'sc' + s.id} style={{ margin: 0, fontFamily: 'var(--display)', fontWeight: 800, fontStretch: '88%', fontSize: 21 }}>{s.name || s.script.site.name}</h2>
        <div style={{ fontSize: 13, marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', ...dim }}>
          <span className={'pill ' + pill}>{st}</span><span>{s.seconds}s · {sc.length} scenes</span>{s.writer ? <span>· written by {s.writer}</span> : null}{s.mention ? <span>· mentions olexweb.com</span> : null}
        </div>
      </div>
    </div>

    <div style={{ display: 'grid', gap: 8 }} role="list" aria-label="Scenes">
      {sc.map((x, i) => <div key={x.id} role="listitem" style={{ display: 'grid', gridTemplateColumns: '30px minmax(0,1fr)', gap: 10, padding: '10px 12px', borderRadius: 14, background: 'rgba(242,239,233,.04)', border: '1px solid var(--line)' }}>
        <span aria-hidden="true" style={{ fontSize: 20, lineHeight: '24px' }}>{POSE[x.pose] || '🙂'}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', ...dim }}>{i + 1}. {TYPE[x.type] || x.type}{x.capture ? <span style={{ textTransform: 'none', fontWeight: 500, letterSpacing: 0 }}> · film: {x.capture}</span> : null}</div>
          {edit ? <>
            <textarea className="input" aria-label={`Scene ${i + 1} line`} rows={2} value={edit.scenes[i].text} onChange={(e) => setEdit({ ...edit, scenes: edit.scenes.map((y, k) => (k === i ? { ...y, text: e.target.value } : y)) })} style={{ width: '100%', marginTop: 6, fontSize: 15 }} />
            <input className="input" aria-label={`Scene ${i + 1} on-screen words`} placeholder="On-screen words (optional)" value={edit.scenes[i].big} onChange={(e) => setEdit({ ...edit, scenes: edit.scenes.map((y, k) => (k === i ? { ...y, big: e.target.value } : y)) })} style={{ width: '100%', marginTop: 6 }} />
          </> : <>
            <p style={{ margin: '4px 0 0', fontSize: 15.5, lineHeight: 1.45 }}>{x.text}</p>
            {x.big ? <p style={{ margin: '4px 0 0', fontWeight: 800, fontSize: 13.5, color: 'var(--green)' }}>On screen: {x.big}</p> : null}
            {x.stats ? <p style={{ margin: '4px 0 0', fontSize: 13, ...dim }}>{x.stats.map((t) => t.value + ' ' + t.label).join(' · ')}</p> : null}
            {x.chips ? <p style={{ margin: '4px 0 0', fontSize: 13, ...dim }}>{x.chips.join(' · ')}</p> : null}
          </>}
        </div>
      </div>)}
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 14 }}>
      <section aria-label="Checks"><h3 style={h3}>Checks</h3><ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 5, fontSize: 13.5, lineHeight: 1.45 }}>
        {(s.checks || []).map((c) => <li key={c.key} style={{ display: 'flex', gap: 8 }}><span aria-label={c.ok ? 'passed' : 'failed'} style={{ color: c.ok ? 'var(--green)' : '#ffd166', fontWeight: 800 }}>{c.ok ? '✓' : '!'}</span><span style={c.ok ? dim : {}}>{c.note}</span></li>)}
      </ul></section>
      <section aria-label="Claims"><h3 style={h3}>What it claims, and the site’s own words</h3>
        {(s.claims || []).length ? <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8, fontSize: 13.5, lineHeight: 1.45 }}>
          {s.claims.map((c, i) => <li key={i}><b style={{ fontWeight: 600 }}>{c.claim}</b><br /><span style={dim}>“{c.quote}”</span></li>)}</ul> : <p style={{ margin: 0, fontSize: 13.5, ...dim }}>No factual claims.</p>}
      </section>
    </div>

    <section aria-label="Title and description" style={{ display: 'grid', gap: 8 }}>
      <h3 style={{ ...h3, margin: 0 }}>Title</h3>
      {edit ? <div role="radiogroup" aria-label="Choose the title" style={{ display: 'grid', gap: 6 }}>
        {edit.titles.map((t, i) => <label key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14.5 }}>
          <input type="radio" name={'t' + s.id} checked={edit.title === t} onChange={() => setEdit({ ...edit, title: t })} style={{ width: 18, height: 18, accentColor: 'var(--green)' }} />
          <input className="input" aria-label={`Title option ${i + 1}`} value={t} onChange={(e) => setEdit({ ...edit, titles: edit.titles.map((y, k) => (k === i ? e.target.value : y)), title: edit.title === t ? e.target.value : edit.title })} style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: t.length > 60 ? '#ffd166' : 'var(--dim)' }}>{t.length}/60</span></label>)}
      </div> : <><p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{pk.title}</p>{pk.titles.length > 1 ? <p style={{ margin: 0, fontSize: 13, ...dim }}>Other options: {pk.titles.filter((t) => t !== pk.title).join(' · ')}</p> : null}</>}
      <h3 style={{ ...h3, margin: '6px 0 0' }}>Description</h3>
      {edit ? <textarea className="input" aria-label="Description" rows={4} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} style={{ width: '100%' }} />
        : <p style={{ margin: 0, whiteSpace: 'pre-line', fontSize: 14, lineHeight: 1.55, ...dim }}>{pk.description}</p>}
      {edit ? <input className="input" aria-label="Hashtags" value={edit.hashtags} onChange={(e) => setEdit({ ...edit, hashtags: e.target.value })} />
        : <p style={{ margin: 0, fontSize: 14, color: 'var(--green)' }}>{(pk.hashtags || []).join(' ')}</p>}
    </section>

    {editable ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 12 }}>
      {edit ? <>
        <button className="btn btn-green" disabled={!!busy} onClick={save}>{busy === 's' + s.id ? 'Saving and checking…' : 'Save'}</button>
        <button className="btn btn-line" disabled={!!busy} onClick={() => setEdit(null)}>Cancel</button>
      </> : <>
        {s.status === 'draft' ? <button className="btn btn-green" disabled={!!busy} onClick={() => run('a' + s.id, { action: 'approve-script', id: s.id }, 'Approved for the factory.')}>Approve</button> : null}
        {s.status === 'needs_review' ? <button className="btn btn-line" disabled={!!busy} onClick={() => { if (window.confirm(`Approve anyway? ${failed.length} check${failed.length === 1 ? '' : 's'} didn’t pass:\n\n${failed.map((c) => '• ' + c.note).join('\n')}`)) run('a' + s.id, { action: 'approve-script', id: s.id, force: true }, 'Approved by you, despite the checks.') }}>Approve anyway</button> : null}
        <button className="btn btn-line" disabled={!!busy} onClick={start}>Edit</button>
        {s.idea_id ? <button className="btn btn-line" disabled={!!busy} onClick={() => { if (window.confirm('Write a fresh script? This one is replaced.')) run('r' + s.id, { action: 'write-script', id: s.idea_id }, 'Rewritten.') }}>{busy === 'r' + s.id ? 'Rewriting…' : 'Rewrite'}</button> : null}
        <button className="btn btn-line" disabled={!!busy} onClick={() => { if (window.confirm('Remove this script? The idea stays picked.')) run('d' + s.id, { action: 'drop-script', id: s.id }, 'Script removed.') }}>Remove</button>
      </>}
    </div> : null}
  </article>)
}
