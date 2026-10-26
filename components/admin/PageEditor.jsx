'use client'
// One page in Pages & links: Edit (AI draft, ✨ Suggest, address, speakers, live preview) · Overview · People · Feedback · Settings.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageView from '../PageView'
import { toast } from './ui'
import { AudioUpload, PhotoUpload } from './Uploaders'

const NAME = { audio: 'audio course', webinar: 'webinar', event: 'event' }
const dim = { color: 'var(--dim)' }
const ago = (d) => { const m = Math.round((Date.now() - new Date(d).getTime()) / 60e3); return m < 2 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago' }
const initials = (n) => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
const Spark = () => <svg viewBox="0 0 24 24" className="pe-ic" aria-hidden="true"><path d="M12 3.5 13.6 9l5.4 1.6-5.4 1.6L12 17.7l-1.6-5.5L5 10.6 10.4 9Z" /><path d="M18.5 15.5l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7Z" /></svg>

export default function PageEditor({ data }) {
  const router = useRouter(), P = data.page, [tab, setTab] = useState('edit'), [busy, setBusy] = useState(''), [err, setErr] = useState('')
  const [c, setC] = useState(() => ({ learn: [], speakers: [], faq: [], host: {}, ...P.content, learn: (P.content.learn || []).join('\n') }))
  const [slug, setSlug] = useState(P.slug), [slugOk, setSlugOk] = useState({ ok: true }), [goal, setGoal] = useState(P.goal), [notes, setNotes] = useState(''), [sug, setSug] = useState({}), [dirty, setDirty] = useState(false)
  const set = (k, v) => { setC((x) => ({ ...x, [k]: v })); setDirty(true) }
  async function call(body, ok) {
    setBusy(body.action + (body.field || '')); setErr('')
    try { const r = await fetch('/admin/api/pages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ id: P.id, ...body }) })
      const j = await r.json().catch(() => ({})); if (r.status === 401) { window.location.assign('/admin/login'); return null }
      if (!r.ok) { setErr(j.error || 'Something went wrong.'); return null } if (ok) toast(ok); return j }
    catch { setErr('No connection. Try again.'); return null } finally { setBusy('') }
  }
  useEffect(() => { if (slug === P.slug) { setSlugOk({ ok: true }); return } const t = setTimeout(async () => { const j = await call({ action: 'slug-check', slug }); if (j) setSlugOk(j) }, 450); return () => clearTimeout(t) }, [slug]) // eslint-disable-line
  useEffect(() => { const w = (e) => { if (dirty) { e.preventDefault(); e.returnValue = '' } }; window.addEventListener('beforeunload', w); return () => window.removeEventListener('beforeunload', w) }, [dirty])
  const content = () => ({ ...c, learn: String(c.learn || '').split('\n').map((x) => x.trim()).filter(Boolean) })
  async function save(ok = 'Saved.') { const j = await call({ action: 'save', slug, content: content(), goal }, ok); if (j) { setDirty(false); if (j.slug !== P.slug) router.refresh() } return j }
  async function draft() {
    const d = await call({ action: 'ai-draft', type: P.type, notes }); if (!d) return
    setC((x) => ({ ...x, title: d.title, kicker: d.kicker, tagline: d.tagline, intro: d.intro, learnTitle: d.learnTitle, learn: (d.learn || []).join('\n'), whoFor: d.whoFor, cta: d.cta, preview: d.preview, faq: d.faq || [],
      host: { ...(x.host || {}), bio: d.hostBio || (x.host || {}).bio }, ...(d.when ? { when: d.when } : {}), ...(d.minutes ? { minutes: d.minutes } : {}), ...(d.platform ? { platform: d.platform } : {}), ...(d.venue ? { venue: d.venue } : {}), ...(d.address ? { address: d.address } : {}) }))
    setDirty(true); toast('Drafted. Check every detail, then save.')
  }
  async function suggest(field, extra, key = field) { const j = await call({ action: 'ai-suggest', type: P.type, field, page: content(), extra }); if (j) setSug((s) => ({ ...s, [key]: j.options })) }
  const S = ({ field, extra, k = field }) => <button type="button" className="pe-sg" disabled={!!busy} onClick={() => suggest(field, extra, k)}><Spark />{busy === 'ai-suggest' + field ? 'Thinking…' : 'Suggest'}</button>
  const Opts = ({ k, onPick }) => (sug[k] || []).length ? <div className="pe-opts">{sug[k].map((o, i) => <button key={i} type="button" onClick={() => { onPick(o); setSug((s) => ({ ...s, [k]: null })) }}>{o}</button>)}<button type="button" className="pe-x" onClick={() => setSug((s) => ({ ...s, [k]: null }))}>Close</button></div> : null
  const F = ({ k, label, area, rows = 2, ai, ph }) => <div className="pe-f"><label htmlFor={'f-' + k}>{label}{ai ? S({ field: k }) : null}</label>
    {area ? <textarea id={'f-' + k} className="input" rows={rows} value={c[k] || ''} onChange={(e) => set(k, e.target.value)} placeholder={ph} /> : <input id={'f-' + k} className="input" value={c[k] || ''} onChange={(e) => set(k, e.target.value)} placeholder={ph} />}
    {ai ? Opts({ k: k, onPick: (o) => set(k, o) }) : null}</div>
  const setArr = (k, i, v) => set(k, (c[k] || []).map((x, j) => (j === i ? { ...x, ...v } : x)))
  const previewPage = useMemo(() => ({ id: 0, type: P.type, goal: Number(goal) || 100, stage: 'open', content: content() }), [c, goal]) // eslint-disable-line

  // people, numbers
  const people = data.people, fbs = people.filter((p) => p.feedback)
  const today = new Date(Date.now() + 3600e3).toISOString().slice(0, 10), joinedToday = people.filter((p) => new Date(p.created_at).getTime() + 3600e3 >= Date.parse(today + 'T00:00:00Z')).length
  const stage = !P.accepting ? 'closed' : people.length >= P.goal ? 'bonus' : people.length >= data.fewFrom ? 'few' : 'open'
  const sees = { open: `“Only ${P.goal} seats”`, few: '“Join fast. Few spaces left.”', bonus: '“Bonus spots opened”', closed: '“Sign-ups are closed for now”' }[stage]
  function csv() { const rows = [['Name', 'Signed up', 'What they shared']].concat(people.map((p) => [p.name, new Date(p.created_at).toLocaleString('en-GB'), p.feedback || '']))
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n')], { type: 'text/csv' })); a.download = slug + '-people.csv'; a.click() }
  const T = [['edit', 'Edit'], ['overview', 'Overview'], ['people', 'People', people.length], ['feedback', 'Feedback', fbs.length], ['settings', 'Settings']]

  return (<>
    <div className="pe-hero"><div><a className="pe-back" href="/admin/pages">← Pages &amp; links</a><h1 className="d" style={{ margin: '4px 0 0' }}>{c.title || 'New ' + NAME[P.type]}</h1>
      <span className={'pe-pill ' + (P.status === 'live' ? stage : 'draft')}><i />{P.status === 'live' ? `Live · visitors see ${sees}` : 'Draft · not public yet'}</span></div>
      <div className="pe-hb">{P.status === 'live' ? <a className="btn btn-line" href={'/' + P.slug} target="_blank" rel="noopener">View the page ↗</a> : null}
        <button className="btn btn-line" disabled={!!busy} onClick={async () => { const w = window.open('', '_blank'); if (await save(null)) w.location = '/admin/pages/' + P.id + '/preview'; else w.close() }}>Full preview</button>
        <button className="btn btn-line" disabled={!!busy} onClick={() => save()}>{busy === 'save' ? 'Saving…' : dirty ? 'Save draft' : 'Saved'}</button>
        {P.status === 'live' ? <button className="btn btn-line" disabled={!!busy} onClick={async () => { if (window.confirm('Take this page offline? Its address will show “not found” until you publish again.') && await call({ action: 'unpublish' }, 'Page is offline.')) router.refresh() }}>Unpublish</button>
          : <button className="btn btn-green" disabled={!!busy || !slugOk.ok} onClick={async () => { if (!(await save(null))) return; if (await call({ action: 'publish' }, 'Published at olexweb.com/' + slug)) router.refresh() }}>{busy === 'publish' ? 'Publishing…' : 'Publish'}</button>}</div></div>
    <div className="pe-tabs" role="tablist">{T.map(([k, l, n]) => <button key={k} role="tab" aria-selected={tab === k} className={'pe-tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}{n != null ? <i>{n}</i> : null}</button>)}</div>
    {err ? <p className="err" role="alert">{err}</p> : null}

    {tab === 'edit' ? <div className="pe-cols"><div>
      <section className="pe-ai"><b><Spark />Write it with AI</b><textarea className="input" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={'Tell it about your ' + NAME[P.type] + ': what it is, who it’s for, what people get' + (P.type === 'audio' ? '' : ', the date, time and ' + (P.type === 'event' ? 'venue' : 'platform')) + '…'} />
        <div className="pe-row"><button className="btn btn-green" disabled={!!busy || notes.trim().length < 15} onClick={draft}>{busy === 'ai-draft' ? 'Drafting…' : 'Draft the whole page'}</button><span style={{ fontSize: 13, ...dim }}>Or write it yourself below.</span></div>
        <small style={dim}>Dates, times, places and links come only from what you write. Anything missing is marked [add …], never guessed.</small></section>

      <div className="pe-f"><label htmlFor="f-slug">Page address</label><div className="pe-url"><span>olexweb.com/</span><input id="f-slug" value={slug} onChange={(e) => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setDirty(true) }} /></div>
        <span className={slugOk.ok ? 'pe-ok' : 'pe-bad'}>{slugOk.ok ? '✓ Available' : slugOk.why}</span></div>
      {F({ k: "kicker", label: "Small label above the title", ai: true, ph: "Free webinar · 60 minutes" })}
      {F({ k: "title", label: "Title", ai: true })}{F({ k: "tagline", label: "Tagline", area: true, ai: true })}{F({ k: "intro", label: "Intro", area: true, rows: 3, ai: true })}
      {P.type !== 'audio' ? <div className="pe-two"><div className="pe-f"><label htmlFor="f-when">Date and time (Lagos)</label><input id="f-when" className="input" type="datetime-local" value={c.when || ''} onChange={(e) => set('when', e.target.value)} /></div>
        <div className="pe-f"><label htmlFor="f-min">Length (minutes)</label><input id="f-min" className="input" type="number" min={0} value={c.minutes || ''} onChange={(e) => set('minutes', e.target.value)} /></div></div> : null}
      {P.type === 'webinar' ? F({ k: "platform", label: "Where it happens online", ph: "Google Meet" }) : null}
      {P.type === 'event' ? <>{F({ k: "venue", label: "Venue" })}{F({ k: "address", label: "Address" })}{F({ k: "mapUrl", label: "Map link (optional)", ph: "https://maps.app.goo.gl/…" })}</> : null}
      {F({ k: "learnTitle", label: "Heading for the list", ai: true })}<div className="pe-f"><label htmlFor="f-learn">What people get (one per line)</label><textarea id="f-learn" className="input" rows={5} value={c.learn || ''} onChange={(e) => set('learn', e.target.value)} /></div>
      {F({ k: "whoFor", label: "Who it’s for", area: true, ai: true })}{F({ k: "cta", label: "Button text", ai: true, ph: P.type === 'audio' ? 'Get free access' : 'Save my seat' })}

      {P.type === 'audio' ? <div className="pe-box"><b>Recordings</b>{(c.parts || []).map((p, i) => <div key={i} className="pe-item"><input className="input" placeholder="Title (e.g. Part 1)" value={p.title || ''} onChange={(e) => setArr('parts', i, { title: e.target.value })} />
          <div className="pe-file">{p.file ? <span className="pe-ok">✓ {p.file.split('/').pop()}</span> : <span style={dim}>No recording yet</span>}<AudioUpload label={p.file ? 'Replace' : 'Upload the recording'} onDone={(u, m) => setArr('parts', i, { file: u, ...(m ? { minutes: m } : {}) })} /></div>
          <input className="input" type="number" placeholder="Minutes" value={p.minutes || ''} onChange={(e) => setArr('parts', i, { minutes: e.target.value })} aria-label="Minutes" />
          <button type="button" className="pe-rm" onClick={() => set('parts', c.parts.filter((_, j) => j !== i))}>Remove</button></div>)}
        <button type="button" className="btn btn-line" onClick={() => set('parts', [...(c.parts || []), { title: 'Part ' + ((c.parts || []).length + 1), file: '', minutes: '' }])}>Add a recording</button></div> : null}

      <div className="pe-box"><b>Your host</b><div className="pe-two"><input className="input" placeholder="Name" value={(c.host || {}).name || ''} onChange={(e) => set('host', { ...c.host, name: e.target.value })} /><input className="input" placeholder="Role" value={(c.host || {}).role || ''} onChange={(e) => set('host', { ...c.host, role: e.target.value })} /></div>
        <textarea className="input" rows={2} placeholder="One line about you, for this topic" value={(c.host || {}).bio || ''} onChange={(e) => set('host', { ...c.host, bio: e.target.value })} />
        <div className="pe-photo">{(c.host || {}).photo ? <img src={c.host.photo} alt="" /> : <span>No photo</span>}<PhotoUpload label={(c.host || {}).photo ? 'Change photo' : 'Upload a photo'} onDone={(u) => set('host', { ...c.host, photo: u })} /></div></div>

      <div className="pe-box"><b>Speakers <span style={{ fontWeight: 500, ...dim }}>(optional)</span></b>{(c.speakers || []).map((p, i) => <div key={i} className="pe-item">
        <div className="pe-two"><input className="input" placeholder="Name" value={p.name || ''} onChange={(e) => setArr('speakers', i, { name: e.target.value })} /><input className="input" placeholder="Role · company" value={p.role || ''} onChange={(e) => setArr('speakers', i, { role: e.target.value })} /></div>
        <div className="pe-f" style={{ margin: 0 }}><label>One line about them{S({ field: "bio", extra: `${p.name}, ${p.role}`, k: 'bio' + i })}</label><textarea className="input" rows={2} value={p.bio || ''} onChange={(e) => setArr('speakers', i, { bio: e.target.value })} />{Opts({ k: 'bio' + i, onPick: (o) => setArr('speakers', i, { bio: o }) })}</div>
        <div className="pe-photo">{p.photo ? <img src={p.photo} alt="" /> : <span>No photo</span>}<PhotoUpload label={p.photo ? 'Change photo' : 'Upload a photo'} onDone={(u) => setArr('speakers', i, { photo: u })} /></div><button type="button" className="pe-rm" onClick={() => set('speakers', c.speakers.filter((_, j) => j !== i))}>Remove speaker</button></div>)}
        <button type="button" className="btn btn-line" onClick={() => set('speakers', [...(c.speakers || []), { name: '', role: '', bio: '', photo: '' }])}>Add a speaker</button></div>

      <div className="pe-box"><b>Questions <span style={{ fontWeight: 500, ...dim }}>(optional)</span></b>{(c.faq || []).map((f, i) => <div key={i} className="pe-item"><input className="input" placeholder="Question" value={f.q || ''} onChange={(e) => setArr('faq', i, { q: e.target.value })} /><textarea className="input" rows={2} placeholder="Answer" value={f.a || ''} onChange={(e) => setArr('faq', i, { a: e.target.value })} /><button type="button" className="pe-rm" onClick={() => set('faq', c.faq.filter((_, j) => j !== i))}>Remove</button></div>)}
        <button type="button" className="btn btn-line" onClick={() => set('faq', [...(c.faq || []), { q: '', a: '' }])}>Add a question</button></div>

      <div className="pe-box"><b>After sign-up</b><div className="pe-f" style={{ margin: 0 }}><label htmlFor="f-comm">WhatsApp community link <span style={dim}>(optional)</span></label><input id="f-comm" className="input" value={c.community || ''} onChange={(e) => set('community', e.target.value)} placeholder="https://chat.whatsapp.com/…" /></div>
        <small style={dim}>{P.type === 'audio' ? 'Shown after they unlock the course.' : 'Shown as the required last step: “the joining link and every update are shared there only”.'}</small></div>
      {F({ k: "preview", label: "Link-preview text (when shared on WhatsApp)", area: true, ai: true })}<div className="pe-f"><label>Link-preview image <span style={dim}>(optional; shown when the link is shared)</span></label><div className="pe-photo pe-wide">{c.photo ? <img src={c.photo} alt="" /> : <span>No image</span>}<PhotoUpload ratio={1.91} label={c.photo ? 'Change image' : 'Upload an image'} hint="Pick the part to show in the WhatsApp preview." onDone={(u) => set('photo', u)} /></div></div>
    </div>
    <aside className="pe-prev"><div className="pe-phone"><div className="pe-scr"><PageView key={JSON.stringify(previewPage).length} page={previewPage} preview /></div></div><p style={{ textAlign: 'center', fontSize: 13, ...dim }}>Live preview</p></aside></div> : null}

    {tab === 'overview' ? <><div className="pe-nums"><div><b>{people.length}</b><span>signed up (of {P.goal})</span>{joinedToday ? <small>+{joinedToday} today</small> : null}</div><div><b>{fbs.length}</b><span>shared feedback</span></div><div><b>{P.status === 'live' ? 'Live' : 'Draft'}</b><span>olexweb.com/{P.slug}</span></div></div>
      <section className="pe-card"><h2>Latest people</h2>{people.slice(0, 6).map((p) => <div key={p.id} className="pe-pr"><span className="pe-av">{initials(p.name)}</span><div><b>{p.name}</b><p>Signed up {ago(p.created_at)}{p.feedback ? ' · left feedback' : ''}</p></div></div>)}{!people.length ? <p style={dim}>No one yet.</p> : null}</section></> : null}

    {tab === 'people' ? <section className="pe-card" style={{ maxWidth: 820 }}><div className="pe-row" style={{ justifyContent: 'space-between' }}><b>{people.length} people</b><button className="btn btn-line" onClick={csv}>Download the list</button></div>
      {people.map((p) => <div key={p.id} className="pe-pr"><span className="pe-av">{initials(p.name)}</span><div><b>{p.name}</b><p>Signed up {ago(p.created_at)}{p.feedback ? ' · left feedback' : ''}</p></div>
        <button className="pe-del" aria-label={'Remove ' + p.name} onClick={async () => { if (window.confirm(`Remove ${p.name}?`) && await call({ action: 'remove-signup', signup: p.id }, 'Removed.')) router.refresh() }}>×</button></div>)}
      {!people.length ? <p style={dim}>No one has signed up yet.</p> : null}</section> : null}

    {tab === 'feedback' ? <section className="pe-card" style={{ maxWidth: 820 }}>{fbs.length ? fbs.map((p) => <div key={p.id} className="pe-fb">“{p.feedback}”<span>{p.name} · {ago(p.feedback_at || p.created_at)}</span></div>) : <p style={dim}>No feedback yet.</p>}</section> : null}

    {tab === 'settings' ? <section className="pe-card" style={{ maxWidth: 640, display: 'grid', gap: 14 }}>
      <div className="pe-f" style={{ margin: 0 }}><label htmlFor="f-goal">Seats shown on the page</label><input id="f-goal" className="input" type="number" min={1} value={goal} onChange={(e) => { setGoal(e.target.value); setDirty(true) }} style={{ maxWidth: 160 }} />
        <small style={dim}>“Few spaces left” from {Math.max(1, Math.round((Number(goal) || 100) * 0.6))} sign-ups, “Bonus spots opened” after {Number(goal) || 100}. It never closes by itself.</small></div>
      <div className="pe-row"><button className="btn btn-green" disabled={!!busy} onClick={() => save('Settings saved.')}>Save</button>
        <button className={P.accepting ? 'btn btn-line' : 'btn btn-green'} disabled={!!busy} onClick={async () => { if (await call({ action: 'accepting', on: !P.accepting }, P.accepting ? 'Sign-ups closed.' : 'Sign-ups reopened.')) router.refresh() }}>{P.accepting ? 'Close sign-ups' : 'Reopen sign-ups'}</button></div>
      <hr style={{ border: 0, borderTop: '1px solid var(--line)', width: '100%' }} />
      <div><button className="btn btn-line" style={{ color: '#ff8a8a' }} disabled={!!busy} onClick={async () => { if (window.prompt('This deletes the page and everyone who signed up. Type DELETE to confirm.') === 'DELETE' && await call({ action: 'delete' }, 'Page deleted.')) window.location.assign('/admin/pages') }}>Delete this page</button></div>
    </section> : null}

    <style>{`
.pe-ic{width:16px;height:16px;flex:none;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linejoin:round}
.pe-hero{display:flex;justify-content:space-between;gap:14px;align-items:flex-end;flex-wrap:wrap;margin-bottom:14px}.pe-back{font-size:13.5px;color:var(--dim);text-decoration:none}.pe-hb{display:flex;gap:8px;flex-wrap:wrap}
.pe-pill{display:inline-flex;gap:8px;align-items:center;margin-top:8px;padding:6px 12px;border-radius:999px;font-weight:700;font-size:13px;background:rgba(143,227,106,.12);color:var(--green)}.pe-pill i{width:8px;height:8px;border-radius:50%;background:currentColor}.pe-pill.draft{background:rgba(242,239,233,.08);color:var(--dim)}.pe-pill.closed{background:rgba(242,239,233,.12);color:var(--paper)}
.pe-tabs{display:flex;gap:4px;overflow-x:auto;margin:0 0 16px;border-bottom:1px solid var(--line)}.pe-tab{flex:none;padding:10px 14px;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;background:none;color:var(--dim);font:700 14.5px inherit;cursor:pointer}.pe-tab.on{color:var(--paper);border-color:var(--green)}.pe-tab i{font-style:normal;margin-left:6px;padding:1px 7px;border-radius:99px;background:var(--raise);font-size:12px}
.pe-cols{display:grid;gap:20px;align-items:start}@media(min-width:1100px){.pe-cols{grid-template-columns:minmax(0,1fr) 340px}.pe-prev{position:sticky;top:16px}}
.pe-ai{display:grid;gap:10px;margin-bottom:16px;padding:16px;border-radius:20px;border:1px solid rgba(143,227,106,.35);background:linear-gradient(160deg,rgba(143,227,106,.10),rgba(143,227,106,.02))}.pe-ai>b{display:flex;gap:8px;align-items:center;font-size:16px}.pe-ai .pe-ic{color:var(--green);width:18px;height:18px}
.pe-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.pe-f{display:grid;gap:6px;margin-bottom:14px}.pe-f>label{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13.5px;color:var(--dim)}
.pe-sg{display:inline-flex;gap:6px;align-items:center;padding:4px 10px;border-radius:999px;border:1px solid rgba(143,227,106,.4);background:transparent;color:var(--green);font:800 12px inherit;cursor:pointer}.pe-sg:disabled{opacity:.5}
.pe-opts{display:grid;gap:6px;padding:10px;border-radius:14px;background:var(--raise);animation:peIn .3s cubic-bezier(.2,.8,.2,1)}.pe-opts button{text-align:left;padding:10px 12px;border-radius:10px;border:1px solid var(--line);background:transparent;color:var(--paper);font:inherit;font-size:14px;cursor:pointer}.pe-opts button:hover{border-color:var(--green)}.pe-opts .pe-x{justify-self:end;border:0;color:var(--dim);font-size:12.5px;padding:2px 4px}
@keyframes peIn{from{opacity:0;transform:translateY(-4px)}}
.pe-url{display:flex;align-items:center;border:1px solid var(--line);border-radius:12px;overflow:hidden}.pe-url span{padding:12px 0 12px 13px;color:var(--dim);font-size:15px}.pe-url input{flex:1;min-width:0;padding:12px 13px 12px 2px;border:0;background:transparent;color:var(--paper);font:700 15px inherit;outline:0}
.pe-ok{font-size:12.5px;color:var(--green)}.pe-bad{font-size:12.5px;color:#ff8a8a}
.pe-two{display:grid;gap:10px}@media(min-width:640px){.pe-two{grid-template-columns:1fr 1fr}}
.pe-box{display:grid;gap:10px;margin-bottom:14px;padding:14px;border-radius:18px;border:1px solid var(--line)}.pe-box>b{font-size:15px}.pe-item{display:grid;gap:8px;padding:12px;border-radius:14px;background:var(--raise)}.pe-item .btn,.pe-box>.btn{justify-self:start}
.pe-photo{display:flex;gap:12px;align-items:center}.pe-photo img,.pe-photo>span{width:72px;height:90px;border-radius:12px;object-fit:cover;background:rgba(242,239,233,.06);display:grid;place-items:center;font-size:11.5px;color:var(--dim);text-align:center}
.pe-wide img,.pe-wide>span{width:153px;height:80px}.pe-file{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.pe-rm{justify-self:start;padding:0;border:0;background:none;color:var(--dim);font:600 13px inherit;cursor:pointer;text-decoration:underline}
.pe-phone{width:340px;max-width:100%;height:680px;margin:0 auto;border-radius:34px;border:9px solid #1d211d;overflow:hidden;background:#f2efe9}.pe-scr{width:390px;height:780px;transform:scale(.8256);transform-origin:top left;overflow-y:auto}
.pe-nums{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:14px}.pe-nums div{padding:16px;border-radius:20px;background:var(--raise);border:1px solid var(--line)}.pe-nums b{display:block;font-family:var(--display);font-stretch:80%;font-weight:900;font-size:36px;line-height:1}.pe-nums span{font-size:13.5px;color:var(--dim)}.pe-nums small{display:block;margin-top:6px;color:var(--green);font-size:12.5px}
.pe-card{padding:18px;border-radius:20px;background:var(--raise);border:1px solid var(--line)}.pe-card h2{margin:0 0 10px;font-size:18px}
.pe-pr{display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px 2px;border-bottom:1px solid var(--line)}.pe-pr b{font-size:15px}.pe-pr p{margin:2px 0 0;font-size:13px;color:var(--dim)}
.pe-av{width:38px;height:38px;border-radius:50%;background:rgba(242,239,233,.08);display:grid;place-items:center;font-weight:800;font-size:13.5px}.pe-del{width:30px;height:30px;border-radius:50%;border:1px solid var(--line);background:transparent;color:var(--dim);cursor:pointer;font-size:16px}
.pe-fb{padding:14px;border-radius:16px;background:rgba(242,239,233,.05);margin-bottom:10px;font-size:14.5px;line-height:1.5;white-space:pre-wrap}.pe-fb span{display:block;margin-top:6px;font-size:12.5px;color:var(--dim)}
`}</style>
  </>)
}
