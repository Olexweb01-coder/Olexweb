'use client'
// Public pages built in the admin. Three templates sharing one craft: brand colours only (Night, Paper, Green, Green-ink),
// Hubot + Mona (numbers in Mona), a custom icon set, purposeful motion (transform/opacity only, visible by default).
import { useEffect, useRef, useState } from 'react'

// ---------- custom line icons (24 grid, 1.6 stroke, round) ----------
const I = {
  cal: <><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  screen: <><rect x="3" y="4.5" width="18" height="12.5" rx="2.5" /><path d="M8.5 20.5h7M12 17v3.5" /></>,
  pin: <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.4" /></>,
  people: <><circle cx="9" cy="9" r="3.2" /><path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6" /><path d="M15.5 6.2a3 3 0 0 1 0 5.6M17.5 14.6c1.6.6 2.7 2 3 4.4" /></>,
  arrow: <path d="M5 12h13M13 6.5 18.5 12 13 17.5" />,
  check: <path d="m5 12.5 4.2 4L19 7" />,
  chat: <><path d="M4.5 18.5 5.6 15A7.5 7.5 0 1 1 9 18.4Z" /><path d="M9 11.5h6M9 8.8h4" /></>,
  down: <><path d="M12 4v11M7 10.5l5 5 5-5" /><path d="M5 19.5h14" /></>,
  play: <path d="M8 5.5v13l10-6.5Z" />, pause: <path d="M8 5.5v13M16 5.5v13" />,
  head: <><path d="M4.5 14v-2a7.5 7.5 0 0 1 15 0v2" /><rect x="3.5" y="13.5" width="4" height="6.5" rx="1.6" /><rect x="16.5" y="13.5" width="4" height="6.5" rx="1.6" /></>,
}
const Ico = ({ n, c = '' }) => <svg className={'pv-ico ' + c} viewBox="0 0 24 24" aria-hidden="true">{I[n]}</svg>

const SLOTS = { open: (g) => [`Only ${g} ${g === 1 ? 'seat' : 'seats'}.`, 'Free, no payment.'], few: () => ['Join fast.', 'Few spaces left.'], bonus: () => ['Bonus spots opened.', 'Join while it’s open.'], closed: () => ['Sign-ups are closed for now.', ''] }
const lagos = (when) => when ? Date.parse(when + ':00+01:00') : NaN
const fmtDay = (ms) => new Date(ms).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Lagos' })
const fmtTime = (ms) => new Date(ms).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Africa/Lagos' }).replace(' ', '')
const initials = (n) => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
function lines(title) {                     // split a title into 2–3 balanced lines for the masked reveal
  const w = String(title || '').trim().split(/\s+/); if (w.length <= 2) return w.length ? w : ['']
  const n = w.length >= 5 ? 3 : 2, per = Math.ceil(w.length / n), out = []
  for (let i = 0; i < w.length; i += per) out.push(w.slice(i, i + per).join(' ')); return out
}
async function api(body) {
  const r = await fetch('/api/p', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Something went wrong. Try again.'); return j
}

function Countdown({ at }) {
  const [now, setNow] = useState(null)
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  if (now == null || !(at > 0)) return <div className="pv-cnt" aria-hidden="true">{['DAYS', 'HRS', 'MIN', 'SEC'].map((l) => <div key={l}><b>--</b><span>{l}</span></div>)}</div>
  let s = Math.max(0, Math.round((at - now) / 1000)); const v = [Math.floor(s / 86400), Math.floor((s %= 86400) / 3600), Math.floor((s %= 3600) / 60), s % 60]
  if (at - now <= 0) return <div className="pv-livenow"><span className="pv-dot" />Happening now</div>
  return <div className="pv-cnt" role="timer" aria-label="Time left">{['DAYS', 'HRS', 'MIN', 'SEC'].map((l, i) => <div key={l}><b key={v[i]} className="pv-roll">{String(v[i]).padStart(2, '0')}</b><span>{l}</span></div>)}</div>
}

function Person({ p, big }) {
  return (<div className={big ? 'pv-host' : 'pv-sp'}>
    <div className="pv-ph">{p.photo ? <img src={p.photo} alt={p.name} loading="lazy" /> : <span className="pv-mono">{initials(p.name)}</span>}</div>
    <div><b>{p.name}</b>{p.role ? <span className="pv-role">{p.role}</span> : null}{p.bio ? <p>{p.bio}</p> : null}</div>
  </div>)
}

function Player({ src, title, onEvent }) {
  const a = useRef(null), [on, setOn] = useState(false), [t, setT] = useState(0), [d, setD] = useState(0)
  const fmt = (x) => `${Math.floor((x || 0) / 60)}:${String(Math.floor((x || 0) % 60)).padStart(2, '0')}`
  return (<div className="pv-player">
    <audio ref={a} src={src} preload="none" onPlay={() => { setOn(true); onEvent('play') }} onPause={() => setOn(false)} onEnded={() => { setOn(false); onEvent('finish') }} onLoadedMetadata={(e) => setD(e.currentTarget.duration)} onTimeUpdate={(e) => setT(e.currentTarget.currentTime)} />
    <button type="button" className="pv-pb" aria-label={(on ? 'Pause ' : 'Play ') + title} onClick={() => { const x = a.current; if (!x) return; if (x.paused) { document.querySelectorAll('audio').forEach((o) => o !== x && o.pause()); x.play().catch(() => {}) } else x.pause() }}><Ico n={on ? 'pause' : 'play'} /></button>
    <div className="pv-track" onClick={(e) => { const x = a.current, r = e.currentTarget.getBoundingClientRect(); if (x && d) x.currentTime = ((e.clientX - r.left) / r.width) * d }}><i style={{ transform: `scaleX(${d ? t / d : 0})` }} /></div>
    <span className="pv-tm">{fmt(t)}{d ? ' / ' + fmt(d) : ''}</span>
  </div>)
}

export default function PageView({ page, preview = false }) {
  const c = page.content || {}, type = page.type, KEY = 'page-' + page.id, root = useRef(null)
  const [me, setMe] = useState(null), [name, setName] = useState(''), [tick, setTick] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState('')
  const [fb, setFb] = useState(''), [sent, setSent] = useState(false)
  const at = lagos(c.when), stage = page.stage || 'open', slot = (SLOTS[stage] || SLOTS.open)(page.goal), closed = stage === 'closed'
  const L = lines(c.title || (preview ? 'Your title' : '')), cta = c.cta || (type === 'audio' ? 'Get free access' : 'Save my seat')

  useEffect(() => {
    if (preview) return
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.token) api({ action: 'me', page: page.id, token: s.token }).then((j) => setMe({ ...j, token: s.token })).catch(() => {}) } catch {}
  }, [KEY, page.id, preview])
  useEffect(() => {                                     // settle-in on scroll; only what starts below the screen, with a safety net
    const el = root.current; if (!el || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const items = [...el.querySelectorAll('.pv-rv')].filter((x) => x.getBoundingClientRect().top > window.innerHeight * 0.92)
    items.forEach((x) => x.classList.add('pv-wait'))
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.remove('pv-wait'); io.unobserve(e.target) } }), { rootMargin: '0px 0px -8% 0px' })
    items.forEach((x) => io.observe(x)); const t = setTimeout(() => items.forEach((x) => x.classList.remove('pv-wait')), 2500)
    return () => { io.disconnect(); clearTimeout(t) }
  }, [])

  async function join(e) {
    e.preventDefault(); if (preview) return; setErr(''); setBusy(true)
    try { const j = await api({ action: 'join', page: page.id, name, consent: tick }); try { localStorage.setItem(KEY, JSON.stringify({ token: j.token })) } catch {} setMe(j)
      requestAnimationFrame(() => { const x = document.getElementById('pv-join'); if (x && x.getBoundingClientRect().top < 0) x.scrollIntoView({ behavior: 'smooth', block: 'start' }) }) }
    catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  const track = (part, event) => { if (me && me.token) api({ action: 'track', page: page.id, token: me.token, part, event }).catch(() => {}) }
  const first = me ? String(me.name).split(' ')[0] : ''

  const facts = []
  if (type !== 'audio' && at > 0) facts.push(['cal', `${fmtDay(at)} · ${fmtTime(at)} (Lagos)`])
  if (type === 'webinar' && c.platform) facts.push(['screen', `Online, on ${c.platform}`])
  if (type === 'event' && c.venue) facts.push(['pin', c.venue + (c.address ? ' · ' + c.address : '')])
  if (c.minutes) facts.push(['clock', `${c.minutes} minutes`])
  if (type === 'audio' && (c.parts || []).length) facts.push(['head', `${c.parts.length} short ${c.parts.length === 1 ? 'audio' : 'audios'}${c.parts.some((p) => p.minutes) ? ' · ' + c.parts.reduce((n, p) => n + (p.minutes || 0), 0) + ' minutes' : ''}`])
  if (c.whoFor) facts.push(['people', c.whoFor])

  const joinCard = me ? (<div className="pv-done">
      <span className="pv-eb"><span className="pv-dot" />{type === 'audio' ? 'Your access is ready' : 'Your seat is saved'}</span>
      <h3>You’re in, <em>{first}.</em></h3>
      {type !== 'audio' ? <div className="pv-rows">{facts.filter((f) => f[0] !== 'people').map(([i, t]) => <div key={t} className="pv-row"><Ico n={i} />{t}</div>)}</div> : null}
      {type === 'audio' ? <div className="pv-parts">{me.full ? <a className="pv-btn" href={me.full.file} download onClick={() => track('full', 'download')}><Ico n="down" />Download the full course</a> : null}
        {(me.parts || []).map((p, i) => <div key={i} className="pv-part"><b>{p.title}{p.minutes ? <span> · {p.minutes} min</span> : null}</b><Player src={p.file} title={p.title} onEvent={(ev) => track('p' + (i + 1), ev)} /><a className="pv-mini" href={p.file} download onClick={() => track('p' + (i + 1), 'download')}><Ico n="down" />Download</a></div>)}</div> : null}
      {me.community ? <div className="pv-comm"><span className="pv-eb">Last step · required</span><b>Join the WhatsApp community</b>
        <p>{type === 'audio' ? 'Updates and new free resources are shared there only.' : <>The joining link, reminders and every update are shared <strong>there only</strong>. Without it, you won’t get the link.</>}</p>
        <a className="pv-btn pv-g" href={me.community} target="_blank" rel="noopener noreferrer"><Ico n="chat" />Join the community</a></div> : null}
      {type === 'audio' && me.token ? (sent ? <p className="pv-ok">Thank you. Olaitan reads every one.</p> : <form className="pv-fb" onSubmit={async (e) => { e.preventDefault(); try { await api({ action: 'feedback', page: page.id, token: me.token, text: fb }); setSent(true) } catch (x) { setErr(x.message) } }}>
        <b>After listening: what did you learn?</b><textarea value={fb} onChange={(e) => setFb(e.target.value)} rows={3} maxLength={3000} placeholder="The ideas that stayed with me…" /><button className="pv-btn" type="submit">Send</button></form>) : null}
    </div>) : closed ? (<div className="pv-form"><h3>Sign-ups are closed for now.</h3><p className="pv-note">Message Olaitan to hear about the next one.</p><a className="pv-btn" href="/me"><Ico n="chat" />Message Olaitan</a></div>)
    : (<form className="pv-form" onSubmit={join}><span className="pv-eb">{type === 'audio' ? 'Your slot' : 'Your seat'}</span><h3>{type === 'audio' ? 'Get the audio now' : 'Save your seat'}</h3>
      <label className="pv-l">Your name<input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={60} autoComplete="name" placeholder="e.g. Ada Okafor" /></label>
      {type === 'audio' ? <label className="pv-tick"><input type="checkbox" checked={tick} onChange={(e) => setTick(e.target.checked)} required /><span aria-hidden="true"><Ico n="check" /></span>After listening, I’ll share what I learned.</label> : null}
      {stage !== 'open' ? <p className="pv-urgent">{slot[0]} {slot[1]}</p> : null}{err ? <p className="pv-err" role="alert">{err}</p> : null}
      <button className="pv-btn pv-cta" type="submit" disabled={busy}>{busy ? 'One moment…' : cta}<Ico n="arrow" /></button></form>)

  return (<div ref={root} className={'pv pv-' + type}>
    <style>{CSS}</style>
    <div className="pv-topbar"><div className="pv-w"><header className="pv-bar"><a className="pv-mark" href="/"><span><i /></span>Olaitan Adebayo</a>
      <span className="pv-live">{type === 'webinar' ? <><span className="pv-dot" />LIVE SESSION</> : type === 'event' ? <><Ico n="pin" />IN PERSON</> : <><Ico n="head" />AUDIO</>}</span></header></div></div>

    <section className="pv-hero"><div className="pv-w">
      {c.kicker ? <div className="pv-kick"><b>{c.kicker}</b></div> : null}
      <h1 aria-label={c.title}>{L.map((l, i) => <span key={i} className="pv-ln" aria-hidden="true"><span style={{ animationDelay: i * 0.12 + 's' }}>{i === L.length - 1 && L.length > 1 ? <span className="pv-hl">{l}</span> : l}</span></span>)}</h1>
      {c.tagline ? <p className="pv-lede">{c.tagline}</p> : null}
      {type !== 'audio' && at > 0 ? <div className="pv-when"><div className="pv-date"><small>{new Date(at).toLocaleDateString('en-GB', { month: 'short', timeZone: 'Africa/Lagos' }).toUpperCase()}</small><b>{new Date(at).toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'Africa/Lagos' })}</b><small>{new Date(at).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'Africa/Lagos' }).toUpperCase()}</small></div>
        <div className="pv-cd"><span className="pv-l2">Starts in · {fmtTime(at)} Lagos</span><Countdown at={at} /></div></div> : null}
      {facts.length ? <div className="pv-facts">{facts.filter((f) => !(f[0] === 'cal' && at > 0)).map(([i, t], k) => <div key={t} className="pv-fact" style={{ animationDelay: 0.95 + k * 0.1 + 's' }}><Ico n={i} />{t}</div>)}</div> : null}
      <a className="pv-btn pv-cta pv-heroCta" href="#pv-join">{me ? (type === 'audio' ? 'Go to your course' : 'See your details') : closed ? 'Sign-ups closed' : cta}<Ico n="arrow" /></a>
      <p className="pv-seats"><b>{slot[0]}</b> {slot[1]}</p>
    </div></section>

    {(c.learn || []).length > 2 ? <div className="pv-mq" aria-hidden="true"><div>{[...c.learn, ...c.learn].map((t, i) => <span key={i}>{t.split(' ').slice(0, 5).join(' ')}<i /></span>)}</div></div> : null}

    <div className="pv-w">
      {c.intro ? <section className="pv-sec pv-rv"><p className="pv-intro">{c.intro}</p></section> : null}
      {(c.learn || []).length ? <section className="pv-sec pv-rv"><span className="pv-eb">{type === 'audio' ? 'What you’ll get' : 'What you’ll see'}</span><h2>{c.learnTitle || 'What it covers'}</h2>
        <ol className="pv-learn">{c.learn.map((t, i) => <li key={i}><span className="pv-n">{String(i + 1).padStart(2, '0')}</span><b>{t}</b></li>)}</ol></section> : null}
      {type === 'audio' && (c.parts || []).length ? <section className="pv-sec pv-rv"><span className="pv-eb">The audio</span><h2>{c.parts.length} short {c.parts.length === 1 ? "part" : "parts"}.</h2>
        <div className="pv-plist">{c.parts.map((p, i) => <div key={i}><b>{p.title}</b><span>{p.minutes ? p.minutes + ' min' : ''}</span></div>)}</div></section> : null}
      <section className="pv-sec pv-rv" id="pv-join">{joinCard}</section>
      {c.host && c.host.name ? <section className="pv-sec pv-rv"><span className="pv-eb">Your host</span><Person p={c.host} big /></section> : null}
      {(c.speakers || []).length ? <section className="pv-sec pv-rv"><span className="pv-eb">{c.speakers.length === 1 ? 'Speaker' : 'Speakers'}</span><h2 className="pv-h3">{c.speakers.length === 1 ? 'With a guest.' : 'With guests.'}</h2><div className="pv-spk">{c.speakers.map((s, i) => <Person key={i} p={s} />)}</div></section> : null}
      {(c.faq || []).length ? <section className="pv-sec pv-rv"><span className="pv-eb">Questions</span><div className="pv-faq">{c.faq.map((f, i) => <details key={i}><summary>{f.q}</summary><p>{f.a}</p></details>)}</div></section> : null}
      <footer className="pv-foot"><span>© {new Date().getFullYear()} Olaitan Adebayo</span><a href="/">olexweb.com</a></footer>
    </div>
  </div>)
}

const CSS = `
.pv{--ink:#0a0b0a;--paper:#f2efe9;--card:color-mix(in srgb,#f2efe9 55%,#fff);--dim:rgba(10,11,10,.62);--line:rgba(10,11,10,.12);--g:#8fe36a;--gi:#0e1a0b;--ease:cubic-bezier(.2,.8,.2,1);
  background:var(--paper);color:var(--ink);font-family:var(--font-mona),system-ui,sans-serif;-webkit-font-smoothing:antialiased;overflow-x:clip;min-height:100vh}
html:has(.pv){scroll-behavior:smooth;background:#f2efe9}
.pv *{box-sizing:border-box}.pv :where(a){color:inherit}.pv h1,.pv h2,.pv h3,.pv p{margin:0}.pv-w{max-width:1000px;margin:0 auto;padding:0 20px}
.pv-ico{width:20px;height:20px;flex:none;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.pv-bar{display:flex;align-items:center;justify-content:space-between;height:62px;padding-top:env(safe-area-inset-top,0px)}.pv-mark{display:flex;align-items:center;gap:10px;font-weight:800;font-size:15px;text-decoration:none}
.pv-mark span{width:26px;height:26px;border-radius:8px;background:var(--ink);display:grid;place-items:center}.pv-mark i{width:9px;height:9px;border-radius:2px;background:var(--g);transform:rotate(45deg)}
.pv-live{display:inline-flex;align-items:center;gap:8px;padding:7px 12px;border-radius:999px;background:var(--ink);color:var(--paper);font-weight:700;font-size:12.5px;letter-spacing:.06em}.pv-live .pv-ico{width:15px;height:15px;color:var(--g)}
.pv-dot{position:relative;width:8px;height:8px;border-radius:50%;background:var(--g);flex:none}.pv-dot::after{content:"";position:absolute;inset:0;border-radius:50%;background:var(--g);animation:pvPing 1.8s var(--ease) infinite}
@keyframes pvPing{0%{transform:scale(1);opacity:.8}100%{transform:scale(3.2);opacity:0}}
.pv-hero{padding:22px 0 30px}.pv-kick{font-size:12.5px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:var(--gi);overflow:hidden}.pv-kick b{display:inline-block;transform:translateY(110%);animation:pvUp .7s var(--ease) .15s forwards}
.pv h1{font-family:var(--font-hubot),system-ui;font-stretch:76%;font-weight:900;font-size:clamp(54px,14vw,128px);line-height:.86;letter-spacing:-.02em;margin-top:14px}
.pv-ln{display:block;overflow:hidden;padding-bottom:.04em}.pv-ln>span{display:inline-block;transform:translateY(105%);animation:pvUp .9s var(--ease) forwards}
.pv-hl{position:relative;display:inline-block;z-index:0}.pv-hl::before{content:"";position:absolute;left:-.04em;right:-.06em;bottom:.08em;height:.34em;background:var(--g);z-index:-1;transform:scaleX(0);transform-origin:left;animation:pvSweep .7s var(--ease) 1s forwards}
@keyframes pvUp{to{transform:none}}@keyframes pvSweep{to{transform:scaleX(1)}}@keyframes pvIn{to{opacity:1;transform:none}}
.pv-lede{font-size:clamp(18px,4.4vw,22px);line-height:1.45;max-width:32ch;margin-top:18px;opacity:0;transform:translateY(12px);animation:pvIn .7s var(--ease) .55s forwards}
.pv-when{margin-top:22px;display:grid;grid-template-columns:auto 1fr;border-radius:22px;background:var(--ink);color:var(--paper);overflow:hidden;opacity:0;transform:translateY(16px) scale(.98);animation:pvIn .8s var(--ease) .75s forwards;max-width:520px}
.pv-date{padding:16px 18px;background:var(--g);color:var(--gi);display:grid;place-items:center;text-align:center;min-width:92px}.pv-date small{font-weight:800;font-size:12px;letter-spacing:.16em}.pv-date b{font-family:var(--font-mona),system-ui;font-stretch:78%;font-size:46px;line-height:.9;font-weight:900}
.pv-cd{padding:14px 16px;display:grid;gap:8px}.pv-l2{font-size:12.5px;color:rgba(242,239,233,.6);letter-spacing:.08em;text-transform:uppercase;font-weight:700}
.pv-cnt{display:flex;gap:14px}.pv-cnt div{display:grid}.pv-cnt b{font-family:var(--font-mona),system-ui;font-stretch:80%;font-weight:900;font-size:30px;line-height:1;font-variant-numeric:tabular-nums}.pv-cnt span{font-size:11px;color:rgba(242,239,233,.55);letter-spacing:.06em}
.pv-roll{display:inline-block;animation:pvRoll .45s var(--ease)}@keyframes pvRoll{0%{transform:translateY(-35%);opacity:0}100%{transform:none;opacity:1}}.pv-livenow{display:flex;gap:10px;align-items:center;font-weight:800;font-size:18px}
.pv-facts{display:grid;gap:8px;margin-top:14px;max-width:620px}.pv-fact{display:flex;gap:12px;align-items:center;padding:13px 14px;border-radius:16px;background:var(--card);border:1px solid var(--line);font-weight:600;font-size:15px;line-height:1.35;opacity:0;transform:translateX(-10px);animation:pvIn .6s var(--ease) forwards}.pv-fact .pv-ico{color:var(--gi)}
.pv-btn{position:relative;display:inline-flex;justify-content:center;align-items:center;gap:10px;padding:16px 22px;border:0;border-radius:999px;background:var(--ink);color:var(--paper);font:800 16px var(--font-mona),system-ui;text-decoration:none;cursor:pointer;overflow:hidden;transition:transform .25s var(--ease)}
.pv-btn:active{transform:scale(.97)}.pv-btn .pv-ico{transition:transform .3s var(--ease)}.pv-btn:hover .pv-ico{transform:translateX(4px)}.pv-btn:disabled{opacity:.7}
.pv-cta{width:100%;max-width:520px;padding:19px;font-size:17px}.pv-cta::before{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 35%,rgba(143,227,106,.35) 50%,transparent 65%);transform:translateX(-120%);animation:pvSheen 3.2s var(--ease) 2.2s infinite}
@keyframes pvSheen{0%{transform:translateX(-120%)}40%,100%{transform:translateX(120%)}}
.pv-heroCta{margin-top:16px;opacity:0;animation:pvIn .6s var(--ease) 1.25s forwards}.pv-seats{margin-top:10px;max-width:520px;text-align:center;font-size:14px;color:var(--dim);opacity:0;animation:pvIn .6s var(--ease) 1.35s forwards}.pv-seats b{color:var(--ink)}
.pv-mq{margin-top:26px;border-block:1px solid var(--line);overflow:hidden;white-space:nowrap}.pv-mq>div{display:inline-flex;gap:28px;padding:14px 0;animation:pvMq 28s linear infinite;font-family:var(--font-hubot),system-ui;font-stretch:80%;font-weight:800;font-size:22px}
.pv-mq span{display:inline-flex;gap:28px;align-items:center}.pv-mq i{width:8px;height:8px;border-radius:2px;background:var(--g);transform:rotate(45deg)}@keyframes pvMq{to{transform:translateX(-50%)}}
.pv-sec{padding:44px 0 4px}.pv-sec h2{font-family:var(--font-hubot),system-ui;font-stretch:78%;font-weight:900;font-size:clamp(34px,8vw,56px);line-height:.95;margin-top:10px}.pv-h3{font-size:clamp(28px,6vw,44px)!important}
.pv-eb{display:inline-flex;gap:8px;align-items:center;font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:var(--gi)}
.pv-intro{font-size:clamp(19px,4.2vw,24px);line-height:1.5;max-width:40ch}
.pv-learn{list-style:none;margin:20px 0 0;padding:0;display:grid;gap:10px}.pv-learn li{display:grid;grid-template-columns:44px 1fr;gap:12px;align-items:start;padding:16px;border-radius:18px;background:var(--card);border:1px solid var(--line)}
.pv-n{font-family:var(--font-mona),system-ui;font-stretch:80%;font-weight:900;font-size:26px;line-height:1;color:var(--gi)}.pv-learn b{font-size:16.5px;line-height:1.35}
.pv-plist{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:18px}.pv-plist div{padding:16px;border-radius:18px;background:var(--card);border:1px solid var(--line);display:grid;gap:4px}.pv-plist b{font-size:17px}.pv-plist span{font-size:13.5px;color:var(--dim)}
.pv-form,.pv-done{display:grid;gap:12px;padding:clamp(20px,4vw,30px);border-radius:26px;background:var(--card);border:1px solid var(--line);box-shadow:0 30px 60px -44px rgba(10,11,10,.45);max-width:620px}
.pv-form h3,.pv-done h3{font-family:var(--font-hubot),system-ui;font-stretch:78%;font-weight:900;font-size:clamp(32px,7vw,44px);line-height:1}.pv-done h3 em{font-style:normal;background:linear-gradient(transparent 62%,var(--g) 62%)}
.pv-l{display:grid;gap:8px;font-weight:700}.pv-l input,.pv-fb textarea{width:100%;padding:16px;border-radius:16px;border:1px solid var(--line);background:#fff;font:inherit;font-size:16px;color:var(--ink)}
.pv-l input:focus,.pv-fb textarea:focus{outline:0;border-color:var(--gi);box-shadow:0 0 0 4px rgba(143,227,106,.35)}
.pv-tick{position:relative;display:flex;gap:12px;align-items:flex-start;font-size:16px;line-height:1.45;cursor:pointer}.pv-tick input{position:absolute;opacity:0;width:24px;height:24px;margin:0}
.pv-tick>span{flex:none;width:24px;height:24px;border-radius:7px;border:2px solid rgba(10,11,10,.3);display:grid;place-items:center;background:#fff;transition:background .2s}.pv-tick .pv-ico{width:16px;height:16px;stroke:var(--gi);stroke-width:2.6;opacity:0;transition:opacity .2s}
.pv-tick input:checked+span{background:var(--g);border-color:var(--g)}.pv-tick input:checked+span .pv-ico{opacity:1}.pv-tick input:focus-visible+span{outline:3px solid var(--gi);outline-offset:2px}
.pv-urgent{padding:12px 14px;border-radius:14px;background:color-mix(in srgb,var(--g) 30%,#fff);color:var(--gi);font-weight:700}.pv-err{color:var(--gi);font-weight:800;padding:10px 12px;border-radius:12px;border:1.5px solid var(--ink)}.pv-note{color:var(--dim)}
.pv-rows{display:grid;gap:8px}.pv-row{display:flex;gap:12px;align-items:center;padding:12px 14px;border-radius:14px;background:#fff;font-weight:600;font-size:15px}.pv-row .pv-ico{color:var(--gi)}
.pv-comm{display:grid;gap:10px;padding:18px;border-radius:20px;background:var(--ink);color:var(--paper)}.pv-comm .pv-eb{color:var(--g)}.pv-comm b{font-size:19px}.pv-comm p{font-size:15px;line-height:1.5;color:rgba(242,239,233,.78)}.pv-comm strong{color:var(--paper)}
.pv-g{background:var(--g);color:var(--gi);font-size:17px;padding:17px}
.pv-parts{display:grid;gap:12px}.pv-part{display:grid;gap:8px;padding:14px;border-radius:18px;background:#fff;border:1px solid var(--line)}.pv-part b span{font-weight:600;color:var(--dim);font-size:14px}
.pv-player{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center}.pv-pb{width:46px;height:46px;border-radius:50%;border:0;background:var(--ink);color:var(--paper);display:grid;place-items:center;cursor:pointer}.pv-pb .pv-ico{fill:currentColor;stroke:none}.pv-pb:active{transform:scale(.94)}
.pv-track{height:8px;border-radius:99px;background:rgba(10,11,10,.1);overflow:hidden;cursor:pointer}.pv-track i{display:block;height:100%;background:var(--g);transform-origin:left;transition:transform .25s linear}.pv-tm{font-size:12.5px;color:var(--dim);font-variant-numeric:tabular-nums}
.pv-mini{justify-self:start;display:inline-flex;gap:8px;align-items:center;padding:9px 14px;border-radius:999px;border:1px solid var(--line);font-weight:800;font-size:13.5px;text-decoration:none}.pv-mini .pv-ico{width:16px;height:16px}
.pv-fb{display:grid;gap:10px;padding-top:6px}.pv-ok{font-weight:700;color:var(--gi)}
.pv-host{display:grid;grid-template-columns:132px 1fr;gap:16px;align-items:end;margin-top:16px;padding:16px;border-radius:22px;background:var(--card);border:1px solid var(--line);max-width:620px}
.pv-ph{border-radius:18px;overflow:hidden;aspect-ratio:4/5;background:linear-gradient(170deg,color-mix(in srgb,var(--g) 35%,var(--paper)),var(--paper));display:grid;place-items:center}.pv-ph img{width:100%;height:100%;object-fit:cover;object-position:50% 15%;display:block}
.pv-mono{font-family:var(--font-hubot),system-ui;font-stretch:80%;font-weight:900;font-size:40px;color:var(--gi)}
.pv-host b,.pv-sp b{font-size:18px}.pv-role{display:block;margin-top:2px;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--gi)}.pv-host p,.pv-sp p{margin-top:8px;font-size:14.5px;line-height:1.5;color:var(--dim)}
.pv-spk{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-top:16px}.pv-sp{padding:12px;border-radius:20px;background:var(--card);border:1px solid var(--line)}.pv-sp .pv-ph{margin-bottom:10px}
.pv-faq{display:grid;gap:8px;margin-top:16px;max-width:720px}.pv-faq details{padding:16px;border-radius:16px;background:var(--card);border:1px solid var(--line)}.pv-faq summary{cursor:pointer;font-weight:700;font-size:16px}.pv-faq p{margin-top:10px;line-height:1.55;color:var(--dim)}
.pv-foot{margin-top:48px;padding:26px 0 calc(env(safe-area-inset-bottom,0px) + 34px);border-top:1px solid var(--line);font-size:13.5px;color:var(--dim);display:flex;justify-content:space-between}.pv-foot a{text-decoration:none}
.pv a:focus-visible,.pv button:focus-visible,.pv summary:focus-visible{outline:3px solid var(--gi);outline-offset:3px}
.pv-rv{transition:opacity .8s var(--ease),transform .8s var(--ease)}.pv-rv.pv-wait{opacity:0;transform:translateY(22px)}
/* event: opens on Night with Green; the date card flips in */
.pv-event .pv-hero{background:var(--ink);color:var(--paper);padding-bottom:40px}.pv-event .pv-hero .pv-kick{color:var(--g)}.pv-event{--card:color-mix(in srgb,#f2efe9 55%,#fff)}
.pv-event .pv-fact{background:rgba(242,239,233,.06);border-color:rgba(242,239,233,.14);color:var(--paper)}.pv-event .pv-fact .pv-ico{color:var(--g)}.pv-event .pv-seats{color:rgba(242,239,233,.7)}.pv-event .pv-seats b{color:var(--paper)}
.pv-event .pv-heroCta{background:var(--g);color:var(--gi)}.pv-event .pv-topbar{background:var(--ink);color:var(--paper)}
.pv-event .pv-when{background:rgba(242,239,233,.06);perspective:600px}.pv-event .pv-date{transform-origin:top;animation:pvFlip .9s var(--ease) .8s both}@keyframes pvFlip{0%{transform:rotateX(-92deg)}100%{transform:none}}
.pv-event .pv-hl::before{background:var(--g)}.pv-event .pv-hl{color:var(--paper)}
.pv-event .pv-mark span{background:var(--g)}.pv-event .pv-mark i{background:var(--ink)}.pv-event .pv-live{background:var(--g);color:var(--gi)}.pv-event .pv-live .pv-ico{color:var(--gi)}
@media(prefers-reduced-motion:reduce){.pv *,.pv *::before,.pv *::after{animation:none!important;transition:none!important}.pv-kick b,.pv-ln>span,.pv-lede,.pv-when,.pv-fact,.pv-heroCta,.pv-seats{opacity:1!important;transform:none!important}.pv-hl::before{transform:none!important}}
`
