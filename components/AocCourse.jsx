'use client'
// olexweb.com/aoc: the Anatomy of Creation landing page (styled after the flyer, motion as approved in the preview).
// Performance rules: animations move with transform/opacity only; no blur filters on anything that moves or scrolls
// (only the header is frosted); pointer and tilt tracking at most once per frame; the player draws only while playing.
import { useEffect, useRef, useState } from 'react'

const KEY = 'aoc-listener'
const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
const fileName = (title, file) => String(title || 'download').replace(/[–—]/g, '-').replace(/[^\w\- ]+/g, '').replace(/\s+/g, ' ').trim() + ((String(file).match(/\.[a-z0-9]{2,4}$/i) || [''])[0])
async function api(body) {
  const r = await fetch('/api/aoc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Something went wrong. Try again.'); return j
}
const playing = { el: null }                                            // one recording plays at a time

function Player({ src, title, wave, onEvent }) {
  const au = useRef(null), cv = useRef(null), raf = useRef(0)
  const [on, setOn] = useState(false), [t, setT] = useState(0), [d, setD] = useState(wave ? wave.seconds : 0), [rate, setRate] = useState(1)
  const peaks = (wave && wave.peaks) || Array.from({ length: 64 }, (_, i) => 0.35 + 0.25 * Math.abs(Math.sin(i * 1.7)))
  function draw() {
    const c = cv.current, a = au.current; if (!c || !a) return
    const w = c.clientWidth, h = c.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1)
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr) }
    const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h)
    const n = peaks.length, gap = w / n, p = (a.duration || d) ? a.currentTime / (a.duration || d) : 0, now = performance.now()
    for (let i = 0; i < n; i++) {
      const played = i / n < p, live = !a.paused && Math.abs(i / n - p) < 1.5 / n
      const v = peaks[i] * (live ? 1 + 0.18 * Math.sin(now / 90) : 1), bh = Math.max(3, v * h * 0.92)
      x.fillStyle = played || live ? '#76C442' : 'rgba(17,20,16,.16)'
      x.beginPath(); (x.roundRect ? x.roundRect(i * gap + gap * 0.18, (h - bh) / 2, gap * 0.64, bh, 3) : x.rect(i * gap + gap * 0.18, (h - bh) / 2, gap * 0.64, bh)); x.fill()
    }
  }
  function loop() { draw(); if (au.current && !au.current.paused) raf.current = requestAnimationFrame(loop) }
  useEffect(() => { draw(); const r = () => draw(); window.addEventListener('resize', r); return () => { window.removeEventListener('resize', r); cancelAnimationFrame(raf.current) } }, [])
  function toggle() {
    const a = au.current; if (!a) return
    if (a.paused) {
      if (playing.el && playing.el !== a) playing.el.pause(); playing.el = a
      a.play().then(() => {
        if ('mediaSession' in navigator) { try { navigator.mediaSession.metadata = new window.MediaMetadata({ title, artist: 'Olaitan Adebayo', album: 'Anatomy of Creation', artwork: [{ src: '/aoc/og.jpg', sizes: '1200x630', type: 'image/jpeg' }] }) } catch {} }
      }).catch(() => {})
    } else a.pause()
  }
  function seek(clientX) { const a = au.current, r = cv.current.getBoundingClientRect(), len = a.duration || d; if (!len) return; a.currentTime = Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * len; setT(a.currentTime); draw() }
  function key(e) { const a = au.current; if (e.key === 'ArrowRight') { a.currentTime = Math.min((a.duration || d), a.currentTime + 10); draw() } if (e.key === 'ArrowLeft') { a.currentTime = Math.max(0, a.currentTime - 10); draw() } }
  return (<div className="player">
    <audio ref={au} src={src} preload="none"
      onPlay={() => { setOn(true); cancelAnimationFrame(raf.current); loop(); onEvent('play') }} onPause={() => { setOn(false); draw() }}
      onEnded={() => { setOn(false); onEvent('finish') }} onLoadedMetadata={(e) => setD(e.currentTarget.duration)} onTimeUpdate={(e) => setT(e.currentTarget.currentTime)} />
    <div className="prow">
      <button className="pbtn" onClick={toggle} aria-label={(on ? 'Pause ' : 'Play ') + title}>{on ? <svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg> : <svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z" /></svg>}</button>
      <canvas ref={cv} className="wave" role="slider" tabIndex={0} aria-label={'Position in ' + title} aria-valuemin={0} aria-valuemax={Math.round(d)} aria-valuenow={Math.round(t)} aria-valuetext={`${fmt(t)} of ${fmt(d)}`}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); seek(e.clientX) }} onPointerMove={(e) => { if (e.buttons) seek(e.clientX) }} onKeyDown={key} />
    </div>
    <div className="ptime"><span>{fmt(t)}</span><button className="speed" onClick={() => { const n = { 1: 1.25, 1.25: 1.5, 1.5: 2, 2: 1 }[rate]; setRate(n); au.current.playbackRate = n }} aria-label="Playback speed">{rate}×</button><span>{fmt(d)}</span></div>
  </div>)
}

export default function AocCourse({ data }) {
  const c = data.content, root = useRef(null), tilt = useRef(null), card = useRef(null), go = useRef(null)
  const [me, setMe] = useState(null), [ready, setReady] = useState(false), [menu, setMenu] = useState(false)
  const [name, setName] = useState(''), [tick, setTick] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState('')
  const [fb, setFb] = useState(''), [sent, setSent] = useState(false), [fbErr, setFbErr] = useState(''), [partsOpen, setPartsOpen] = useState(false)

  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.token) setMe(s) } catch {}
    setReady(true)
    const el = root.current, start = () => el && el.classList.add('go')     // the opening waits for the fonts, so every letter is seen
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 120))
    const t = setTimeout(start, 1800); (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => idle(() => requestAnimationFrame(start), { timeout: 700 }))
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (!e.isIntersecting) return; e.target.classList.add('on'); io.unobserve(e.target)
      e.target.querySelectorAll('[data-count]').forEach((ch, i) => { const n = +ch.dataset.count; let k = 0; const iv = setInterval(() => { ch.textContent = String(Math.min(k, n)).padStart(2, '0'); if (k++ >= n) clearInterval(iv) }, 70 + i * 25) }) }), { threshold: 0.18 })
    el.querySelectorAll('.reveal').forEach((x) => io.observe(x))
    let frame = 0, px = 0, py = 0                                         // depth: at most one update per frame
    const apply = () => { frame = 0; if (tilt.current) tilt.current.style.transform = `translate3d(${px * -14}px,${py * -8}px,0)`; if (card.current) card.current.style.transform = `translate3d(${px * 16}px,${py * 9}px,0)` }
    const queue = () => { if (!frame) frame = requestAnimationFrame(apply) }
    const pm = (e) => { if (e.pointerType !== 'mouse') return; px = e.clientX / innerWidth - 0.5; py = e.clientY / innerHeight - 0.5; queue() }
    const tiltDev = (e) => { if (e.gamma == null) return; px = Math.max(-0.5, Math.min(0.5, e.gamma / 60)); py = Math.max(-0.5, Math.min(0.5, (e.beta - 45) / 60)); queue() }
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!calm) { addEventListener('pointermove', pm, { passive: true }); addEventListener('deviceorientation', tiltDev, { passive: true }) }
    return () => { clearTimeout(t); io.disconnect(); removeEventListener('pointermove', pm); removeEventListener('deviceorientation', tiltDev); cancelAnimationFrame(frame) }
  }, [])
  useEffect(() => { if (me) root.current && root.current.querySelectorAll('.reveal:not(.on)').forEach((x) => x.classList.add('on')) }, [me])

  function magnet(e) { if (e.pointerType !== 'mouse') return; const b = e.currentTarget, r = b.getBoundingClientRect(); b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.12}px,${(e.clientY - r.top - r.height / 2) * 0.25}px)` }
  function ripple(e) { const b = e.currentTarget, r = b.getBoundingClientRect(), s = document.createElement('span'), dd = Math.max(r.width, r.height); s.className = 'rip'; s.style.cssText = `width:${dd}px;height:${dd}px;left:${(e.clientX || r.left + r.width / 2) - r.left - dd / 2}px;top:${(e.clientY || r.top + r.height / 2) - r.top - dd / 2}px`; b.appendChild(s); setTimeout(() => s.remove(), 700) }
  async function enter(e) {
    e.preventDefault(); setErr(''); setBusy(true)
    try { const j = await api({ action: 'join', name, consent: tick }); const s = { token: j.token, name: j.name }; try { localStorage.setItem(KEY, JSON.stringify(s)) } catch {} setMe(s)
      setTimeout(() => document.getElementById('course')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80) }
    catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  const track = (part, event) => { if (me) api({ action: 'track', token: me.token, part, event }).catch(() => {}) }
  async function send(e) { e.preventDefault(); setFbErr(''); try { await api({ action: 'feedback', token: me.token, text: fb }); setSent(true) } catch (x) { setFbErr(x.message) } }
  const first = me ? me.name.split(' ')[0] : ''

  return (<div className="aoc" ref={root}>
    <style>{CSS}</style>
    <div className="blob b1" aria-hidden="true" /><div className="blob b2" aria-hidden="true" />

    <header className="nav">
      <a href="/" className="brand" aria-label="Olexweb home"><img src="/studio/mark.png" alt="" width="34" height="34" /><b>Olexweb</b></a>
      <nav className="links" aria-label="Page">
        <a href="#learn">What you’ll get</a><a href="#about">About</a><a href="/">View full website ↗</a>
      </nav>
      <a href="#access" className="navcta">Get access</a>
      <button className="burger" aria-expanded={menu} aria-controls="aoc-menu" aria-label={menu ? 'Close menu' : 'Open menu'} onClick={() => setMenu(!menu)}><i /><i /></button>
      <div id="aoc-menu" className={'sheet' + (menu ? ' open' : '')} onClick={() => setMenu(false)}>
        <a href="#learn">What you’ll get</a><a href="#about">About Olaitan</a><a href="#access">Get access</a><a href="/">View full website ↗</a>
      </div>
    </header>

    <main>
      <section className="hero" aria-label="Anatomy of Creation">
        <div className="hgrid" aria-hidden="true" /><div className="hglow" aria-hidden="true" />
        <img className="hp" src="/aoc/headphones.svg" alt="" width="300" height="260" />
        <div className="copy">
          <span className="pill"><span className="eq" aria-hidden="true"><i /><i /><i /><i /><i /></span>Free audio · {c.parts.length} short parts</span>
          <h1 aria-label={c.title}>
            <span className="w" aria-hidden="true">{'ANATOMY'.split('').map((ch, i) => <span key={i} className="ch" style={{ animationDelay: `${0.35 + i * 0.06}s` }}>{ch}</span>)}</span>
            <span className="w" aria-hidden="true"><span className="of"><svg viewBox="0 0 160 120"><text x="0" y="112" fontSize="140">OF</text></svg></span><span className="cr"><span className="crb">CREATION</span><span className="crg" aria-hidden="true"><span>CREATION</span></span></span></span>
          </h1>
          <p className="sub">{c.tagline} <b>{c.taglineBold}</b></p>
          <p className="play"><span aria-hidden="true">▶</span>{c.intro}</p>
          <div className="stats">
            <img className={'bulb' + (me ? ' lit' : '')} src="/aoc/bulb.svg" alt="" width="200" height="300" />
            <div className="free"><b>100% FREE</b><small>Full access</small></div><div className="sep" /><div><b>{data.goal} SLOTS</b><small>Only · then it closes</small></div>
          </div>
        </div>
        <div className="person"><div className="tilt" ref={tilt}><img src="/aoc/photo.webp" alt="Olaitan Adebayo" width="1220" height="995" fetchPriority="high" /></div></div>
        <div className="namecard" ref={card}><b>Olaitan Adebayo</b><span>CREATIVE IDEATOR</span></div>
      </section>

      <div className="cols">
        <div className="stack">
          {!ready ? <div className="card" style={{ minHeight: 300 }} /> : me ? (
            <section id="course" className="card reveal on" aria-label="Your course">
              <p className="lbl">Your course</p>
              <h2 className="big welcome">{('Welcome, ').split('').map((ch, i) => <span key={i} className="ch" style={{ animationDelay: `${i * 0.035}s` }}>{ch === ' ' ? '\u00a0' : ch}</span>)}<span className="g">{(first + '.').split('').map((ch, i) => <span key={i} className="ch" style={{ animationDelay: `${0.3 + i * 0.035}s` }}>{ch}</span>)}</span></h2>
              {c.full ? <>
                <a className="dl shine" href={c.full.file} download={fileName('Anatomy of Creation - ' + c.full.title, c.full.file)} onClick={(e) => { ripple(e); track('full', 'download') }}>⬇ Download the full course</a>
                <p className="note">{c.full.note}</p>
                <Player src={c.full.file} title="Anatomy of Creation · Full course" wave={c.full.wave} onEvent={(ev) => track('full', ev)} />
              </> : null}
              <details className="parts" onToggle={(e) => setPartsOpen(e.currentTarget.open)}><summary>Or part by part</summary>
                {partsOpen && c.parts.map((p) => <div key={p.key} className="part">
                  <b className="ptitle">{p.title}</b>
                  {p.covers ? <div className="covers">{p.covers.split('\n').map((l) => { const [n, ...rest] = l.split(' · '); return rest.length ? <span key={l}><i className="chip">{n}</i>{rest.join(' · ')}</span> : <span key={l}>{l}</span> })}</div> : null}
                  <Player src={p.file} title={'Anatomy of Creation · ' + p.title} wave={p.wave} onEvent={(ev) => track(p.key, ev)} />
                  <a className="mini" href={p.file} download={fileName('Anatomy of Creation - ' + p.title, p.file)} onClick={() => track(p.key, 'download')}>⬇ Download {p.title}</a>
                </div>)}
              </details>
              <details className="parts"><summary>Keep it on your phone</summary><p className="note left">The download goes to your phone’s <b>Downloads</b> and plays offline in any music or files app. To come back here in one tap: in Chrome, open the ⋮ menu and choose <b>Add to Home screen</b>; on iPhone, tap Share, then <b>Add to Home Screen</b>.</p></details>
            </section>
          ) : data.closed ? (
            <section id="access" className="card reveal" aria-label="Slots">
              <p className="lbl">Slots</p><h2 className="big">All {data.goal} slots have been taken.</h2>
              <p className="note left" style={{ fontSize: 17 }}>Message Olex to hear first about the next free resource.</p>
              <a className="cta" href="/me" onPointerMove={magnet} onPointerLeave={(e) => { e.currentTarget.style.transform = '' }}>Message Olex on WhatsApp</a>
            </section>
          ) : (
            <form id="access" className="card reveal" onSubmit={enter} aria-label="Get free access">
              <p className="lbl">Get free access</p>
              <h2 className="big"><span className="m">100%</span> <span className="g">free.</span> Full access.</h2>
              <label className="f">Your name<input type="text" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={60} autoComplete="name" placeholder="e.g. Ada Okafor" /></label>
              <label className="tick"><input type="checkbox" checked={tick} onChange={(e) => setTick(e.target.checked)} required /><span className="box" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3 8.5l3.2 3L13 4.5" /></svg></span>After listening, I’ll share what I learned.</label>
              {err ? <p role="alert" className="err">{err}</p> : null}
              <button type="submit" className="cta" disabled={busy} ref={go} onPointerMove={magnet} onPointerLeave={(e) => { e.currentTarget.style.transform = '' }} onClick={ripple}>{busy ? 'Opening…' : 'Get access now'}</button>
            </form>
          )}
          {me ? <form className="card reveal on" onSubmit={send} aria-label="What I learned">
            <p className="lbl">After listening</p><h2 className="big" style={{ fontSize: 'clamp(30px,7vw,40px)' }}>What did you learn?</h2>
            {sent ? <p className="note left" style={{ color: 'var(--deep)', fontWeight: 700 }}>Thank you, {first}. Olex reads every one.</p> : <>
              <textarea value={fb} onChange={(e) => setFb(e.target.value)} rows={4} maxLength={3000} placeholder="The ideas that stayed with me…" />
              {fbErr ? <p role="alert" className="err">{fbErr}</p> : null}
              <button type="submit" className="cta dark">Send to Olex</button></>}
          </form> : null}
        </div>
        <div className="stack">
          <section id="learn" className="card reveal" aria-label="What you’ll get"><p className="lbl">What you’ll get</p>
            <ol className="learn">{(c.learn || []).map((t, i) => <li key={t} style={{ transitionDelay: `${i * 0.08}s` }}><span className="chip" data-count={i}>00</span>{t}</li>)}</ol></section>
          <section id="about" className="card reveal" aria-label="About Olaitan Adebayo"><b className="who">Olaitan Adebayo</b><span className="ideator">CREATIVE IDEATOR</span>
            <p className="note left">Builder, web developer, thinker and learner. I read widely, think slowly and ship quickly. This course is how I think about creation, in four short parts.</p>
            <a className="more" href="/about">More about me →</a></section>
        </div>
      </div>
    </main>

    <footer className="foot">
      <div className="fin">
        <div className="fbrand"><span className="word">Olexweb</span><p>Websites, products and ideas, built by Olaitan Adebayo.</p></div>
        <div><h3>Olexweb</h3><a href="/">Full website</a><a href="/about">About</a><a href="/portfolio">Portfolio</a><a href="/insights">Blog</a></div>
        <div><h3>Get in touch</h3><a href="/me">WhatsApp</a><a href="mailto:info@olexweb.com">info@olexweb.com</a><a href="/work-with-me">Work with me</a></div>
        <div><h3>More</h3><a href="https://wa.me/2347011726321?text=Hi%20Olaitan%2C%20I%27d%20like%20to%20join%20the%20Creator%27s%20Room.">Creator’s Room</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div>
      </div>
      <p className="copy2">© {new Date().getFullYear()} Olexweb. Owned and operated by Olaitan Adebayo.</p>
    </footer>
  </div>)
}

const CSS = `
html,body{background:#EDF0E9!important;color-scheme:light}
.aoc{--bg:#EDF0E9;--ink:#111410;--dim:#4F564A;--line:rgba(17,20,16,.10);--green:#76C442;--deep:#3C7A1C;position:relative;min-height:100vh;color:var(--ink);font-family:var(--font-mona),system-ui,sans-serif;overflow-x:clip;
 background:var(--bg) linear-gradient(rgba(17,20,16,.045) 1px,transparent 1px) 0 0/64px 64px,linear-gradient(90deg,rgba(17,20,16,.045) 1px,transparent 1px) 0 0/64px 64px}
.aoc *{box-sizing:border-box}.aoc p{margin:0}.aoc a{color:inherit}
.aoc .blob{position:absolute;border-radius:50%;pointer-events:none;background:radial-gradient(closest-side,rgba(118,196,66,.42),rgba(118,196,66,0));will-change:transform}
.aoc .b1{width:900px;height:900px;right:-360px;top:-320px;animation:aocDrift1 18s ease-in-out infinite alternate}.aoc .b2{width:760px;height:760px;left:-360px;top:900px;animation:aocDrift2 22s ease-in-out infinite alternate}
@keyframes aocDrift1{to{transform:translate3d(-120px,140px,0)}}@keyframes aocDrift2{to{transform:translate3d(140px,-110px,0)}}
@keyframes aocIn{to{opacity:1;transform:none}}@keyframes aocFade{to{opacity:1}}
/* header */
.aoc .nav{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:18px;padding:calc(env(safe-area-inset-top,0px) + 12px) max(clamp(16px,4vw,32px),calc((100% - 1180px) / 2 + clamp(16px,4vw,32px))) 12px}
.aoc .nav::before{content:'';position:absolute;inset:0;z-index:-1;background:rgba(237,240,233,.78);backdrop-filter:saturate(1.4) blur(12px);-webkit-backdrop-filter:saturate(1.4) blur(12px);border-bottom:1px solid rgba(17,20,16,.06)}
.aoc .brand{display:flex;align-items:center;gap:10px;text-decoration:none}.aoc .brand img{width:34px;height:34px;border-radius:10px;background:var(--ink);padding:6px}.aoc .brand b{font-weight:800;font-size:18px}
.aoc .links{display:flex;gap:26px;margin-left:auto}.aoc .links a{text-decoration:none;font-weight:700;font-size:15px;color:var(--dim);transition:color .2s}.aoc .links a:hover{color:var(--ink)}
.aoc .navcta{padding:11px 18px;border-radius:999px;background:var(--ink);color:#fff;font-weight:800;font-size:14px;text-decoration:none;transition:transform .2s}.aoc .navcta:hover{transform:translateY(-1px)}
.aoc .burger{display:none;width:44px;height:44px;border-radius:12px;border:1px solid var(--line);background:#fff;position:relative;cursor:pointer}
.aoc .burger i{position:absolute;left:12px;right:12px;height:2px;background:var(--ink);border-radius:2px;transition:transform .25s}.aoc .burger i:first-child{top:17px}.aoc .burger i:last-child{top:25px}
.aoc .burger[aria-expanded=true] i:first-child{transform:translateY(4px) rotate(45deg)}.aoc .burger[aria-expanded=true] i:last-child{transform:translateY(-4px) rotate(-45deg)}
.aoc .sheet{position:absolute;left:12px;right:12px;top:100%;display:grid;padding:8px;border-radius:20px;background:#fff;box-shadow:0 24px 48px -20px rgba(20,40,10,.35);opacity:0;transform:translateY(-8px) scale(.98);pointer-events:none;transition:opacity .2s,transform .2s}
.aoc .sheet.open{opacity:1;transform:none;pointer-events:auto}.aoc .sheet a{padding:14px 16px;border-radius:12px;text-decoration:none;font-weight:700}.aoc .sheet a:hover{background:#f1f4ed}
@media(max-width:820px){.aoc .links{display:none}.aoc .navcta{margin-left:auto;padding:10px 14px}.aoc .burger{display:block}}
@media(min-width:821px){.aoc .sheet{display:none}}
.aoc main{position:relative;z-index:1;max-width:1180px;margin:0 auto;padding:10px clamp(16px,4vw,32px) 56px}
/* hero */
.aoc .hero{position:relative;border-radius:clamp(22px,3vw,34px);overflow:hidden;min-height:clamp(560px,60vw,680px);background:linear-gradient(160deg,#f3f6ef,#e5ebde);border:1px solid rgba(255,255,255,.9);box-shadow:0 40px 80px -50px rgba(30,60,20,.55);isolation:isolate}
.aoc .hgrid{position:absolute;inset:0;background-image:linear-gradient(rgba(17,20,16,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(17,20,16,.05) 1px,transparent 1px);background-size:56px 56px}
.aoc .hglow{position:absolute;width:72%;height:92%;right:-12%;top:6%;background:radial-gradient(closest-side,rgba(118,196,66,.5),rgba(118,196,66,0));animation:aocPulse 6s ease-in-out infinite;will-change:transform}
@keyframes aocPulse{50%{transform:scale(1.06)}}
.aoc .copy{position:relative;z-index:3;padding:clamp(22px,4vw,46px);max-width:640px}
.aoc .pill{display:inline-flex;align-items:center;gap:10px;padding:10px 18px;border-radius:999px;background:rgba(255,255,255,.78);border:1px solid #fff;font-weight:800;font-size:12.5px;letter-spacing:.2em;color:var(--deep);text-transform:uppercase;opacity:0;transform:translateY(-10px)}
.aoc .eq{display:inline-flex;gap:3px;align-items:center;height:16px}.aoc .eq i{width:3px;height:100%;border-radius:2px;background:var(--green);transform-origin:50% 50%;animation:aocEq 1s ease-in-out infinite}
.aoc .eq i:nth-child(1){animation-delay:-.2s}.aoc .eq i:nth-child(2){animation-delay:-.5s}.aoc .eq i:nth-child(3){animation-delay:-.8s}.aoc .eq i:nth-child(4){animation-delay:-.1s}.aoc .eq i:nth-child(5){animation-delay:-.6s}
@keyframes aocEq{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}
.aoc h1{margin:18px 0 0;font-family:var(--font-hubot),system-ui,sans-serif;font-stretch:75%;font-weight:900;line-height:.86;letter-spacing:-.01em;font-size:clamp(66px,12.5vw,148px)}
.aoc h1 .w{display:block}.aoc h1 .ch{display:inline-block;opacity:0;transform:translateY(60%) rotate(4deg)}
.aoc h1 .of{display:inline-block;margin-right:.12em}.aoc h1 .of svg{height:.86em;width:auto;overflow:visible;vertical-align:-.02em}
.aoc h1 .of text{font-family:var(--font-hubot),system-ui,sans-serif;font-stretch:75%;font-weight:900;fill:transparent;stroke:var(--ink);stroke-width:2.2;stroke-dasharray:900;stroke-dashoffset:900}
.aoc h1 .cr{position:relative;display:inline-block}.aoc h1 .crb{color:rgba(17,20,16,.08)}
.aoc h1 .crg{position:absolute;inset:0;overflow:hidden;transform:translate3d(-101%,0,0);will-change:transform}.aoc h1 .crg span{display:block;color:var(--green);transform:translate3d(101%,0,0);will-change:transform}
@keyframes aocSlide{to{transform:translate3d(0,0,0)}}
.aoc .sub{margin:18px 0 0;font-size:clamp(17px,2.1vw,22px);line-height:1.35;max-width:30ch;opacity:0;transform:translateY(10px)}.aoc .sub b{font-weight:800}
.aoc .play{display:flex;align-items:center;gap:10px;margin:12px 0 0;color:var(--deep);font-weight:800;font-size:15px;opacity:0;transform:translateY(10px)}
.aoc .play span{flex:none;width:26px;height:26px;border-radius:99px;background:var(--green);color:#fff;display:grid;place-items:center;font-size:10px}
.aoc .stats{position:relative;display:flex;align-items:center;gap:clamp(14px,3vw,28px);margin:clamp(22px,4vw,40px) 0 0;padding:16px 22px 16px clamp(72px,9vw,100px);border-radius:24px;background:rgba(255,255,255,.8);border:1px solid #fff;width:max-content;max-width:100%;opacity:0;transform:translateY(20px)}
.aoc .stats b{display:block;font-family:var(--font-hubot),system-ui,sans-serif;font-stretch:75%;font-weight:900;font-size:clamp(34px,5vw,56px);line-height:.9}.aoc .stats .free b{color:var(--green);font-family:var(--font-mona),system-ui,sans-serif;font-stretch:75%}
.aoc .stats small{display:block;margin-top:4px;font-weight:800;font-size:11px;letter-spacing:.22em;color:var(--deep);text-transform:uppercase}.aoc .stats .sep{width:1px;align-self:stretch;background:var(--line)}
.aoc .bulb{position:absolute;left:-14px;top:-52px;width:clamp(74px,9vw,104px);height:auto;transform-origin:50% 0;animation:aocSway 4.5s ease-in-out infinite;will-change:transform;transition:filter .6s}
.aoc .bulb.lit{filter:drop-shadow(0 0 18px rgba(160,255,110,.95)) drop-shadow(0 0 40px rgba(118,196,66,.7))}
@keyframes aocSway{0%,100%{transform:rotate(-7deg)}50%{transform:rotate(7deg)}}
.aoc .person{position:absolute;z-index:2;right:-1%;bottom:0;width:min(62%,760px);opacity:0;transform:translateY(40px)}
.aoc .tilt{will-change:transform;transition:transform .3s ease-out}.aoc .person img{display:block;width:100%;height:auto}
.aoc .namecard{position:absolute;z-index:4;right:4%;bottom:6%;padding:16px 20px;border-radius:20px;background:rgba(255,255,255,.88);border:1px solid #fff;box-shadow:0 20px 40px -24px rgba(20,40,10,.4);opacity:0;transition:transform .3s ease-out}
.aoc .namecard b{display:block;font-weight:800;font-size:clamp(18px,2vw,26px)}.aoc .namecard span{display:inline-block;margin-top:8px;padding:5px 11px;border-radius:7px;background:var(--green);color:#fff;font-weight:800;font-size:11px;letter-spacing:.2em}
.aoc .hp{position:absolute;z-index:1;right:-60px;top:-30px;width:clamp(170px,22vw,280px);height:auto;opacity:0;will-change:transform}
@keyframes aocFloat{0%,100%{transform:translate3d(0,0,0) rotate(-14deg)}50%{transform:translate3d(0,16px,0) rotate(-6deg)}}
@keyframes aocDraw{to{stroke-dashoffset:0}}@keyframes aocFill{to{background-position:0 0}}@keyframes aocCard{to{opacity:1}}
/* the opening plays once the fonts are ready (.go) */
.aoc.go .pill{animation:aocIn .6s .2s cubic-bezier(.2,.8,.2,1) forwards}.aoc.go h1 .ch{animation:aocIn .7s cubic-bezier(.2,.8,.2,1) forwards}
.aoc.go h1 .of text{animation:aocDraw 1.3s .8s ease forwards}.aoc.go h1 .crg,.aoc.go h1 .crg span{animation:aocSlide 1s 1.1s cubic-bezier(.6,0,.2,1) forwards}
.aoc.go .sub{animation:aocIn .7s 1.45s forwards}.aoc.go .play{animation:aocIn .7s 1.6s forwards}.aoc.go .stats{animation:aocIn .8s 1.75s cubic-bezier(.2,.8,.2,1) forwards}
.aoc.go .person{animation:aocIn 1s .5s cubic-bezier(.2,.8,.2,1) forwards}.aoc.go .namecard{animation:aocCard .8s 1.3s forwards}
.aoc.go .hp{animation:aocFade 1s .8s forwards,aocFloat 7s 1s ease-in-out infinite}
/* cards */
.aoc .cols{display:grid;gap:18px;margin-top:22px}@media(min-width:900px){.aoc .cols{grid-template-columns:1.05fr .95fr;gap:24px}}
.aoc .stack{display:grid;gap:18px;align-content:start}
.aoc .card{scroll-margin-top:90px;background:rgba(255,255,255,.84);border:1px solid #fff;border-radius:28px;box-shadow:0 24px 48px -28px rgba(30,60,20,.35);padding:clamp(20px,4.5vw,32px)}
.aoc .reveal{opacity:0;transform:translateY(32px);transition:opacity .7s cubic-bezier(.2,.8,.2,1),transform .7s cubic-bezier(.2,.8,.2,1)}.aoc .reveal.on{opacity:1;transform:none}
.aoc .lbl{font-size:13px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;color:var(--deep)}
.aoc .big{font-family:var(--font-hubot),system-ui,sans-serif;font-stretch:75%;font-weight:900;line-height:.95;margin:10px 0 0;font-size:clamp(36px,7vw,52px)}.aoc .big .g{color:var(--green)}.aoc .big .m{font-family:var(--font-mona),system-ui,sans-serif}
.aoc label.f{display:grid;gap:8px;margin-top:16px;font-weight:700;font-size:15px}
.aoc input[type=text],.aoc textarea{width:100%;padding:15px 16px;border-radius:16px;border:1px solid var(--line);background:#fff;font:inherit;font-size:16px;color:var(--ink);transition:box-shadow .2s,border-color .2s}
.aoc textarea{margin-top:12px;resize:vertical}.aoc input[type=text]:focus,.aoc textarea:focus{outline:0;border-color:var(--green);box-shadow:0 0 0 4px rgba(118,196,66,.22)}
.aoc .tick{position:relative;display:flex;gap:12px;align-items:flex-start;margin-top:14px;font-size:15.5px;line-height:1.5;cursor:pointer}
.aoc .tick input{position:absolute;opacity:0;width:24px;height:24px;margin:0}.aoc .tick .box{flex:none;width:24px;height:24px;border-radius:7px;border:2px solid rgba(17,20,16,.35);display:grid;place-items:center;transition:transform .2s,background .2s,border-color .2s;background:#fff}
.aoc .tick .box svg{width:16px;height:16px}.aoc .tick .box path{fill:none;stroke:#fff;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:24;stroke-dashoffset:24;transition:stroke-dashoffset .35s .05s}
.aoc .tick input:checked+.box{background:var(--green);border-color:var(--green);transform:scale(1.08)}.aoc .tick input:checked+.box path{stroke-dashoffset:0}.aoc .tick input:focus-visible+.box{outline:3px solid var(--deep);outline-offset:2px}
.aoc .cta{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;width:100%;margin-top:18px;padding:18px 24px;border:0;border-radius:999px;background:var(--green);color:#fff;font:800 15.5px var(--font-mona),system-ui;letter-spacing:.1em;text-transform:uppercase;text-decoration:none;cursor:pointer;box-shadow:0 14px 28px -14px rgba(60,122,28,.8);transition:transform .2s ease-out}
.aoc .cta.dark{background:var(--ink);box-shadow:none}.aoc .cta:disabled{opacity:.7}
.aoc .rip{position:absolute;border-radius:50%;background:rgba(255,255,255,.55);transform:scale(0);animation:aocRip .7s ease-out forwards;pointer-events:none}@keyframes aocRip{to{transform:scale(4);opacity:0}}
.aoc .err{margin-top:12px;color:#B42318;font-weight:700}
.aoc ol.learn{list-style:none;margin:14px 0 0;padding:0}.aoc ol.learn li{display:flex;gap:14px;align-items:center;padding:13px 0;border-top:1px solid var(--line);font-size:clamp(16px,4.2vw,18px);opacity:0;transform:translateX(-14px);transition:opacity .6s cubic-bezier(.2,.8,.2,1),transform .6s cubic-bezier(.2,.8,.2,1)}
.aoc ol.learn li:first-child{border-top:0}.aoc .reveal.on ol.learn li{opacity:1;transform:none}
.aoc .chip{flex:none;display:inline-block;min-width:42px;padding:4px 0;border-radius:8px;background:var(--green);color:#fff;text-align:center;font:800 14px ui-monospace,SFMono-Regular,Menlo,monospace;font-style:normal}
.aoc .who{display:block;font-size:24px;font-weight:800}.aoc .ideator{display:inline-block;margin-top:10px;padding:6px 12px;border-radius:8px;background:var(--green);color:#fff;font-weight:800;font-size:12px;letter-spacing:.18em}
.aoc .note{margin-top:8px;text-align:center;font-size:14px;color:var(--dim);line-height:1.6}.aoc .note.left{text-align:left;font-size:16px;margin-top:12px}
.aoc .more{display:inline-block;margin-top:12px;color:var(--deep);font-weight:800;text-decoration:none}
.aoc .welcome .ch{display:inline-block;opacity:0;transform:translateY(50%);animation:aocIn .5s cubic-bezier(.2,.8,.2,1) forwards}
.aoc .dl{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;margin-top:16px;padding:19px 18px;border-radius:999px;background:var(--green);color:#fff;font:800 clamp(14px,3.9vw,16.5px) var(--font-mona),system-ui;letter-spacing:.04em;text-transform:uppercase;text-decoration:none;white-space:nowrap;box-shadow:0 14px 28px -14px rgba(60,122,28,.8)}
.aoc .shine::after{content:'';position:absolute;top:0;bottom:0;left:0;width:60%;background:linear-gradient(110deg,transparent,rgba(255,255,255,.5),transparent);transform:translateX(-120%);animation:aocShine 3s 1s ease-in-out infinite;will-change:transform}
@keyframes aocShine{55%,100%{transform:translateX(220%)}}
.aoc .player{display:grid;gap:10px;margin-top:14px;padding:16px;border-radius:20px;background:#fff;border:1px solid var(--line)}
.aoc .prow{display:flex;align-items:center;gap:14px}.aoc .pbtn{flex:none;width:52px;height:52px;border-radius:50%;border:0;background:var(--ink);display:grid;place-items:center;cursor:pointer;transition:transform .15s}.aoc .pbtn:active{transform:scale(.92)}
.aoc .pbtn svg{width:20px;height:20px;fill:#fff}.aoc .wave{flex:1;width:100%;height:52px;cursor:pointer;touch-action:none}.aoc .wave:focus-visible{outline:3px solid var(--deep);outline-offset:4px;border-radius:8px}
.aoc .ptime{display:flex;justify-content:space-between;align-items:center;font-size:13px;color:var(--dim);font-variant-numeric:tabular-nums}.aoc .speed{border:1px solid var(--line);background:#fff;border-radius:99px;padding:4px 10px;font:700 12px var(--font-mona),system-ui;cursor:pointer;color:var(--ink)}
.aoc .parts{margin-top:16px;border-top:1px solid var(--line);padding-top:14px}.aoc .parts summary{cursor:pointer;font-weight:800;font-size:16.5px}
.aoc .part{display:grid;gap:10px;padding-top:18px;margin-top:14px;border-top:1px solid var(--line)}.aoc .part:first-of-type{border-top:0;margin-top:6px}
.aoc .ptitle{font-family:var(--font-hubot),system-ui,sans-serif;font-stretch:75%;font-weight:900;font-size:26px;line-height:1}
.aoc .covers{display:grid;gap:6px}.aoc .covers span{display:flex;gap:10px;align-items:center;font-size:15px}
.aoc .mini{justify-self:start;padding:10px 16px;border-radius:999px;border:1px solid var(--line);background:#fff;font-weight:800;font-size:13px;letter-spacing:.06em;text-transform:uppercase;text-decoration:none}
/* footer */
.aoc .foot{position:relative;z-index:1;margin-top:20px;background:var(--ink);color:#F2EFE9;padding:56px clamp(16px,4vw,32px) calc(env(safe-area-inset-bottom,0px) + 28px)}
.aoc .fin{max-width:1180px;margin:0 auto;display:grid;gap:30px;grid-template-columns:1fr}@media(min-width:760px){.aoc .fin{grid-template-columns:1.6fr 1fr 1fr 1fr}}
.aoc .word{display:block;font-family:var(--font-hubot),system-ui,sans-serif;font-stretch:75%;font-weight:900;font-size:clamp(56px,9vw,96px);line-height:.9;color:#fff}.aoc .fbrand p{margin-top:12px;color:rgba(242,239,233,.65);max-width:32ch}
.aoc .foot h3{margin:0 0 12px;font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:var(--green)}.aoc .foot a{display:block;padding:5px 0;color:rgba(242,239,233,.82);text-decoration:none}.aoc .foot a:hover{color:#fff}
.aoc .copy2{max-width:1180px;margin:34px auto 0;padding-top:20px;border-top:1px solid rgba(242,239,233,.12);font-size:13px;color:rgba(242,239,233,.55)}
.aoc a:focus-visible,.aoc button:focus-visible,.aoc summary:focus-visible{outline:3px solid var(--deep);outline-offset:3px}
/* phones */
@media(max-width:760px){
 .aoc .hero{min-height:0}.aoc .copy{padding:22px 20px 0}.aoc h1{font-size:clamp(64px,19vw,100px)}
 .aoc .person{position:relative;right:auto;width:86%;margin:10px 0 0 -2%;display:block}.aoc .namecard{right:3%;bottom:2.5%;padding:11px 14px;border-radius:16px}.aoc .namecard b{font-size:17px}.aoc .namecard span{font-size:10px;margin-top:6px}
 .aoc .hp{width:150px;right:-50px;top:-24px}.aoc .stats{margin-top:56px;padding-left:76px}.aoc .pill{font-size:11px;letter-spacing:.13em;padding:9px 14px;gap:8px}
 .aoc .b1{width:560px;height:560px;right:-260px;top:-200px}.aoc .b2{width:500px;height:500px;left:-260px}
}
@media(prefers-reduced-motion:reduce){.aoc *,.aoc *::before,.aoc *::after{animation-duration:.01ms!important;animation-delay:0s!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
 .aoc .pill,.aoc h1 .ch,.aoc .sub,.aoc .play,.aoc .stats,.aoc .person,.aoc .namecard,.aoc .hp,.aoc .reveal,.aoc ol.learn li{opacity:1!important;transform:none!important}.aoc h1 .of text{stroke-dashoffset:0}.aoc h1 .crg,.aoc h1 .crg span{transform:none!important}}
`
