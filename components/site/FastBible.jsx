'use client'
// The Graceville Fast Bible page: what it does, and the private download (lib/site/apps.js). Request → wait here while
// Olaitan approves → the installer downloads by itself (in pieces, saved as the real file) → open it to install.
import { useEffect, useRef, useState } from 'react'

const APP = 'graceville-fast-bible'
const FEATURES = [
  ['mic', 'Speech to screen', 'The preacher says “Romans 8:28” and it’s on the screen before the next sentence. It listens, finds the verse and shows it. Nobody types, nobody searches.'],
  ['bolt', 'Ready in minutes', 'Install it, choose your screens, and you’re set for Sunday in less time than a sound check.'],
  ['book', 'Every verse, instantly', 'Type a few letters (“jn 3 16”) and it’s up. Switch translations in the middle of the service without losing your place.'],
  ['play', 'Present anything', 'Songs, sermon points, announcements, pictures and videos, all in one place, all one click away.'],
  ['music', 'Lyrics that keep up', 'Verses, choruses and bridges laid out the way the band sings them, so the screen never falls behind the worship.'],
  ['stage', 'A screen for the pulpit', 'A separate stage display shows the preacher and singers what’s on screen, what’s next, notes and the time.'],
  ['screens', 'Every screen its own look', 'The main screen, the livestream and the stage display, each with the right layout and background.'],
  ['clock', 'Countdowns and timers', 'Count down to the start of service and keep the sermon on time, right on screen.'],
  ['phone', 'Control it from a phone', 'Move the slides from a phone on the church Wi-Fi, from anywhere in the hall.'],
  ['live', 'Ready for the livestream', 'Clean lower-thirds and NDI output, so online members see the same scripture as the hall.'],
  ['import', 'Bring what you already have', 'Import songs and slides from PowerPoint, ProPresenter, EasyWorship and more.'],
  ['heart', 'Made for Graceville', 'Built around the way our media team runs a service, and looked after for our church alone.'],
]
const ICON = {
  mic: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3', bolt: 'M13 2 4 14h7l-1 8 9-12h-7z', book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 5v16M9 8h6',
  play: 'M5 4h14v16H5zM10 9l5 3-5 3z', music: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', stage: 'M3 5h18v11H3zM8 20h8M12 16v4',
  screens: 'M2 4h13v9H2zM9 17h13v-9M6 13v3', clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2', phone: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2',
  live: 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8', import: 'M12 3v12M7 10l5 5 5-5M4 21h16',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
}
const Ic = ({ k }) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICON[k]} /></svg>
const mb = (n) => (n / 1048576).toFixed(0) + ' MB'

export default function FastBible() {
  const [st, setSt] = useState({ status: 'loading' }), [form, setForm] = useState(false), [f, setF] = useState({ name: '', email: '', phone: '' })
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false), [dl, setDl] = useState(null), [notWin, setNotWin] = useState(false), [msg, setMsg] = useState('')
  const started = useRef(false), was = useRef(null)
  async function check() {
    try { const r = await fetch('/api/apps?app=' + APP, { cache: 'no-store' }); const j = await r.json(); setSt(j); return j } catch { return null }
  }
  useEffect(() => {
    setNotWin(!/Windows/i.test(navigator.userAgent))
    const p = new URLSearchParams(location.search)
    if (p.get('link') === 'expired') setMsg('That link has expired or was already used. Request again with the same email and a new one is sent.')
    check().then((j) => { was.current = j && j.status; if (j && j.status === 'approved' && p.get('ready') && j.release) download(j.release) })
  }, [])
  // while waiting: look every 4 seconds; the moment it's approved, the download starts by itself
  useEffect(() => {
    if (st.status !== 'waiting') return
    const t = setInterval(async () => { const j = await check(); if (j && j.status === 'approved' && j.release && !started.current) download(j.release) }, 4000)
    return () => clearInterval(t)
  }, [st.status])
  async function request(e) {
    e.preventDefault(); setBusy(true); setErr('')
    try {
      const r = await fetch('/api/apps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'request', app: APP, ...f }) })
      const j = await r.json(); if (!r.ok) setErr(j.error || 'Something went wrong. Try again.'); else { setSt({ status: j.status }); setForm(false) }
    } catch { setErr('No connection. Try again.') }
    setBusy(false)
  }
  async function download(rel) {
    if (started.current) return; started.current = true
    setDl({ done: 0, total: rel.pieces, size: rel.size, name: rel.filename })
    const parts = []
    try {
      for (let n = 0; n < rel.pieces; n++) {
        let buf = null
        for (let tryN = 0; tryN < 4 && !buf; tryN++) {
          const r = await fetch(`/api/apps/piece?app=${APP}&r=${rel.id}&n=${n}`, { cache: 'no-store' }).catch(() => null)
          if (r && r.ok) buf = await r.arrayBuffer()
          else if (r && (r.status === 403 || r.status === 410)) { const j = await r.json().catch(() => ({})); throw new Error(j.error || 'Not allowed.') }
          else await new Promise((res) => setTimeout(res, 2000 * (tryN + 1)))
        }
        if (!buf) throw new Error('The connection dropped. Tap Download to try again.')
        parts.push(buf); setDl((d) => ({ ...d, done: n + 1 }))
      }
      const url = URL.createObjectURL(new Blob(parts, { type: 'application/octet-stream' }))
      const a = document.createElement('a'); a.href = url; a.download = rel.filename; document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
      setDl((d) => ({ ...d, saved: true }))
      fetch('/api/apps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'done', app: APP }) }).catch(() => {})
    } catch (e) { setDl({ error: e.message }); started.current = false; check() }
  }
  const rel = st.release
  let box
  if (dl && dl.saved) box = <div className="fb-box fb-ok" role="status"><b>Downloaded.</b><p>It’s in your <b>Downloads</b> folder: <code>{dl.name}</code>. Open it to install.</p>
    <p className="fb-dim">If Windows says “Windows protected your PC”, tap <b>More info</b>, then <b>Run anyway</b>. That shows for new apps that aren’t sold in a store.</p>
    <button className="fb-btn fb-line" onClick={() => { started.current = false; setDl(null); if (rel) download(rel) }}>Download again</button></div>
  else if (dl && !dl.error) box = <div className="fb-box" role="status"><b>Downloading… keep this page open</b><div className="fb-bar"><i style={{ width: (100 * dl.done / dl.total) + '%' }} /></div><p className="fb-dim">{Math.round(100 * dl.done / dl.total)}% of {mb(dl.size)}</p></div>
  else if (st.status === 'approved') box = <div className="fb-box fb-ok">{dl && dl.error ? <p className="fb-err">{dl.error}</p> : null}<b>You’re approved{st.name ? ', ' + st.name.split(' ')[0] : ''}.</b>
    {rel ? <><p className="fb-dim">Version {rel.version} · {mb(rel.size)} · Windows 10 and 11</p><button className="fb-btn" onClick={() => download(rel)}>Download now</button></> : <p className="fb-dim">The installer is being updated. Check back shortly.</p>}</div>
  else if (st.status === 'waiting') box = <div className="fb-box" role="status"><span className="fb-pulse" aria-hidden="true" /><b>Waiting for approval…</b><p>Your request has gone to the media team. Keep this page open: the download starts by itself the moment you’re approved.</p><p className="fb-dim">Closed it? You’ll also get an email with your download link.</p></div>
  else if (st.status === 'check-email') box = <div className="fb-box fb-ok" role="status"><b>Check your email.</b><p>You’re already approved, so we’ve sent you a link. Open it on this computer and the download starts.</p></div>
  else if (st.status === 'declined') box = <div className="fb-box"><b>Your request wasn’t approved.</b><p className="fb-dim">If you think that’s a mistake, speak to the media team at church.</p></div>
  else if (st.status === 'banned') box = <div className="fb-box"><b>Downloads aren’t available for you.</b><p className="fb-dim">Speak to the media team at church.</p></div>
  else if (form) box = <form className="fb-box fb-form" onSubmit={request}>
    <b>Request download</b><p className="fb-dim">The media team approves each request. You’ll get the installer the moment they do.</p>
    <label>Your name<input required minLength={2} maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></label>
    <label>Email<input required type="email" maxLength={200} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" /></label>
    <label>Phone (optional)<input type="tel" maxLength={30} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="tel" /></label>
    {err ? <p className="fb-err" role="alert">{err}</p> : null}
    <button className="fb-btn" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</button></form>
  else box = <div className="fb-box fb-cta"><button className="fb-btn" disabled={st.status === 'loading'} onClick={() => setForm(true)}>Request download</button><p className="fb-dim">For Graceville members only · Windows 10 and 11</p></div>

  return (<div className="fb">
    <header className="fb-nav"><a className="fb-mark" href="/" aria-label="Olexweb, home"><img src="/studio/mark.png" alt="" width="21" height="24" />Olexweb</a><a href="/tools" className="fb-back">← Directory</a></header>
    <section className="fb-hero">
      <div className="fb-glow" aria-hidden="true" />
      <span className="fb-eb">Olexweb · Made for Graceville</span>
      <h1>Scripture on screen<br /><em>the moment it’s preached.</em></h1>
      <p className="fb-lead">Graceville Fast Bible listens as the Word is read and puts the verse on the screen in seconds. No typing, no searching, no waiting: just the Word, right on time.</p>
      {msg ? <p className="fb-err">{msg}</p> : null}
      {notWin && st.status !== 'approved' ? <p className="fb-dim">It installs on Windows computers. Open this page on the computer you’ll use at church.</p> : null}
      <div id="get">{box}</div>
      <div className="fb-demo" aria-hidden="true"><div className="fb-scr"><small>Romans 8:28</small><p>“And we know that all things work together for good to them that love God, to them who are the called according to his purpose.”</p></div><div className="fb-wave">{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ animationDelay: (i * 0.07) + 's' }} />)}</div><span className="fb-said">“…turn with me to Romans eight, verse twenty-eight…”</span></div>
    </section>
    <section className="fb-sec"><h2>Everything a Sunday needs</h2>
      <div className="fb-grid">{FEATURES.map(([k, t, d]) => <article key={t} className="fb-card"><span className="fb-ic"><Ic k={k} /></span><h3>{t}</h3><p>{d}</p></article>)}</div></section>
    <section className="fb-sec fb-steps"><h2>How to get it</h2>
      <ol><li><b>Request</b><span>Tap Request download and give your name and email.</span></li><li><b>Approved</b><span>The media team approves you, usually within the day.</span></li><li><b>Installed</b><span>It downloads by itself. Open it, install, and it’s ready for Sunday.</span></li></ol>
      <p className="fb-dim">Approved once, you can download it again any time. On a new computer, request with the same email and we’ll send you a link.</p>
      {st.status === 'none' ? <a className="fb-btn" href="#get" onClick={() => setForm(true)}>Request download</a> : null}</section>
    <footer className="fb-foot"><p>Custom-built for Graceville by <a href="/">Olexweb</a>. Built on FreeShow, the free and open-source presentation software (GPL-3.0).</p><p className="fb-dim">This app is for Graceville members only. Please don’t share the installer.</p></footer>
    <style>{CSS}</style>
  </div>)
}
const CSS = `body{margin:0}.fb{--gold:#8fe36a;--ink:#f2efe9;--dim:#9a9d97;--card:#121412;--line:rgba(143,227,106,.16);min-height:100vh;background:#0a0b0a;color:var(--ink);font-family:var(--font-manrope),system-ui,sans-serif;overflow-x:clip}
.fb a{color:var(--gold)}.fb-nav{display:flex;justify-content:space-between;align-items:center;padding:18px clamp(16px,5vw,64px);font-size:14px;color:var(--dim)}.fb-back{text-decoration:none;font-weight:700}.fb-mark{display:flex;align-items:center;gap:9px;color:var(--ink)!important;text-decoration:none;font-family:var(--font-mona),system-ui,sans-serif;font-weight:800;font-size:18px;letter-spacing:-.01em}
.fb-hero{position:relative;padding:clamp(40px,8vw,90px) clamp(16px,5vw,64px) 60px;max-width:1180px;margin:0 auto;display:grid;gap:22px;isolation:isolate}
.fb-glow{position:absolute;inset:-10% -20% auto auto;width:70vw;height:70vw;max-width:820px;max-height:820px;background:radial-gradient(circle,rgba(143,227,106,.2),transparent 62%);z-index:-1;filter:blur(10px);animation:fbd 14s ease-in-out infinite alternate}@keyframes fbd{to{transform:translate(-8%,6%) scale(1.1)}}
.fb-eb{display:inline-block;width:fit-content;padding:7px 14px;border-radius:99px;border:1px solid var(--line);color:var(--gold);font-weight:800;font-size:12.5px;letter-spacing:.12em;text-transform:uppercase}
.fb h1{margin:0;font-family:var(--font-mona),system-ui,sans-serif;font-size:clamp(40px,7vw,88px);line-height:1;letter-spacing:-.035em;font-weight:800;font-stretch:110%}.fb h1 em{font-style:normal;color:var(--gold)}
.fb-lead{max-width:640px;margin:0;font-size:clamp(17px,1.6vw,20px);line-height:1.55;color:#d9d6cf}
.fb-box{max-width:520px;padding:20px;border-radius:22px;background:var(--card);border:1px solid var(--line);display:grid;gap:10px}.fb-box b{font-size:18px}.fb-box p{margin:0;line-height:1.5}.fb-ok{border-color:rgba(143,227,106,.4)}
.fb-cta{background:transparent;border:0;padding:0}.fb-dim{color:var(--dim);font-size:14.5px}.fb-err{color:#ffb4a8;margin:0}.fb-box code{background:#000;padding:2px 6px;border-radius:6px;font-size:13px;word-break:break-all}
.fb-btn{display:inline-flex;justify-content:center;align-items:center;width:fit-content;padding:15px 26px;border-radius:99px;border:0;background:var(--gold);color:#0e1a0b!important;font:inherit;font-weight:800;font-size:16.5px;cursor:pointer;text-decoration:none;box-shadow:0 14px 40px -16px var(--gold);transition:transform .2s}.fb-btn:hover{transform:translateY(-2px)}.fb-btn:disabled{opacity:.5}
.fb-line{background:transparent;color:var(--ink)!important;box-shadow:inset 0 0 0 1.5px var(--line)}
.fb-form label{display:grid;gap:6px;font-size:14px;color:var(--dim);font-weight:600}.fb-form input{font:inherit;font-size:16px;padding:13px 14px;border-radius:12px;border:1px solid var(--line);background:#0a0b0a;color:var(--ink)}.fb-form input:focus{outline:2px solid var(--gold);outline-offset:1px}
.fb-bar{height:12px;border-radius:99px;background:#000;overflow:hidden}.fb-bar i{display:block;height:100%;background:var(--gold);transition:width .3s}
.fb-pulse{width:14px;height:14px;border-radius:50%;background:var(--gold);animation:fbp 1.4s ease-in-out infinite}@keyframes fbp{50%{opacity:.25;transform:scale(.7)}}
.fb-demo{margin-top:20px;max-width:760px;padding:18px;border-radius:26px;background:linear-gradient(160deg,#141714,#0c0e0c);border:1px solid var(--line);display:grid;gap:14px}
.fb-scr{padding:26px;border-radius:16px;background:#000;text-align:center}.fb-scr small{color:var(--gold);font-weight:800;letter-spacing:.08em;text-transform:uppercase}.fb-scr p{margin:10px 0 0;font-family:var(--font-mona),serif;font-size:clamp(17px,2.2vw,24px);line-height:1.4;animation:fbin 1.2s .4s both}@keyframes fbin{from{opacity:0;transform:translateY(10px)}}
.fb-wave{display:flex;gap:4px;align-items:center;justify-content:center;height:34px}.fb-wave i{width:4px;height:100%;border-radius:4px;background:var(--gold);opacity:.75;animation:fbw 1.1s ease-in-out infinite}@keyframes fbw{0%,100%{transform:scaleY(.2)}50%{transform:scaleY(1)}}
.fb-said{text-align:center;color:var(--dim);font-style:italic;font-size:14.5px}
.fb-sec{max-width:1180px;margin:0 auto;padding:clamp(50px,7vw,90px) clamp(16px,5vw,64px)}.fb h2{margin:0 0 26px;font-family:var(--font-mona),system-ui,sans-serif;font-size:clamp(30px,4vw,48px);letter-spacing:-.025em}
.fb-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:14px}.fb-card{padding:22px;border-radius:20px;background:var(--card);border:1px solid var(--line);transition:transform .25s,border-color .25s}.fb-card:hover{transform:translateY(-4px);border-color:rgba(143,227,106,.5)}
.fb-ic{display:grid;place-items:center;width:46px;height:46px;border-radius:14px;background:rgba(143,227,106,.12);color:var(--gold);margin-bottom:14px}.fb-card h3{margin:0 0 6px;font-size:18px}.fb-card p{margin:0;color:#c9c6bf;line-height:1.5;font-size:15px}
.fb-steps ol{list-style:none;margin:0 0 18px;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:14px;counter-reset:s}.fb-steps li{counter-increment:s;padding:22px;border-radius:20px;border:1px solid var(--line);display:grid;gap:6px}
.fb-steps li::before{content:counter(s);display:grid;place-items:center;width:36px;height:36px;border-radius:50%;background:var(--gold);color:#0e1a0b;font-weight:800}.fb-steps li span{color:#c9c6bf;line-height:1.5}.fb-steps .fb-btn{margin-top:14px}
.fb-foot{max-width:1180px;margin:0 auto;padding:30px clamp(16px,5vw,64px) 60px;border-top:1px solid var(--line);font-size:14px;color:#c9c6bf}
@media (prefers-reduced-motion:reduce){.fb *{animation:none!important;transition:none!important}}`
