'use client'
// Automation → Library: every idea and its Short, at whatever stage, with a tick per channel deciding where it goes
// (lib/site/library.js), and "Add your own idea" (judged like any found idea: lib/site/ideas.js addOwnIdea).
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from './ui'
import { CSS as BASE, ChIcon } from './automationShared'

const FILTERS = [['all', 'All'], ['idea', 'Ideas'], ['making', 'Being made'], ['ready', 'Ready'], ['posted', 'Posted'], ['aside', 'Set aside']]
const STAGE = { idea: 'Idea', making: 'Being made', ready: 'Ready', posted: 'Posted', aside: 'Set aside' }
async function call(body) {
  const r = await fetch('/admin/api/youtube', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (r.status === 401) { window.location.assign('/admin/login'); throw new Error('Sign in again.') }
  if (!r.ok) throw new Error(j.error || 'Something went wrong. Try again.')
  return j
}

export default function AutomationLibrary({ data }) {
  const router = useRouter(), [filter, setFilter] = useState('all'), [find, setFind] = useState(''), [busy, setBusy] = useState('')
  const [adding, setAdding] = useState(false), [form, setForm] = useState({ url: '', name: '', note: '', youtube: true, facebook: true }), [err, setErr] = useState(''), [verdict, setVerdict] = useState(null)
  const list = useMemo(() => {
    const t = find.trim().toLowerCase()
    return data.items.filter((x) => (filter === 'all' ? !x.aside : x.stage === filter) && (!t || (x.name + ' ' + x.url + ' ' + (x.what || '')).toLowerCase().includes(t)))
  }, [data.items, filter, find])

  async function tick(x, channel, on) {
    setBusy(x.id + channel)
    try { await call({ action: 'library-channel', id: x.id, channel, on }); toast(`${x.name}: ${channel === 'youtube' ? 'YouTube' : 'Facebook'} ${on ? 'on' : 'off'}.`); router.refresh() }
    catch (e) { toast(e.message) } finally { setBusy('') }
  }
  async function add(next) {
    setErr(''); setVerdict(null)
    if (!form.url.trim()) { setErr('Give the website’s address, like https://tldraw.com.'); return }
    if (!form.youtube && !form.facebook) { setErr('Tick at least one channel.'); return }
    setBusy(next ? 'next' : 'add')
    try {
      const r = await call({ action: 'own-idea', url: form.url, name: form.name, note: form.note, channels: { youtube: form.youtube, facebook: form.facebook }, next })
      setVerdict(r)
      if (!r.passed) { setForm({ url: '', name: '', note: '', youtube: true, facebook: true }); toast(r.next ? `${r.name} is next in line.` : `${r.name} added to the list.`) }
      router.refresh()
    } catch (e) { setErr(e.message) } finally { setBusy('') }
  }
  const Tick = ({ x, ch }) => { const c = x[ch], id = `lb-${ch}-${x.id}`
    return <div className={'lb-tick' + (c.on ? '' : ' lb-offch')}>
      <label htmlFor={id}><input id={id} type="checkbox" checked={c.on} disabled={c.locked || x.aside || busy === x.id + ch} onChange={(e) => tick(x, ch, e.target.checked)} />{ChIcon[ch]}{ch === 'youtube' ? 'YouTube' : 'Facebook'}</label>
      {c.text ? (c.link ? <a href={c.link} target="_blank" rel="noopener">{c.text}</a> : <span>{c.text}</span>) : null}
    </div> }

  return (<div className="au lb">
    <div className="lb-bar">
      <input className="input lb-find" type="search" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Search ideas and videos" aria-label="Search ideas and videos" />
      <button className="btn btn-green" aria-expanded={adding} onClick={() => { setAdding((a) => !a); setErr(''); setVerdict(null) }}>{adding ? 'Close' : 'Add your own idea'}</button>
    </div>

    {adding ? <section className="au-box lb-add" aria-label="Add your own idea">
      <h2>Add your own idea</h2>
      <p className="au-note">Olex AI opens the site and judges it like every idea it finds: value, safety, whether it shows well on screen, and how covered it already is on YouTube. It takes about half a minute.</p>
      <div className="lb-grid">
        <label className="lb-f"><span>Website address</span><input className="input" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://tldraw.com" inputMode="url" autoComplete="off" /></label>
        <label className="lb-f"><span>Name (optional)</span><input className="input" value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Filled in from the site" /></label>
      </div>
      <label className="lb-f"><span>Why it’s worth a video (optional)</span><input className="input" value={form.note} maxLength={300} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="It turns rough sketches into clean diagrams" /></label>
      <div className="lb-addfoot">
        <div className="lb-chs" role="group" aria-label="Post to">
          <label><input type="checkbox" checked={form.youtube} onChange={(e) => setForm({ ...form, youtube: e.target.checked })} />{ChIcon.youtube}YouTube</label>
          <label><input type="checkbox" checked={form.facebook} onChange={(e) => setForm({ ...form, facebook: e.target.checked })} />{ChIcon.facebook}Facebook</label>
          <label className="lb-offch" title="Instagram is off until that account is ready"><input type="checkbox" checked={false} disabled readOnly />{ChIcon.instagram}Instagram (off)</label>
        </div>
        <div className="lb-btns">
          <button className="btn btn-green" disabled={!!busy} onClick={() => add(true)}>{busy === 'next' ? 'Judging…' : 'Make it next'}</button>
          <button className="btn btn-line" disabled={!!busy} onClick={() => add(false)}>{busy === 'add' ? 'Judging…' : 'Add to the list'}</button>
        </div>
      </div>
      {busy === 'next' || busy === 'add' ? <p className="au-note lb-wait" role="status"><i aria-hidden="true" />Opening the site and judging it…</p> : null}
      {err ? <p className="err" role="alert">{err}</p> : null}
      {verdict ? (verdict.passed
        ? <p className="lb-verdict lb-no" role="status"><b>Olex AI turned down {verdict.name}.</b> {verdict.why}{verdict.risks && verdict.risks !== 'none' ? ` Risks: ${verdict.risks}` : ''}</p>
        : <p className="lb-verdict" role="status"><b>{verdict.name} scored {verdict.score}/100</b> and is {verdict.next ? 'next in line for a script' : 'in the list of ideas'}. {verdict.why}</p>) : null}
    </section> : null}

    <div className="seg lb-filters" role="group" aria-label="Show">
      {FILTERS.map(([k, l]) => <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l} <span className="au-n">{data.counts[k] || 0}</span></button>)}
    </div>
    {!data.fbLive ? <p className="au-note">Facebook posting is off, so its ticks only take effect once you turn it on in the Facebook tab.</p> : null}

    {list.length ? <ul className="lb-list">{list.map((x) => <li key={x.id} className={x.aside ? 'lb-aside' : ''}>
      <div className="lb-main">
        <div className="lb-name"><b>{x.name}</b><span className={'au-pill' + (x.stage === 'posted' ? ' au-on' : x.stage === 'ready' ? ' au-warn' : '')}>{STAGE[x.stage]}</span>{x.own ? <span className="au-pill">Your idea</span> : null}{x.first && x.stage !== 'posted' ? <span className="au-pill au-on">Next</span> : null}</div>
        <span className="lb-sub">{x.part ? `Part ${x.part}. ` : ''}{x.note}{x.why ? `: ${x.why}` : ''}</span>
        <a className="lb-url" href={x.url} target="_blank" rel="noopener">{x.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a>
      </div>
      <div className="lb-ticks">
        <Tick x={x} ch="youtube" /><Tick x={x} ch="facebook" />
        <div className="lb-tick lb-offch"><label title="Instagram is off until that account is ready"><input type="checkbox" checked={false} disabled readOnly aria-label={`Instagram for ${x.name} (off)`} />{ChIcon.instagram}Instagram</label><span>Off</span></div>
      </div>
    </li>)}</ul> : <p className="au-note lb-empty">{find ? 'Nothing matches that search.' : filter === 'all' ? 'No ideas yet. Olex AI finds new ones every day, or add your own above.' : 'Nothing here right now.'}</p>}

    <style dangerouslySetInnerHTML={{ __html: BASE + `
.lb{grid-template-columns:minmax(0,1fr)}   /* the column never grows past the screen (phones) */
.lb-bar{display:flex;gap:10px;flex-wrap:wrap}.lb-find{flex:1 1 240px;max-width:520px}
.lb-add{display:grid;gap:12px}.lb-add h2{margin:0}
.lb-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.lb-f{display:grid;gap:6px}.lb-f span{font-size:13.5px;font-weight:600;color:var(--dim)}
.lb-addfoot{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.lb-chs{display:flex;gap:16px;flex-wrap:wrap}.lb-chs label,.lb-tick label{display:inline-flex;align-items:center;gap:7px;font-size:14px;font-weight:600;cursor:pointer}
.lb input[type=checkbox]{width:17px;height:17px;accent-color:var(--green);margin:0;cursor:pointer}.lb input[type=checkbox]:disabled{cursor:default}
.lb-btns{display:flex;gap:8px;flex-wrap:wrap}
.lb-wait{display:flex;align-items:center;gap:9px}.lb-wait i{width:14px;height:14px;border-radius:50%;border:2px solid rgba(143,227,106,.25);border-top-color:var(--green);animation:lb-spin .8s linear infinite}
@keyframes lb-spin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){.lb-wait i{animation:none}}
.lb-verdict{margin:0;padding:12px 14px;border-radius:14px;background:rgba(143,227,106,.1);font-size:14.5px;line-height:1.55}.lb-verdict.lb-no{background:rgba(224,162,67,.12)}
.lb-filters{margin:4px 0 0}.lb-filters .au-n{color:var(--dim);font-weight:600;margin-left:3px}
.lb-list{list-style:none;margin:0;padding:0}
.lb-list li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:center;padding:14px 0;border-top:1px solid var(--line)}
.lb-list li:first-child{border-top:0}
.lb-main{display:grid;gap:3px;min-width:0}
.lb-name{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.lb-name b{font-size:15.5px}
.lb-sub{font-size:13.5px;color:var(--dim)}
.lb-url{font-size:13px;color:var(--green);text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lb-ticks{display:grid;grid-template-columns:repeat(3,128px);gap:6px}
.lb-tick{display:grid;gap:3px;align-content:start}.lb-tick span,.lb-tick a{font-size:12.5px;color:var(--dim);padding-left:24px}.lb-tick a{color:var(--green);text-decoration:none}
.lb-offch{opacity:.55}.lb-aside{opacity:.75}
.lb-empty{padding:18px 0}
@media (max-width:900px){.lb-list li{grid-template-columns:1fr}.lb-ticks{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:560px){.lb-grid{grid-template-columns:1fr}.lb-ticks{grid-template-columns:1fr 1fr}.lb-ticks .lb-tick:last-child{display:none}.lb-tick span,.lb-tick a{padding-left:0}}
` }} />
  </div>)
}
