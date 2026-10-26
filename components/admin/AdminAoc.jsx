'use client'
// Course & links, in sections: Overview · People · Feedback · WhatsApp link · Course settings.
// Plain words, big numbers; the same actions as before (save link, close/reopen, remove, save content, export).
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from './ui'

const dim = { color: 'var(--dim)' }
const ago = (d) => { const m = Math.round((Date.now() - new Date(d).getTime()) / 60e3); return m < 60 ? (m < 2 ? 'just now' : m + ' min ago') : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) === 1 ? 'yesterday' : Math.round(m / 1440) + ' days ago' }
const when = (d) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const initials = (n) => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')

export default function AdminAoc({ data }) {
  const router = useRouter(), [busy, setBusy] = useState(''), [err, setErr] = useState(''), [tab, setTab] = useState('overview'), [find, setFind] = useState('')
  const [phone, setPhone] = useState(data.link ? data.link.phone : ''), [msg, setMsg] = useState(data.link ? data.link.message : ''), [editMsg, setEditMsg] = useState(false)
  const [c, setC] = useState({ ...data.content, goal: data.goal, learn: (data.content.learn || []).join('\n') })
  async function call(body, ok) {
    setBusy(body.action); setErr('')
    try {
      const r = await fetch('/admin/api/aoc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })
      const j = await r.json().catch(() => ({})); if (r.status === 401) { window.location.assign('/admin/login'); return false }
      if (!r.ok) { setErr(j.error || 'Something went wrong.'); return false } toast(ok); router.refresh(); return true
    } catch { setErr('No connection. Try again.'); return false } finally { setBusy('') }
  }
  const parts = data.content.parts || [], people = data.people
  const info = useMemo(() => people.map((p) => {
    const pr = p.progress || {}, fullDone = !!(pr.full && pr.full.finish)
    const heard = parts.map((x) => fullDone || !!(pr[x.key] && (pr[x.key].play || pr[x.key].finish)) || !!(pr.full && pr.full.play && parts.indexOf(x) === 0))
    const finished = fullDone || (parts.length > 0 && parts.every((x) => pr[x.key] && pr[x.key].finish))
    const started = finished || heard.some(Boolean) || !!(pr.full && pr.full.play), downloaded = Object.values(pr).some((g) => g && g.download)
    const on = heard.lastIndexOf(true) + 1
    const say = [`Joined ${ago(p.created_at)}`, finished ? 'finished' : started ? (on ? `on part ${on}` : 'listening') : 'hasn’t started yet', downloaded ? 'downloaded' : '', p.feedback ? 'left feedback' : ''].filter(Boolean).join(' · ')
    return { ...p, heard, finished, started, downloaded, say }
  }), [people, parts])
  const today = new Date(Date.now() + 3600e3).toISOString().slice(0, 10)
  const joinedToday = info.filter((p) => new Date(p.created_at).getTime() + 3600e3 >= Date.parse(today + 'T00:00:00Z')).length
  const startedN = info.filter((p) => p.started).length, finishedN = info.filter((p) => p.finished).length, fbs = info.filter((p) => p.feedback)
  const tapsToday = (data.days.find((d) => d.day === today) || { n: 0 }).n, week = data.days.slice(-7).reduce((n, d) => n + d.n, 0)
  const stage = !data.accepting ? 'closed' : people.length >= data.goal ? 'bonus' : people.length >= data.fewFrom ? 'few' : 'open'
  const sees = { open: `“Only ${data.goal} slots”`, few: '“Join fast. Few spaces left.”', bonus: '“Bonus spots opened”', closed: '“Sign-ups are closed for now”' }[stage]
  const pctOf = (a, b) => b ? Math.round((a / b) * 100) : 0
  function csv() {
    const rows = [['Name', 'Joined', ...parts.map((p) => p.title), 'Finished', 'Downloaded', 'What they learned']].concat(info.map((p) => [p.name, when(p.created_at), ...p.heard.map((h) => h ? 'listened' : ''), p.finished ? 'yes' : '', p.downloaded ? 'yes' : '', p.feedback || '']))
    const blob = new Blob([rows.map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'anatomy-of-creation-people.csv'; a.click()
  }
  const setPart = (i, k, v) => setC({ ...c, parts: (c.parts || []).map((p, j) => (j === i ? { ...p, [k]: v } : p)) })
  const Row = ({ p }) => <div className="ca-row"><span className="ca-av" aria-hidden="true">{initials(p.name)}</span><div><b>{p.name}</b><p>{p.say}</p></div>
    <span className="ca-dots" aria-label={`${p.heard.filter(Boolean).length} of ${parts.length} parts listened`}>{p.heard.map((h, i) => <i key={i} className={h ? 'on' : ''} />)}</span></div>
  const T = [['overview', 'Overview'], ['people', 'People', people.length], ['feedback', 'Feedback', fbs.length], ['link', 'WhatsApp link'], ['settings', 'Course settings']]

  return (<>
    <div className="ca-hero"><div><h1 className="d" style={{ margin: 0 }}>{data.content.title || 'Anatomy of Creation'}</h1>
      <span className={'ca-pill ' + stage}><i />{stage === 'closed' ? 'Closed' : 'Open'} · visitors see {sees}</span></div>
      <div className="ca-hb"><a className="btn btn-line" href="/aoc" target="_blank" rel="noopener">View the page ↗</a>
        <button className={data.accepting ? 'btn btn-line' : 'btn btn-green'} disabled={!!busy} onClick={() => { if (!data.accepting || window.confirm('Close sign-ups? New visitors will see “Sign-ups are closed for now”. People who joined keep their access.')) call({ action: 'accepting', on: !data.accepting }, data.accepting ? 'Sign-ups closed.' : 'Sign-ups reopened.') }}>{busy === 'accepting' ? 'Saving…' : data.accepting ? 'Close sign-ups' : 'Reopen sign-ups'}</button></div></div>
    <div className="ca-tabs" role="tablist" aria-label="Course sections">{T.map(([k, l, n]) => <button key={k} role="tab" aria-selected={tab === k} className={'ca-tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}{n != null ? <i>{n}</i> : null}</button>)}</div>
    {err ? <p className="err" role="alert">{err}</p> : null}

    {tab === 'overview' ? <>
      <div className="ca-nums">
        <div><b>{people.length}</b><span>joined (of {data.goal})</span>{joinedToday ? <small>+{joinedToday} today</small> : null}</div>
        <div><b>{startedN}</b><span>started listening</span><small>{pctOf(startedN, people.length)}% of joiners</small></div>
        <div><b>{finishedN}</b><span>finished</span><small>{pctOf(finishedN, startedN)}% of listeners</small></div>
        <div><b>{fbs.length}</b><span>shared what they learned</span></div>
        <div><b>{tapsToday}</b><span>WhatsApp taps today</span><small>{week} this week</small></div>
      </div>
      <div className="ca-two"><section className="ca-card"><h2>Latest people</h2>{info.slice(0, 5).map((p) => <Row key={p.id} p={p} />)}{!people.length ? <p style={dim}>No one has joined yet.</p> : <button className="ca-more" onClick={() => setTab('people')}>See everyone →</button>}</section>
        <section className="ca-card"><h2>What people learned</h2>{fbs.slice(0, 3).map((p) => <div key={p.id} className="ca-fb">“{p.feedback}”<span>{p.name} · {ago(p.feedback_at || p.created_at)}</span></div>)}{!fbs.length ? <p style={dim}>No feedback yet.</p> : <button className="ca-more" onClick={() => setTab('feedback')}>All feedback →</button>}</section></div>
    </> : null}

    {tab === 'people' ? <section className="ca-card" style={{ maxWidth: 860 }}>
      <div className="ca-ph"><input className="input" type="search" placeholder="Search by name" value={find} onChange={(e) => setFind(e.target.value)} aria-label="Search people" /><button className="btn btn-line" onClick={csv}>Download the list</button></div>
      {info.filter((p) => !find || p.name.toLowerCase().includes(find.toLowerCase())).map((p) => <div key={p.id} className="ca-pr"><Row p={p} /><button className="ca-x" aria-label={'Remove ' + p.name} disabled={!!busy} onClick={() => { if (window.confirm(`Remove ${p.name}? Their access link stops working.`)) call({ action: 'remove', id: p.id }, 'Removed.') }}>×</button></div>)}
      {!people.length ? <p style={dim}>No one has joined yet.</p> : <p className="ca-key">The four dots are the four parts. Green = listened.</p>}
    </section> : null}

    {tab === 'feedback' ? <section className="ca-card" style={{ maxWidth: 860 }}>{fbs.length ? fbs.map((p) => <div key={p.id} className="ca-fb">“{p.feedback}”<span>{p.name} · {ago(p.feedback_at || p.created_at)}</span></div>) : <p style={dim}>No feedback yet. People can share what they learned at the bottom of the course page.</p>}</section> : null}

    {tab === 'link' ? <section className="ca-card" style={{ maxWidth: 640, display: 'grid', gap: 12 }}>
      <div className="ca-url"><b>olexweb.com/me</b><span style={{ display: 'flex', gap: 8 }}><button className="btn btn-line" onClick={() => { navigator.clipboard.writeText('https://olexweb.com/me'); toast('Link copied.') }}>Copy</button><a className="btn btn-line" href="/me" target="_blank" rel="noopener">Test it</a></span></div>
      <p style={{ margin: 0, fontSize: 14, ...dim }}>{tapsToday} taps today · {week} this week · {(data.link && data.link.clicks) || 0} in total. Put this one link on every flyer and status; change the message whenever the campaign changes.</p>
      {!editMsg ? <div className="ca-msg">Message they send: “{msg}” <button className="ca-more" onClick={() => setEditMsg(true)}>Change</button></div> : <>
        <label className="ca-l">Your WhatsApp number, with country code<input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" /></label>
        <label className="ca-l">The message they send<textarea className="input" rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} /></label>
        <div style={{ display: 'flex', gap: 8 }}><button className="btn btn-green" disabled={!!busy} onClick={async () => { if (await call({ action: 'save-link', phone, message: msg }, 'WhatsApp link saved.')) setEditMsg(false) }}>{busy === 'save-link' ? 'Saving…' : 'Save'}</button><button className="btn btn-line" onClick={() => setEditMsg(false)}>Cancel</button></div></>}
    </section> : null}

    {tab === 'settings' ? <section className="ca-card" style={{ maxWidth: 760, display: 'grid', gap: 12 }}>
      <label className="ca-l">Slots shown on the page<input className="input" type="number" min={1} value={c.goal} onChange={(e) => setC({ ...c, goal: e.target.value })} style={{ maxWidth: 160 }} /><small style={dim}>“Few spaces left” shows from {Math.max(1, Math.round((Number(c.goal) || 100) * 0.6))} joins; “Bonus spots opened” after {Number(c.goal) || 100}. It never closes by itself.</small></label>
      <label className="ca-l">Course title<input className="input" value={c.title || ''} onChange={(e) => setC({ ...c, title: e.target.value })} /></label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}><label className="ca-l">Opening line<input className="input" value={c.tagline || ''} onChange={(e) => setC({ ...c, tagline: e.target.value })} /></label><label className="ca-l">…its green ending<input className="input" value={c.taglineBold || ''} onChange={(e) => setC({ ...c, taglineBold: e.target.value })} /></label></div>
      <label className="ca-l">What you’ll get (one per line)<textarea className="input" rows={5} value={c.learn} onChange={(e) => setC({ ...c, learn: e.target.value })} /></label>
      <b style={{ fontSize: 15, marginTop: 6 }}>The recordings</b>
      {(c.parts || []).map((p, i) => <div key={i} className="ca-part"><input className="input" aria-label={'Part ' + (i + 1) + ' title'} value={p.title} onChange={(e) => setPart(i, 'title', e.target.value)} /><input className="input" aria-label={'Part ' + (i + 1) + ' file'} value={p.file} onChange={(e) => setPart(i, 'file', e.target.value)} /><textarea className="input" rows={2} aria-label={'What part ' + (i + 1) + ' covers'} value={p.covers || ''} onChange={(e) => setPart(i, 'covers', e.target.value)} placeholder="What it covers (one per line)" /></div>)}
      <div><button className="btn btn-green" disabled={!!busy} onClick={() => call({ action: 'save-content', content: { ...c, learn: String(c.learn || '').split('\n') } }, 'Course saved.')}>{busy === 'save-content' ? 'Saving…' : 'Save course'}</button></div>
    </section> : null}

    <style>{`
.ca-hero{display:flex;justify-content:space-between;gap:14px;align-items:center;flex-wrap:wrap;margin:4px 0 14px}.ca-hb{display:flex;gap:8px;flex-wrap:wrap}
.ca-pill{display:inline-flex;gap:8px;align-items:center;margin-top:8px;padding:7px 13px;border-radius:999px;background:rgba(143,227,106,.12);color:var(--green);font-weight:700;font-size:13.5px}.ca-pill i{width:8px;height:8px;border-radius:50%;background:currentColor}.ca-pill.few,.ca-pill.bonus{background:rgba(255,201,77,.12);color:#ffc94d}.ca-pill.closed{background:rgba(255,138,138,.12);color:#ff8a8a}
.ca-tabs{display:flex;gap:4px;flex-wrap:nowrap;overflow-x:auto;margin:0 0 16px;border-bottom:1px solid var(--line)}.ca-tab{flex:none;padding:10px 14px;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;background:none;color:var(--dim);font:700 14.5px inherit;cursor:pointer}.ca-tab.on{color:var(--paper);border-color:var(--green)}.ca-tab i{font-style:normal;margin-left:6px;padding:1px 7px;border-radius:99px;background:var(--raise);font-size:12px}
.ca-nums{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:14px}.ca-nums div{padding:16px;border-radius:20px;background:var(--raise);border:1px solid var(--line)}.ca-nums b{display:block;font-family:var(--display);font-stretch:80%;font-weight:900;font-size:40px;line-height:1}.ca-nums span{font-size:13.5px;color:var(--dim)}.ca-nums small{display:block;margin-top:6px;font-size:12.5px;color:var(--green)}
.ca-two{display:grid;gap:14px;align-items:start}@media(min-width:900px){.ca-two{grid-template-columns:1.25fr .75fr}}
.ca-card{padding:18px;border-radius:20px;background:var(--raise);border:1px solid var(--line)}.ca-card h2{margin:0 0 10px;font-size:18px}
.ca-row{display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px 2px;border-bottom:1px solid var(--line)}.ca-row b{font-size:15px}.ca-row p{margin:2px 0 0;font-size:13px;color:var(--dim)}
.ca-av{width:38px;height:38px;border-radius:50%;background:var(--raise2,rgba(242,239,233,.08));display:grid;place-items:center;font-weight:800;font-size:13.5px}
.ca-dots{display:flex;gap:4px}.ca-dots i{width:12px;height:12px;border-radius:50%;background:rgba(242,239,233,.14)}.ca-dots i.on{background:var(--green)}
.ca-pr{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center}.ca-x{width:30px;height:30px;border-radius:50%;border:1px solid var(--line);background:transparent;color:var(--dim);cursor:pointer;font-size:16px}
.ca-ph{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:6px}.ca-ph input{flex:1;min-width:200px}.ca-key{margin:10px 0 0;font-size:13px;color:var(--dim)}
.ca-fb{padding:14px;border-radius:16px;background:rgba(242,239,233,.05);margin-bottom:10px;font-size:14.5px;line-height:1.5;white-space:pre-wrap}.ca-fb span{display:block;margin-top:6px;font-size:12.5px;color:var(--dim)}
.ca-more{margin-top:10px;padding:0;border:0;background:none;color:var(--green);font:700 14px inherit;cursor:pointer}
.ca-url{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 14px;border-radius:14px;background:rgba(242,239,233,.05);font-size:17px}
.ca-msg{padding:12px 14px;border-radius:14px;border:1px solid var(--line);font-size:14.5px;color:var(--dim)}.ca-msg .ca-more{margin:0 0 0 6px}
.ca-l{display:grid;gap:6px;font-size:14px}.ca-part{display:grid;gap:8px;padding:12px;border-radius:14px;border:1px solid var(--line)}@media(min-width:760px){.ca-part{grid-template-columns:1fr 1fr}.ca-part textarea{grid-column:1/-1}}
`}</style>
  </>)
}
