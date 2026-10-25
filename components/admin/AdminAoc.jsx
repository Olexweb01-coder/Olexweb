'use client'
// Course & links: the WhatsApp link (olexweb.com/me) you can re-point any time, and the free course (olexweb.com/aoc):
// who joined, what they listened to, what they learned, and the course content.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from './ui'

const card = { padding: 18, borderRadius: 20, background: 'var(--raise)', border: '1px solid var(--line)', marginBottom: 12 }
const h2 = { margin: '0 0 12px', fontFamily: 'var(--display)', fontWeight: 800, fontStretch: '88%', fontSize: 21 }
const dim = { color: 'var(--dim)' }
const when = (d) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function AdminAoc({ data }) {
  const router = useRouter(), [busy, setBusy] = useState(''), [err, setErr] = useState('')
  const [phone, setPhone] = useState(data.link ? data.link.phone : ''), [msg, setMsg] = useState(data.link ? data.link.message : '')
  const [c, setC] = useState({ ...data.content, goal: data.goal, learn: (data.content.learn || []).join('\n') }), [show, setShow] = useState(null)
  async function call(body, ok) {
    setBusy(body.action); setErr('')
    try {
      const r = await fetch('/admin/api/aoc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })
      const j = await r.json().catch(() => ({})); if (r.status === 401) { window.location.assign('/admin/login'); return }
      if (!r.ok) setErr(j.error || 'Something went wrong.'); else { toast(ok); router.refresh() }
    } catch { setErr('No connection. Try again.') } finally { setBusy('') }
  }
  const parts = c.parts || [], people = data.people, finished = people.filter((p) => (p.progress.full && p.progress.full.finish) || (parts.length && parts.every((x) => p.progress[x.key] && p.progress[x.key].finish))).length
  const week = data.days.slice(-7).reduce((n, d) => n + d.n, 0)
  function csv() {
    const st = (g) => g ? (g.finish ? 'finished' : g.download ? 'downloaded' : 'started') : ''
    const rows = [['Name', 'Joined', 'Full course', ...parts.map((p) => p.title), 'What they learned']].concat(people.map((p) => [p.name, when(p.created_at), st(p.progress.full), ...parts.map((x) => p.progress[x.key] ? (p.progress[x.key].finish ? 'finished' : p.progress[x.key].download ? 'downloaded' : 'started') : ''), p.feedback || '']))
    const blob = new Blob([rows.map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'aoc-listeners.csv'; a.click()
  }
  const setPart = (i, k, v) => setC({ ...c, parts: parts.map((p, j) => (j === i ? { ...p, [k]: v } : p)) })
  return (<>
    <div className="top"><h1 className="d">Course &amp; links</h1></div>
    {err ? <p className="err" role="alert">{err}</p> : null}

    <section style={card} aria-labelledby="wl">
      <h2 id="wl" style={h2}>Your WhatsApp link</h2>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <code style={{ fontSize: 17, padding: '8px 12px', borderRadius: 10, background: 'rgba(242,239,233,.06)' }}>olexweb.com/me</code>
        <button className="btn btn-line" onClick={() => { navigator.clipboard.writeText('https://olexweb.com/me'); toast('Link copied.') }}>Copy</button>
        <a className="btn btn-line" href="/me" target="_blank" rel="noopener">Test it</a>
        <span style={{ fontSize: 13.5, ...dim }}>{(data.link && data.link.clicks) || 0} taps in total · {week} this week</span>
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 13.5, lineHeight: 1.55, ...dim }}>Put this one link on every flyer and status. Change the message below whenever the campaign changes; the link stays the same.</p>
      <div style={{ display: 'grid', gap: 10, maxWidth: 560 }}>
        <label style={{ display: 'grid', gap: 6, fontSize: 14 }}>Your WhatsApp number, with country code<input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" /></label>
        <label style={{ display: 'grid', gap: 6, fontSize: 14 }}>The message that appears, ready to send<textarea className="input" rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={600} /></label>
        <div><button className="btn btn-green" disabled={!!busy} onClick={() => call({ action: 'save-link', phone, message: msg }, 'WhatsApp link updated.')}>{busy === 'save-link' ? 'Saving…' : 'Save'}</button></div>
      </div>
    </section>

    <section style={card} aria-labelledby="aoc">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <h2 id="aoc" style={{ ...h2, margin: 0 }}>{c.title} <span style={{ fontSize: 15, fontWeight: 600, ...dim }}>olexweb.com/aoc</span></h2>
        <div style={{ display: 'flex', gap: 8 }}><button className="btn btn-line" onClick={() => { navigator.clipboard.writeText('https://olexweb.com/aoc'); toast('Course link copied.') }}>Copy course link</button>
          {people.length ? <button className="btn btn-line" onClick={csv}>Export (CSV)</button> : null}</div>
      </div>
      {(() => { const n = people.length, st = !data.accepting ? 'closed' : n >= data.goal ? 'bonus' : n >= data.fewFrom ? 'few' : 'open'
        const say = { open: `“Only ${data.goal} slots. Get in before it closes.”`, few: '“Join fast. Few spaces left.”', bonus: '“Bonus spots opened. Join while it’s open.”', closed: '“Sign-ups are closed for now.”' }[st]
        return <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', margin: '14px 0 0', padding: 14, borderRadius: 16, border: '1px solid var(--line)', background: st === 'closed' ? 'rgba(255,120,120,.08)' : st === 'open' ? 'transparent' : 'rgba(255,190,90,.08)' }}>
          <span style={{ fontSize: 14.5 }}>Visitors see: <b>{say}</b></span>
          <button className={data.accepting ? 'btn btn-line' : 'btn btn-green'} style={{ marginLeft: 'auto' }} disabled={!!busy} onClick={() => { if (!data.accepting || window.confirm('Close sign-ups? New visitors will see “Sign-ups are closed for now”. People who joined keep their access.')) call({ action: 'accepting', on: !data.accepting }, data.accepting ? 'Sign-ups closed.' : 'Sign-ups reopened.') }}>{busy === 'accepting' ? 'Saving…' : data.accepting ? 'Close sign-ups' : 'Reopen sign-ups'}</button>
        </div> })()}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, margin: '14px 0' }}>
        {[['Joined', `${people.length} of ${data.goal}`], ['Finished all', finished], ['Shared what they learned', people.filter((p) => p.feedback).length]].map(([k, v]) => <div key={k} style={{ padding: 14, borderRadius: 16, border: '1px solid var(--line)' }}><div style={{ fontSize: 13, ...dim }}>{k}</div><b className="d" style={{ fontSize: 28 }}>{v}</b></div>)}
      </div>
      {people.length ? <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: 14 }}>
        <thead><tr style={{ textAlign: 'left', fontSize: 12.5, ...dim }}><th style={{ padding: 8 }}>Name</th><th style={{ padding: 8 }}>Joined</th>{c.full ? <th style={{ padding: 8, textAlign: 'center' }} title={c.full.title}>Full</th> : null}{parts.map((p, i) => <th key={p.key} style={{ padding: 8, textAlign: 'center' }} title={p.title}>{i + 1}</th>)}<th style={{ padding: 8 }}>Learned</th><th /></tr></thead>
        <tbody>{people.map((p) => <tr key={p.id} style={{ borderTop: '1px solid var(--line)' }}>
          <td style={{ padding: 8, fontWeight: 600 }}>{p.name}</td><td style={{ padding: 8, ...dim }}>{when(p.created_at)}</td>
          {c.full ? (() => { const g = p.progress.full; return <td style={{ padding: 8, textAlign: 'center' }} title={g ? Object.keys(g).join(', ') : 'not yet'}>{g ? (g.finish ? '✅' : g.download ? '⬇' : '▶') : '·'}</td> })() : null}
          {parts.map((x) => { const g = p.progress[x.key]; return <td key={x.key} style={{ padding: 8, textAlign: 'center' }} title={g ? Object.keys(g).join(', ') : 'not yet'}>{g ? (g.finish ? '✅' : g.download ? '⬇' : '▶') : '·'}</td> })}
          <td style={{ padding: 8 }}>{p.feedback ? <button className="btn btn-line" style={{ padding: '4px 10px' }} onClick={() => setShow(show === p.id ? null : p.id)}>{show === p.id ? 'Hide' : 'Read'}</button> : <span style={dim}>–</span>}</td>
          <td style={{ padding: 8 }}><button className="btn btn-line" style={{ padding: '4px 10px' }} disabled={!!busy} onClick={() => { if (window.confirm(`Remove ${p.name} from the list?`)) call({ action: 'remove', id: p.id }, 'Removed.') }}>Remove</button></td>
        </tr>)}</tbody></table>
        {show ? <p style={{ marginTop: 10, padding: 14, borderRadius: 14, border: '1px solid var(--line)', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}><b>{(people.find((p) => p.id === show) || {}).name}:</b> {(people.find((p) => p.id === show) || {}).feedback}</p> : null}
        <p style={{ fontSize: 12.5, ...dim }}>▶ started · ⬇ downloaded · ✅ listened to the end. Full is the one-file course; the numbers are the parts.</p></div>
        : <p style={dim}>Nobody has opened the course yet. Share olexweb.com/aoc with people once they’ve messaged you.</p>}
    </section>

    <section style={card} aria-labelledby="cc">
      <h2 id="cc" style={h2}>Course content</h2>
      <p style={{ margin: '0 0 12px', fontSize: 13.5, lineHeight: 1.55, ...dim }}>The recordings live in your project’s <code>public/aoc</code> folder. To change a recording, send the new file to Claude so the full course is rebuilt too. Text here changes the page straight away.</p>
      <div style={{ display: 'grid', gap: 10 }}>
        {[['title', 'Title'], ['tagline', 'Headline, first half'], ['taglineBold', 'Headline, bold half'], ['intro', 'Line under the headline']].map(([k, l]) => <label key={k} style={{ display: 'grid', gap: 6, fontSize: 14 }}>{l}{k === 'intro' ? <textarea className="input" rows={3} value={c[k] || ''} onChange={(e) => setC({ ...c, [k]: e.target.value })} /> : <input className="input" value={c[k] || ''} onChange={(e) => setC({ ...c, [k]: e.target.value })} />}</label>)}
        <label style={{ display: 'grid', gap: 6, fontSize: 14 }}>What you’ll get (one per line; numbered 00, 01… on the page)<textarea className="input" rows={5} value={c.learn} onChange={(e) => setC({ ...c, learn: e.target.value })} /></label>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'grid', gap: 6, fontSize: 14, maxWidth: 200 }}>Slots<input className="input" type="number" min={1} value={c.goal} onChange={(e) => setC({ ...c, goal: e.target.value })} /></label>
          <span style={{ fontSize: 13.5, ...dim }}>“Few spaces left” shows from {Math.max(1, Math.round((Number(c.goal) || 100) * 0.6))} joins; “Bonus spots opened” after {Number(c.goal) || 100}. It never closes by itself.</span>
        </div>
        <b style={{ fontSize: 14, marginTop: 6 }}>Recordings, in order</b>
        {parts.map((p, i) => <div key={i} style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 14, border: '1px solid var(--line)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,.6fr) minmax(0,1.4fr) auto', gap: 8 }}>
            <input className="input" aria-label={`Recording ${i + 1} title`} value={p.title} onChange={(e) => setPart(i, 'title', e.target.value)} placeholder="Part 1" />
            <input className="input" aria-label={`Recording ${i + 1} file`} value={p.file} onChange={(e) => setPart(i, 'file', e.target.value)} placeholder="/aoc/file.m4a" />
            <button className="btn btn-line" onClick={() => setC({ ...c, parts: parts.filter((_, j) => j !== i) })}>Remove</button></div>
          <textarea className="input" rows={2} aria-label={`Recording ${i + 1} covers`} value={p.covers || ''} onChange={(e) => setPart(i, 'covers', e.target.value)} placeholder={'What it covers, one per line, like: 02 · The Question you can’t leave alone'} /></div>)}
        <div><button className="btn btn-line" onClick={() => setC({ ...c, parts: [...parts, { key: 'p' + Date.now().toString(36), title: '', file: '/aoc/' }] })}>Add a recording</button></div>
        <b style={{ fontSize: 14, marginTop: 6 }}>The full course in one file</b>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
          <input className="input" aria-label="Full course file" value={(c.full && c.full.file) || ''} onChange={(e) => setC({ ...c, full: { ...(c.full || {}), file: e.target.value } })} placeholder="/aoc/anatomy-of-creation-full-course.m4a" />
          <input className="input" aria-label="Full course note" value={(c.full && c.full.note) || ''} onChange={(e) => setC({ ...c, full: { ...(c.full || {}), note: e.target.value } })} placeholder="All 4 parts in one file · 37 minutes · 18 MB" /></div>
        <b style={{ fontSize: 14, marginTop: 6 }}>Extra download (optional)</b>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)', gap: 8 }}>
          <input className="input" aria-label="Download title" value={(c.map && c.map.title) || ''} onChange={(e) => setC({ ...c, map: { ...(c.map || {}), title: e.target.value } })} placeholder="The Creation Map" />
          <input className="input" aria-label="Download file" value={(c.map && c.map.file) || ''} onChange={(e) => setC({ ...c, map: { ...(c.map || {}), file: e.target.value } })} placeholder="/aoc/creation-map.pdf" /></div>
        <div><button className="btn btn-green" disabled={!!busy} onClick={() => call({ action: 'save-content', content: { ...c, learn: String(c.learn || '').split('\n') } }, 'Course content saved.')}>{busy === 'save-content' ? 'Saving…' : 'Save course content'}</button></div>
      </div>
    </section>
  </>)
}
