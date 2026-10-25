'use client'
// olexweb.com/aoc: the Anatomy of Creation landing page (approved preview) and its access.
// Rules: everything is visible by default (the fade-up only runs once JavaScript is confirmed, with a 2.5 s safety net);
// the access card never fades; animations use transform/opacity only; the player draws only while playing.
import { useEffect, useRef, useState } from 'react'

const KEY = 'aoc-listener'
const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
const mins = (s) => Math.max(1, Math.round((s || 0) / 60))
const fileName = (title, file) => String(title || 'download').replace(/[–—]/g, '-').replace(/[^\w\- ]+/g, '').replace(/\s+/g, ' ').trim() + ((String(file).match(/\.[a-z0-9]{2,4}$/i) || [''])[0])
async function api(body) {
  const r = await fetch('/api/aoc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Something went wrong. Try again.'); return j
}
const playing = { el: null }
// the slots message for each stage (the count itself is never shown here)
const SLOTS = {
  open: (g) => ({ strong: `Only ${g} slots.`, rest: 'Get in before it closes.' }),
  few: () => ({ strong: 'Join fast.', rest: 'Few spaces left.' }),
  bonus: () => ({ strong: 'Bonus spots opened.', rest: 'Join while it’s open.' }),
  closed: () => ({ strong: 'Sign-ups are closed for now.', rest: 'Message Olaitan to hear about the next one.' }),
}                                            // one recording plays at a time
const Mark = () => <span className="mk" aria-hidden="true"><span><b style={{ height: '40%' }} /><b style={{ height: '100%' }} /><b style={{ height: '65%' }} /><b style={{ height: '85%' }} /></span></span>

function Player({ src, title, wave, onEvent }) {
  const au = useRef(null), cv = useRef(null), raf = useRef(0)
  const [on, setOn] = useState(false), [t, setT] = useState(0), [d, setD] = useState(wave ? wave.seconds : 0), [rate, setRate] = useState(1)
  const peaks = (wave && wave.peaks) || Array.from({ length: 64 }, (_, i) => 0.35 + 0.25 * Math.abs(Math.sin(i * 1.7)))
  function draw() {
    const c = cv.current, a = au.current; if (!c || !a) return
    const w = c.clientWidth, h = c.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1); if (!w) return
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr) }
    const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h)
    const n = peaks.length, gap = w / n, len = a.duration || d, p = len ? a.currentTime / len : 0, now = performance.now()
    for (let i = 0; i < n; i++) {
      const live = !a.paused && Math.abs(i / n - p) < 1.5 / n, v = peaks[i] * (live ? 1 + 0.18 * Math.sin(now / 90) : 1), bh = Math.max(3, v * h * 0.92)
      x.fillStyle = i / n < p || live ? '#6CBF3C' : 'rgba(18,21,16,.16)'
      x.beginPath(); if (x.roundRect) x.roundRect(i * gap + gap * 0.18, (h - bh) / 2, gap * 0.64, bh, 3); else x.rect(i * gap + gap * 0.18, (h - bh) / 2, gap * 0.64, bh); x.fill()
    }
  }
  function loop() { draw(); if (au.current && !au.current.paused) raf.current = requestAnimationFrame(loop) }
  useEffect(() => { draw(); const r = () => draw(); window.addEventListener('resize', r); return () => { window.removeEventListener('resize', r); cancelAnimationFrame(raf.current) } }, [])
  function toggle() {
    const a = au.current; if (!a) return
    if (!a.paused) return a.pause()
    if (playing.el && playing.el !== a) playing.el.pause(); playing.el = a
    a.play().then(() => { if ('mediaSession' in navigator) { try { navigator.mediaSession.metadata = new window.MediaMetadata({ title, artist: 'Olaitan Adebayo', album: 'Anatomy of Creation', artwork: [{ src: '/aoc/og.jpg', sizes: '1200x630', type: 'image/jpeg' }] }) } catch {} } }).catch(() => {})
  }
  function seek(clientX) { const a = au.current, r = cv.current.getBoundingClientRect(), len = a.duration || d; if (!len) return; a.currentTime = Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * len; setT(a.currentTime); draw() }
  function key(e) { const a = au.current, len = a.duration || d; if (e.key === 'ArrowRight') a.currentTime = Math.min(len, a.currentTime + 10); else if (e.key === 'ArrowLeft') a.currentTime = Math.max(0, a.currentTime - 10); else return; e.preventDefault(); setT(a.currentTime); draw() }
  return (<div className="player">
    <audio ref={au} src={src} preload="none" onPlay={() => { setOn(true); cancelAnimationFrame(raf.current); loop(); onEvent('play') }} onPause={() => { setOn(false); draw() }}
      onEnded={() => { setOn(false); onEvent('finish') }} onLoadedMetadata={(e) => setD(e.currentTarget.duration)} onTimeUpdate={(e) => setT(e.currentTarget.currentTime)} />
    <div className="prow">
      <button type="button" className="pbtn" onClick={toggle} aria-label={(on ? 'Pause ' : 'Play ') + title}>{on ? <svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg> : <svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z" /></svg>}</button>
      <canvas ref={cv} className="wave" role="slider" tabIndex={0} aria-label={'Position in ' + title} aria-valuemin={0} aria-valuemax={Math.round(d)} aria-valuenow={Math.round(t)} aria-valuetext={`${fmt(t)} of ${fmt(d)}`}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); seek(e.clientX) }} onPointerMove={(e) => { if (e.buttons) seek(e.clientX) }} onKeyDown={key} />
    </div>
    <div className="ptime"><span>{fmt(t)}</span><button type="button" className="speed" onClick={() => { const n = { 1: 1.25, 1.25: 1.5, 1.5: 2, 2: 1 }[rate]; setRate(n); au.current.playbackRate = n }} aria-label="Playback speed">{rate}×</button><span>{fmt(d)}</span></div>
  </div>)
}

export default function AocCourse({ data }) {
  const c = data.content, root = useRef(null)
  const [me, setMe] = useState(null), [ready, setReady] = useState(false)
  const [name, setName] = useState(''), [tick, setTick] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState('')
  const [fb, setFb] = useState(''), [sent, setSent] = useState(false), [fbErr, setFbErr] = useState(''), [partsOpen, setPartsOpen] = useState(false)
  const total = c.full && c.full.wave ? mins(c.full.wave.seconds) : 37
  const stage = data.stage || 'open', slot = (SLOTS[stage] || SLOTS.open)(data.goal), closed = stage === 'closed'

  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.token) setMe(s) } catch {}
    setReady(true)
    const el = root.current, items = [...el.querySelectorAll('.rv')]
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return
    const below = items.filter((x) => x.getBoundingClientRect().top > window.innerHeight * 0.92)   // only what isn't on screen yet fades up
    below.forEach((x) => x.classList.add('rv-wait'))
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.remove('rv-wait'); io.unobserve(e.target) } }), { rootMargin: '0px 0px -8% 0px' })
    below.forEach((x) => io.observe(x))
    const safety = setTimeout(() => below.forEach((x) => x.classList.remove('rv-wait')), 2500)   // never leave anything hidden
    return () => { io.disconnect(); clearTimeout(safety) }
  }, [])

  async function enter(e) {
    e.preventDefault(); setErr(''); setBusy(true)
    try { const j = await api({ action: 'join', name, consent: tick }); const s = { token: j.token, name: j.name }; try { localStorage.setItem(KEY, JSON.stringify(s)) } catch {} setMe(s)
      requestAnimationFrame(() => requestAnimationFrame(() => { const a = document.querySelector('#access .acard'); if (a && a.getBoundingClientRect().top < 0) a.scrollIntoView({ behavior: 'smooth', block: 'start' }) })) }   // scroll only if the card's top is off screen
    catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  const track = (part, event) => { if (me) api({ action: 'track', token: me.token, part, event }).catch(() => {}) }
  async function send(e) { e.preventDefault(); setFbErr(''); try { await api({ action: 'feedback', token: me.token, text: fb }); setSent(true) } catch (x) { setFbErr(x.message) } }
  const first = me ? me.name.split(' ')[0] : ''

  const accessCard = !ready ? <div className="card acard" aria-busy="true"><span className="eyebrow"><i />Your slot</span><h3>Get the audio now</h3><div className="skel" /></div>
    : me ? (<div className="card acard" aria-label="Your course">
      <span className="eyebrow"><i />Your course</span>
      <h3>Welcome, <em>{first}.</em></h3>
      {c.full ? <>
        <a className="btn g wide" href={c.full.file} download={fileName('Anatomy of Creation - ' + c.full.title, c.full.file)} onClick={() => track('full', 'download')}>⬇ Download the full course</a>
        <p className="small">{c.full.note}</p>
        <Player src={c.full.file} title="Anatomy of Creation · Full course" wave={c.full.wave} onEvent={(ev) => track('full', ev)} />
      </> : null}
      <details className="more" onToggle={(e) => setPartsOpen(e.currentTarget.open)}><summary>Or part by part</summary>
        {partsOpen && c.parts.map((p) => <div key={p.key} className="part">
          <b className="ptitle">{p.title}{p.wave ? <span> · {mins(p.wave.seconds)} min</span> : null}</b>
          {p.covers ? <div className="covers">{p.covers.split('\n').map((l) => <span key={l}>{l.replace(/^\d+\s·\s/, '')}</span>)}</div> : null}
          <Player src={p.file} title={'Anatomy of Creation · ' + p.title} wave={p.wave} onEvent={(ev) => track(p.key, ev)} />
          <a className="mini" href={p.file} download={fileName('Anatomy of Creation - ' + p.title, p.file)} onClick={() => track(p.key, 'download')}>⬇ Download {p.title}</a>
        </div>)}
      </details>
      <details className="more"><summary>Keep it on your phone</summary><p className="small left">The download goes to your phone’s <b>Downloads</b> and plays offline in any music or files app. To come back here in one tap: in Chrome, open the ⋮ menu and choose <b>Add to Home screen</b>; on iPhone, tap Share, then <b>Add to Home Screen</b>.</p></details>
      <form className="fb" onSubmit={send} aria-label="What I learned">
        <b>After listening: what did you learn?</b>
        {sent ? <p className="small left ok">Thank you, {first}. Olaitan reads every one.</p> : <>
          <textarea value={fb} onChange={(e) => setFb(e.target.value)} rows={3} maxLength={3000} placeholder="The ideas that stayed with me…" />
          {fbErr ? <p role="alert" className="err">{fbErr}</p> : null}
          <button type="submit" className="btn">Send</button></>}
      </form>
    </div>) : closed ? (<div className="card acard">
      <span className="eyebrow"><i />Sign-ups</span><h3>Sign-ups are closed for now.</h3>
      <p className="small left">Message Olaitan to hear first about the next free resource.</p>
      <a className="btn g wide" href="/me">Message Olaitan on WhatsApp</a>
    </div>) : (<form className="card acard" onSubmit={enter} aria-label="Get free access">
      <span className="eyebrow"><i />Your slot</span><h3>Get the audio now</h3>
      <label className="f">Your name<input type="text" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={60} autoComplete="name" placeholder="e.g. Ada Okafor" /></label>
      <label className="tick"><input type="checkbox" checked={tick} onChange={(e) => setTick(e.target.checked)} required /><span className="b" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3 8.5l3.2 3L13 4.5" /></svg></span>After listening, I’ll share what I learned.</label>
      {err ? <p role="alert" className="err">{err}</p> : null}
      {stage !== 'open' ? <p className={'urgent ' + stage}>{slot.strong} {slot.rest}</p> : null}
      <button type="submit" className="btn g wide" disabled={busy}>{busy ? 'Opening…' : 'Get access'}</button>
    </form>)

  return (<div className="aoc" ref={root} id="top">
    <style>{CSS}</style>
    <header className="nav"><div className="wrap">
      <a className="brand" href="#top"><Mark />Anatomy of Creation</a>
      <nav className="links" aria-label="On this page"><a href="#get">What you’ll get</a><a href="#for">Who it’s for</a><a href="#about">About</a><a href="/">Main website ↗</a></nav>
      <a className="btn" href="#access">{me ? 'Your course' : closed ? 'Next one' : 'Get access'}</a>
    </div></header>

    <main>
      <section className="hero"><div className="wrap">
        <h1 className="sr">{c.title}: {c.tagline} {c.taglineBold}</h1>
        <div className="herogrid">
          <picture className="card-img">
            <source media="(min-width: 700px)" srcSet="/aoc/card-1600.webp" />
            <img src="/aoc/card-900.webp" width="1600" height="840" alt="Anatomy of Creation, a free audio in 4 short parts by Olaitan Adebayo, creative ideator. 100% free, full access, no payment." fetchPriority="high" />
          </picture>
          <div className="hero-text">
            <p className="lead">{c.tagline} <b>{c.taglineBold}</b></p>
            <p className="sub2"><b>{c.title}</b> is a free audio in {c.parts.length} short parts that answers that question, and shows you how to step into creation yourself.</p>
            <div className="proof"><span>🎧 100% free · no payment</span><span>⏱ {total} minutes</span><span>📱 Listen on your phone</span></div>
          </div>
          <div className="cta-box">
            <p className="ctah">{me ? 'Your course is ready.' : closed ? 'Sign-ups are paused.' : 'Free access, today.'}</p>
            <a className="btn g wide0" href="#access">{me ? 'Go to your course' : closed ? 'Hear about the next one' : 'Get free access'}</a>
            <p className={'slots ' + stage}><b>{slot.strong}</b> {slot.rest}</p>
            <a className="ghost" href="#get">What you’ll get ↓</a>
          </div>
        </div>
      </div></section>

      <section className="q"><div className="wrap rv">
        <p className="disp">Look around <em>you.</em></p>
        <p className="after">Everything you see was made by someone. Someone <b>noticed, thought, built,</b> and put it into the world.</p>
        <p className="after">So why do some create, while others only watch? <b>{c.title}</b> answers that, and shows you how to step into creation yourself.</p>
      </div></section>

      <section className="s"><div className="wrap rv">
        <span className="eyebrow"><i />The audio</span><h2 className="disp">Four short parts. One shift.</h2>
        <p className="intro">Listen in order, on your phone, wherever you are. Download it once and keep it.</p>
        <div className="parts">{c.parts.map((p) => <div key={p.key}><b>{p.title}</b><span>{p.wave ? mins(p.wave.seconds) + ' min' : ''}</span></div>)}</div>
      </div></section>

      <section className="s" id="get" style={{ paddingTop: 0 }}><div className="wrap">
        <div className="rv"><span className="eyebrow"><i />What you’ll get</span><h2 className="disp">What you’ll walk away with</h2></div>
        <ul className="gets">{(c.learn || []).map((t, i) => <li key={t} className="rv"><span className="n">{String(i).padStart(2, '0')}</span><h3>{t}</h3></li>)}</ul>
      </div></section>

      <section className="s for" id="for"><div className="wrap rv">
        <span className="eyebrow"><i />Who it’s for</span>
        <p className="disp">Whatever your field, if you want to make something with your name on it, this is for you.</p>
        <div className="chips">{['Writers', 'Designers', 'Developers', 'Founders', 'Students', 'Artists', 'Teachers', 'Anyone with an idea'].map((x) => <span key={x}>{x}</span>)}</div>
      </div></section>

      <section className="s access" id="access"><div className="wrap">
        <div><span className="eyebrow"><i />Get access</span><h2 className="disp">Free. On your phone.</h2>
          <div className="facts"><div><span className="e">🎧</span>100% free. No payment. Listen on your phone.</div><div className={'stage ' + stage}><span className="e">⏳</span><span><b>{slot.strong}</b> {slot.rest}</span></div><div><span className="e">⬇</span>Download once, listen offline.</div></div></div>
        {accessCard}
      </div></section>

      <section className="s about" id="about" style={{ paddingTop: 0 }}><div className="wrap rv">
        <div className="av"><img src="/aoc/avatar.webp" alt="" width="360" height="360" loading="lazy" /></div>
        <div><span className="eyebrow"><i />From Olaitan</span><h2 className="disp">Hi, I’m Olaitan Adebayo.</h2>
          <p>A creative ideator, builder and web developer. I read widely, think slowly and ship quickly. I made this audio for anyone who’s tired of only watching, and ready to make something real.</p></div>
      </div></section>

      <section className="final"><div className="wrap rv"><p className="disp">Stop only watching. <em>Start creating.</em></p>{!me && !closed && stage !== 'open' ? <p className="fstage">{slot.strong} {slot.rest}</p> : null}<a className="btn g" href="#access">{me ? 'Go to your course' : closed ? 'Hear about the next one' : 'Get free access'}</a></div></section>
    </main>

    <footer className="foot"><div className="wrap">
      <div><a className="brand" href="#top"><Mark />Anatomy of Creation</a><p>A free audio in {c.parts.length} short parts by Olaitan Adebayo.</p></div>
      <div className="lk"><a href="#access">Get access</a><a href="#get">What you’ll get</a><a href="#about">About Olaitan</a></div>
      <div className="lk"><a href="/">Visit olexweb.com ↗</a><a href="/privacy">Privacy</a></div>
      <small>© {new Date().getFullYear()} Olaitan Adebayo</small>
    </div></footer>
  </div>)
}

const CSS = `
html{scroll-behavior:smooth}html,body{background:#F1F3EE!important;color-scheme:light}
.aoc{--bg:#F1F3EE;--card:#fff;--ink:#121510;--dim:#5A6154;--line:rgba(18,21,16,.10);--green:#6CBF3C;--deep:#2F6B16;--soft:#E3EFD9;background:var(--bg);color:var(--ink);font-family:var(--font-mona),system-ui,sans-serif;line-height:1.5;overflow-x:clip}
.aoc *{box-sizing:border-box}.aoc p{margin:0}.aoc a{color:inherit}.aoc h1,.aoc h2,.aoc h3{margin:0}
.aoc .wrap{max-width:1120px;margin:0 auto;padding:0 clamp(18px,4vw,32px)}
.aoc .disp{font-family:var(--font-hubot),system-ui,sans-serif;font-stretch:78%;font-weight:900;letter-spacing:-.015em;line-height:.95}
.aoc .eyebrow{display:inline-flex;align-items:center;gap:10px;font-weight:800;font-size:12.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--deep)}.aoc .eyebrow i{width:8px;height:8px;border-radius:50%;background:var(--green)}
.aoc .btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;padding:17px 26px;border-radius:999px;background:var(--ink);color:#fff;font:800 16px var(--font-mona),system-ui;text-decoration:none;border:0;cursor:pointer;transition:transform .2s,box-shadow .2s}
.aoc .btn:hover{transform:translateY(-2px);box-shadow:0 14px 30px -16px rgba(18,21,16,.6)}.aoc .btn:active{transform:translateY(0) scale(.98)}.aoc .btn.g{background:var(--green);color:var(--ink)}.aoc .btn.wide{width:100%;margin-top:20px;padding:19px}.aoc .btn:disabled{opacity:.7}
.aoc a:focus-visible,.aoc button:focus-visible,.aoc summary:focus-visible,.aoc input:focus-visible,.aoc textarea:focus-visible{outline:3px solid var(--deep);outline-offset:3px}
/* header */
.aoc .nav{position:sticky;top:0;z-index:10;background:rgba(241,243,238,.9);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid var(--line);padding-top:env(safe-area-inset-top,0px)}
.aoc .nav .wrap{display:flex;align-items:center;gap:22px;height:68px}.aoc .brand{display:flex;align-items:center;gap:10px;font-weight:800;text-decoration:none}
.aoc .mk{flex:none;width:30px;height:30px;border-radius:9px;background:var(--ink);display:grid;place-items:center}.aoc .mk>span{display:flex;gap:2px;align-items:center;height:12px}.aoc .mk b{width:2.5px;background:var(--green);border-radius:2px}
.aoc .links{display:flex;gap:22px;margin-left:auto;font-weight:700;font-size:15px;color:var(--dim)}.aoc .links a{text-decoration:none}.aoc .links a:hover{color:var(--ink)}
.aoc .nav .btn{padding:11px 18px;font-size:14px;white-space:nowrap}.aoc .brand{white-space:nowrap}@media(max-width:860px){.aoc .links{display:none}.aoc .nav .btn{margin-left:auto}}
@media(max-width:420px){.aoc .nav .wrap{gap:12px}.aoc .brand{font-size:15px;gap:8px}.aoc .mk{width:26px;height:26px}.aoc .nav .btn{padding:10px 14px;font-size:13.5px}}
/* hero: the landing card, then the opening */
.aoc .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.aoc .hero{padding:clamp(16px,3vw,28px) 0 clamp(36px,6vw,64px)}
.aoc .card-img{display:block}.aoc .card-img img{display:block;width:100%;height:auto;border-radius:clamp(18px,2.6vw,30px);border:1px solid rgba(255,255,255,.9);box-shadow:0 30px 60px -38px rgba(18,21,16,.5);background:#e9efe3}
.aoc .herogrid{display:grid;gap:clamp(20px,3vw,28px);grid-template-areas:"card" "text" "cta"}
.aoc .card-img{grid-area:card}.aoc .hero-text{grid-area:text}.aoc .cta-box{grid-area:cta}
@media(min-width:900px){.aoc .herogrid{grid-template-columns:minmax(0,1.6fr) minmax(280px,.72fr);grid-template-areas:"card cta" "text text";align-items:center;column-gap:28px}.aoc .hero-text{display:grid;grid-template-columns:1.1fr .9fr;gap:8px 40px;align-items:end}.aoc .hero-text .proof{grid-column:1/-1}.aoc .hero-text .sub2{margin:0}}
.aoc .ctah{font-family:var(--font-hubot),system-ui;font-stretch:78%;font-weight:900;font-size:clamp(26px,2.6vw,32px);line-height:1;text-align:center}
.aoc .lead{font-family:var(--font-hubot),system-ui;font-stretch:78%;font-weight:900;font-size:clamp(32px,5vw,52px);line-height:1;letter-spacing:-.01em}.aoc .lead b{color:var(--green);font-weight:900}
.aoc .sub2{font-size:clamp(16px,1.9vw,19px);color:var(--dim);max-width:52ch;margin:14px 0 0}.aoc .sub2 b{color:var(--ink)}
.aoc .proof{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}.aoc .proof span{padding:9px 14px;border-radius:999px;background:#fff;border:1px solid var(--line);font-weight:700;font-size:14.5px}
.aoc .cta-box{display:grid;gap:12px;padding:clamp(18px,3vw,24px);border-radius:24px;background:#fff;border:1px solid var(--line);box-shadow:0 24px 50px -36px rgba(18,21,16,.45)}
.aoc .wide0{width:100%;padding:18px}.aoc .ghost{justify-self:center;font-weight:800;text-decoration:none;color:var(--deep);padding:4px 6px}
.aoc .slots{text-align:center;font-size:15.5px;color:var(--dim)}.aoc .slots b{color:var(--ink)}
.aoc .slots.few b,.aoc .slots.bonus b{color:#B54708}.aoc .urgent{margin-top:16px;padding:12px 14px;border-radius:14px;background:#FFF4E5;color:#7A3E00;font-weight:700;font-size:15px}
.aoc .facts .stage.few,.aoc .facts .stage.bonus{background:#FFF8EE;border-color:#F7D9AE}.aoc .fstage{margin-top:18px;color:#FFD08A;font-weight:700;font-size:17px}
/* story */
.aoc .q{background:var(--ink);color:#fff;padding:clamp(56px,9vw,110px) 0}.aoc .q p.disp{font-size:clamp(40px,7vw,84px);max-width:16ch}.aoc .q em{font-style:normal;color:var(--green)}
.aoc .q .after{margin-top:22px;max-width:46ch;font-size:clamp(17px,2.2vw,20px);color:rgba(255,255,255,.78)}.aoc .q .after b{color:#fff}
.aoc section.s{padding:clamp(56px,8vw,96px) 0}.aoc .s h2{font-size:clamp(40px,6vw,64px);margin:14px 0 0}.aoc .s .intro{font-size:18px;color:var(--dim);max-width:52ch;margin:14px 0 0}
.aoc .parts{display:grid;gap:12px;margin-top:30px;grid-template-columns:repeat(2,1fr)}@media(min-width:760px){.aoc .parts{grid-template-columns:repeat(4,1fr)}}
.aoc .parts div{padding:18px;border-radius:20px;background:var(--card);border:1px solid var(--line)}.aoc .parts b{display:block;font-family:var(--font-hubot),system-ui;font-stretch:78%;font-weight:900;font-size:30px}.aoc .parts span{font-size:14px;color:var(--dim)}
.aoc .gets{list-style:none;margin:34px 0 0;padding:0;display:grid;gap:14px}
.aoc .gets li{display:grid;grid-template-columns:auto 1fr;gap:18px;align-items:start;padding:22px;border-radius:22px;background:var(--card);border:1px solid var(--line)}
.aoc .gets .n{font-family:var(--font-mona),system-ui;font-stretch:80%;font-weight:900;font-size:34px;line-height:1;color:var(--green);min-width:44px}.aoc .gets h3{margin-top:2px;font-size:clamp(18px,2.3vw,21px);line-height:1.3}
.aoc .for{background:var(--soft)}.aoc .for p.disp{font-size:clamp(34px,5.4vw,58px);max-width:20ch;margin:14px 0 0}.aoc .chips{display:flex;flex-wrap:wrap;gap:10px;margin-top:26px}.aoc .chips span{padding:10px 16px;border-radius:999px;background:#fff;font-weight:700;font-size:15px}
/* access */
.aoc .access .wrap{display:grid;gap:26px}@media(min-width:900px){.aoc .access .wrap{grid-template-columns:.9fr 1.1fr;align-items:start}}
.aoc #access{scroll-margin-top:72px}
.aoc .facts{display:grid;gap:14px;margin-top:22px}.aoc .facts div{display:flex;gap:14px;align-items:center;padding:16px 18px;border-radius:18px;background:var(--card);border:1px solid var(--line);font-size:17px;font-weight:600}.aoc .facts .e{font-size:26px}
.aoc .card{padding:clamp(22px,4vw,34px);border-radius:28px;background:var(--card);border:1px solid var(--line);box-shadow:0 30px 60px -40px rgba(18,21,16,.4)}
.aoc .acard h3{font-family:var(--font-hubot),system-ui;font-stretch:78%;font-weight:900;font-size:clamp(34px,5vw,46px);margin:8px 0 0;line-height:1}.aoc .acard h3 em{font-style:normal;color:var(--green)}
.aoc .skel{height:200px;margin-top:20px;border-radius:16px;background:#F3F5F0}
.aoc label.f{display:grid;gap:8px;margin-top:20px;font-weight:700}
.aoc input[type=text],.aoc textarea{width:100%;padding:16px;border-radius:16px;border:1px solid var(--line);background:#F8F9F6;font:inherit;font-size:16px;color:var(--ink)}.aoc input[type=text]:focus,.aoc textarea:focus{outline:0;border-color:var(--green);box-shadow:0 0 0 4px rgba(108,191,60,.2)}
.aoc .tick{position:relative;display:flex;gap:12px;align-items:flex-start;margin-top:16px;font-size:16px;line-height:1.45;cursor:pointer}
.aoc .tick input{position:absolute;left:0;top:0;width:24px;height:24px;margin:0;opacity:0}.aoc .tick .b{flex:none;width:24px;height:24px;border-radius:7px;border:2px solid rgba(18,21,16,.3);margin-top:1px;display:grid;place-items:center;background:#fff;transition:background .2s,border-color .2s}
.aoc .tick .b svg{width:16px;height:16px}.aoc .tick .b path{fill:none;stroke:#fff;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:24;stroke-dashoffset:24;transition:stroke-dashoffset .3s}
.aoc .tick input:checked+.b{background:var(--green);border-color:var(--green)}.aoc .tick input:checked+.b path{stroke-dashoffset:0}.aoc .tick input:focus-visible+.b{outline:3px solid var(--deep);outline-offset:2px}
.aoc .err{margin-top:12px;color:#B42318;font-weight:700}.aoc .small{margin-top:8px;text-align:center;font-size:14px;color:var(--dim);line-height:1.6}.aoc .small.left{text-align:left;font-size:15.5px}.aoc .small.ok{color:var(--deep);font-weight:700}
.aoc .player{display:grid;gap:10px;margin-top:16px;padding:14px;border-radius:20px;background:#F6F8F3;border:1px solid var(--line)}
.aoc .prow{display:flex;align-items:center;gap:14px}.aoc .pbtn{flex:none;width:50px;height:50px;border-radius:50%;border:0;background:var(--ink);display:grid;place-items:center;cursor:pointer}.aoc .pbtn:active{transform:scale(.94)}.aoc .pbtn svg{width:19px;height:19px;fill:#fff}
.aoc .wave{flex:1;min-width:0;width:100%;height:50px;cursor:pointer;touch-action:none}
.aoc .ptime{display:flex;justify-content:space-between;align-items:center;font-size:13px;color:var(--dim);font-variant-numeric:tabular-nums}.aoc .speed{border:1px solid var(--line);background:#fff;border-radius:99px;padding:4px 10px;font:700 12px var(--font-mona),system-ui;cursor:pointer;color:var(--ink)}
.aoc .more{margin-top:16px;border-top:1px solid var(--line);padding-top:14px}.aoc .more summary{cursor:pointer;font-weight:800;font-size:16px}
.aoc .part{display:grid;gap:8px;padding-top:16px;margin-top:14px;border-top:1px solid var(--line)}.aoc .part:first-of-type{border-top:0;margin-top:4px}
.aoc .ptitle{font-size:18px}.aoc .ptitle span{font-weight:600;color:var(--dim);font-size:15px}.aoc .covers{display:grid;gap:2px;font-size:15px;color:var(--dim)}
.aoc .mini{justify-self:start;margin-top:4px;padding:10px 16px;border-radius:999px;border:1px solid var(--line);background:#fff;font-weight:800;font-size:14px;text-decoration:none}
.aoc .fb{display:grid;gap:10px;margin-top:18px;padding-top:16px;border-top:1px solid var(--line)}.aoc .fb .btn{justify-self:start;padding:12px 22px;font-size:15px}
/* about, final, footer */
.aoc .about .wrap{display:grid;gap:26px;align-items:center}@media(min-width:900px){.aoc .about .wrap{grid-template-columns:auto 1fr}}
.aoc .av{width:150px;height:150px;border-radius:50%;overflow:hidden;background:#dfeed4;position:relative}.aoc .av img{position:absolute;width:150%;height:auto;left:-25%;top:-6%}
.aoc .about h2{font-size:clamp(34px,5vw,52px)}.aoc .about p{font-size:18px;max-width:56ch;color:#2b3027;margin:12px 0 0}
.aoc .final{text-align:center;padding:clamp(60px,9vw,110px) 0;background:var(--ink);color:#fff}.aoc .final p.disp{font-size:clamp(40px,7vw,80px);margin:0 auto;max-width:14ch}.aoc .final em{font-style:normal;color:var(--green)}.aoc .final .btn{margin-top:30px}
.aoc .foot{padding:44px 0 calc(env(safe-area-inset-bottom,0px) + 34px)}.aoc .foot .wrap{display:grid;gap:22px}@media(min-width:760px){.aoc .foot .wrap{grid-template-columns:1.4fr 1fr 1fr;align-items:start}}
.aoc .foot p{color:var(--dim);margin-top:10px;max-width:36ch}.aoc .foot .lk a{display:block;padding:5px 0;text-decoration:none;color:var(--dim);font-weight:600}.aoc .foot .lk a:hover{color:var(--ink)}.aoc .foot small{grid-column:1/-1;padding-top:20px;border-top:1px solid var(--line);color:var(--dim)}
/* light motion: only for what starts below the screen, only once JavaScript is running */
.aoc .rv{transition:opacity .6s ease,transform .6s cubic-bezier(.2,.8,.2,1)}.aoc .rv.rv-wait{opacity:0;transform:translateY(24px)}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.aoc .rv{transition:none}.aoc .rv.rv-wait{opacity:1;transform:none}.aoc .btn{transition:none}}
`
