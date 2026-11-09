'use client'
// The mock-up homepage a business sees at olexweb.com/preview/<token> (lib/sales/preview.js). Their name, words, colour and
// phone; motion that reveals as they scroll; a booking demo they can try; then what the new version fixes, and Olaitan.
// The ribbon at the top always says it's a mock-up by Olexweb, not their live site.
import { useEffect, useRef, useState } from 'react'

const UI = {
  en: { ribbon: (n) => `A mock-up Olexweb made for ${n}. Not your live site.`, talk: 'Like it? Talk to Olaitan', services: 'Services', why: 'Why us', about: 'About', contact: 'Contact', call: 'Call',
    whatWeDo: 'What we do', bookTitle: 'Book in seconds', bookSub: 'Pick a day and a time. That’s it.', pick: 'Choose a time', confirm: 'Confirm', demo: 'This is a preview: on your real site, this books the slot and emails you both.',
    findUs: 'Find us', hours: 'Opening hours', phone: 'Phone', fixTitle: 'What this version fixes', fixSub: 'Made from a quick look at your current website.', fixCta: 'Talk to Olaitan about it', orReply: 'or just reply to my email.',
    byline: 'Mock-up by Olexweb: every build is made for one business, never a template.', days: ['Today', 'Tomorrow'], wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], open: 'Open', scroll: 'Scroll' },
  fr: { ribbon: (n) => `Une maquette réalisée par Olexweb pour ${n}. Ce n’est pas votre site en ligne.`, talk: 'Elle vous plaît ? Parlons-en', services: 'Services', why: 'Pourquoi nous', about: 'À propos', contact: 'Contact', call: 'Appeler',
    whatWeDo: 'Ce que nous faisons', bookTitle: 'Réservez en quelques secondes', bookSub: 'Choisissez un jour et une heure. C’est tout.', pick: 'Choisissez un horaire', confirm: 'Confirmer', demo: 'Ceci est une maquette : sur votre vrai site, le créneau est réservé et vous recevez tous deux un e-mail.',
    findUs: 'Nous trouver', hours: 'Horaires', phone: 'Téléphone', fixTitle: 'Ce que cette version améliore', fixSub: 'D’après un rapide examen de votre site actuel.', fixCta: 'En parler avec Olaitan', orReply: 'ou répondez simplement à mon e-mail.',
    byline: 'Maquette par Olexweb : chaque site est conçu pour une seule entreprise, jamais un modèle.', days: ['Aujourd’hui', 'Demain'], wd: ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'], open: 'Ouvert', scroll: 'Défiler' },
}
const ICONS = {
  tooth: 'M7 3c-2.5 0-4 2-4 4.5 0 2 1 3.3 1.5 5 .6 2.3.8 7.5 2.7 7.5 1.6 0 1.6-4.5 2.8-6 .5-.6 1.5-.6 2 0 1.2 1.5 1.2 6 2.8 6 1.9 0 2.1-5.2 2.7-7.5.5-1.7 1.5-3 1.5-5C21 5 19.5 3 17 3c-2 0-3 1-5 1S9 3 7 3z',
  leaf: 'M5 19c0-8 5-14 15-15-1 10-7 15-15 15zm0 0 7-7', scissors: 'M6 6m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M6 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M8.1 8.1 20 20M8.1 15.9 20 4',
  wrench: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.8-.6-.6-2.8 2.6-2.6z', scale: 'M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0L5 7zm14 0-3 7a3 3 0 0 0 6 0l-3-7z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2', compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm4-13-2 6-6 2 2-6 6-2z', plate: 'M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM2 4v6a2 2 0 0 0 2 2v8M22 4v16M19 4c-1 3-1 6 3 7',
  cup: 'M4 8h13v5a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6V8zm13 1h1.5a2.5 2.5 0 0 1 0 5H17M8 2v3M12 2v3', bag: 'M5 8h14l-1 13H6L5 8zm4 0V6a3 3 0 0 1 6 0v2', spark: 'M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z',
}
const Icon = ({ k, s = 26 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[k] || ICONS.spark} /></svg>
const Check = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" /></svg>
function onColor(hex) { const h = hex.replace('#', ''), n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16); const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.42 ? '#111' : '#fff' }

export default function PreviewSite({ d }) {
  const t = UI[d.lang] || UI.en, c = d.copy, root = useRef(null)
  const [day, setDay] = useState(0), [slot, setSlot] = useState(null), [booked, setBooked] = useState(false), [now, setNow] = useState(null)
  useEffect(() => setNow(Date.now()), [])                                  // dates come from the visitor's own clock
  // a real look (a moment on screen, the page actually running) counts as opening it
  useEffect(() => {
    let k = 'olx-pv-' + d.token, done = false; try { done = !!sessionStorage.getItem(k) } catch {}
    if (done) return
    const timer = setTimeout(() => {
      if (document.visibilityState !== 'visible') return
      try { sessionStorage.setItem(k, '1') } catch {}
      fetch('/api/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: d.token, what: 'view' }), keepalive: true }).catch(() => {})
    }, 2500)
    return () => clearTimeout(timer)
  }, [d.token])
  // things fade and rise into place as they scroll in
  useEffect(() => {
    const els = root.current ? root.current.querySelectorAll('[data-in]') : []
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return }
    const io = new IntersectionObserver((list) => list.forEach((x) => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target) } }), { rootMargin: '0px 0px -8% 0px' })
    els.forEach((e) => io.observe(e)); return () => io.disconnect()
  }, [])
  const talk = () => { fetch('/api/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: d.token, what: 'click' }), keepalive: true }).catch(() => {}) }
  const days = (now ? [0, 1, 2, 3, 4] : [0, 1]).map((i) => { const x = new Date((now || 0) + i * 864e5); return { label: i < 2 ? t.days[i] : `${t.wd[x.getDay()]} ${x.getDate()}`, i } })
  const slots = ['09:00', '10:30', '12:00', '14:30', '16:00', '17:30'].filter((_, i) => (i + day) % 4 !== 3)
  const tel = d.phone ? 'tel:' + d.phone.replace(/[^\d+]/g, '') : null
  const year = new Date().getFullYear(), initials = d.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  return (
    <div className="pv" ref={root} style={{ '--b': d.color, '--on': onColor(d.color) }} lang={d.lang}>
      <div className="pv-top">
      <div className="pv-ribbon" role="note">
        <span><b>✦</b> {t.ribbon(d.name)}</span>
        <a href={d.book} onClick={talk} className="pv-ribbon-go">{t.talk} →</a>
      </div>
      <header className="pv-nav">
        <a className="pv-logo" href="#top"><span className="pv-mark">{initials}</span><span>{d.name}</span></a>
        <nav className="pv-links"><a href="#services">{t.services}</a><a href="#why">{t.why}</a>{c.about ? <a href="#about">{t.about}</a> : null}<a href="#contact">{t.contact}</a></nav>
        <a className="pv-btn pv-btn-sm" href={d.booking ? '#book' : '#contact'}>{c.cta}</a>
      </header>
      </div>

      <section className="pv-hero" id="top">
        <div className="pv-blobs" aria-hidden="true"><i /><i /><i /></div>
        <div className="pv-hero-in">
          <p className="pv-tag pv-rise" style={{ '--d': '0ms' }}>{c.tagline}</p>
          <h1 className="pv-h1">{c.headline.split(' ').map((w, i) => <span key={i} className="pv-word" style={{ '--d': `${120 + i * 70}ms` }}>{w}&nbsp;</span>)}</h1>
          <p className="pv-sub pv-rise" style={{ '--d': '520ms' }}>{c.sub}</p>
          <div className="pv-ctas pv-rise" style={{ '--d': '640ms' }}>
            <a className="pv-btn" href={d.booking ? '#book' : '#contact'}>{c.cta}</a>
            {tel ? <a className="pv-btn pv-ghost" href={tel}>{t.call} {d.phone}</a> : null}
          </div>
        </div>
        <div className="pv-float pv-rise" style={{ '--d': '800ms' }} aria-hidden="true">
          <span className="pv-float-ic"><Icon k={d.icon} s={30} /></span>
          <span><b>{d.name}</b><small>{d.hours || (d.city ? d.city : t.open)}</small></span>
        </div>
        <span className="pv-scroll" aria-hidden="true">{t.scroll}</span>
      </section>

      <div className="pv-marquee" aria-hidden="true"><div>{[0, 1, 2].map((k) => c.services.map((s, i) => <span key={k + '-' + i}>{s.name}<em>✦</em></span>))}</div></div>

      <section className="pv-sec" id="services">
        <h2 className="pv-h2" data-in>{t.whatWeDo}</h2>
        <div className="pv-cards">{c.services.map((s, i) => <article key={i} className="pv-card" data-in style={{ '--d': `${i * 90}ms` }}>
          <span className="pv-card-ic"><Icon k={d.icon} /></span><h3>{s.name}</h3><p>{s.line}</p><span className="pv-card-n">0{i + 1}</span></article>)}</div>
      </section>

      <section className="pv-sec pv-why" id="why">
        <h2 className="pv-h2" data-in>{t.why}</h2>
        <ol className="pv-reasons">{c.reasons.map((r, i) => <li key={i} data-in style={{ '--d': `${i * 110}ms` }}><span>{i + 1}</span>{r}</li>)}</ol>
      </section>

      {c.about ? <section className="pv-sec pv-about" id="about"><p data-in>{c.about}</p></section> : null}

      {d.booking ? <section className="pv-sec" id="book">
        <div className="pv-book" data-in>
          <div><h2 className="pv-h2">{t.bookTitle}</h2><p className="pv-dim">{t.bookSub}</p></div>
          <div className="pv-days" role="tablist">{days.map((x) => <button key={x.i} role="tab" aria-selected={day === x.i} className={day === x.i ? 'on' : ''} onClick={() => { setDay(x.i); setSlot(null); setBooked(false) }}>{x.label}</button>)}</div>
          <p className="pv-dim pv-small">{t.pick}</p>
          <div className="pv-slots">{slots.map((s) => <button key={s} className={slot === s ? 'on' : ''} onClick={() => { setSlot(s); setBooked(false) }}>{s}</button>)}</div>
          <button className="pv-btn pv-wide" disabled={!slot} onClick={() => setBooked(true)}>{t.confirm}{slot ? ` · ${days[day].label} ${slot}` : ''}</button>
          {booked ? <p className="pv-demo" role="status">{t.demo}</p> : null}
        </div>
      </section> : null}

      <section className="pv-sec pv-contact" id="contact">
        <h2 className="pv-h2" data-in>{t.findUs}</h2>
        <div className="pv-info" data-in>
          {d.phone ? <div><small>{t.phone}</small><a href={tel}>{d.phone}</a></div> : null}
          {d.address || d.city ? <div><small>{t.findUs}</small><span>{d.address || d.city}</span></div> : null}
          {d.hours ? <div><small>{t.hours}</small><span>{d.hours}</span></div> : null}
        </div>
      </section>

      <footer className="pv-foot"><span>© {year} {d.name}</span><span className="pv-dim">{t.byline}</span></footer>

      <section className="pv-olex" aria-label="Olexweb">
        <div className="pv-olex-in" data-in>
          <h2>{t.fixTitle}</h2><p className="pv-olex-sub">{t.fixSub}</p>
          <ul>{d.fixes.map((f, i) => <li key={i}><Check />{f}</li>)}</ul>
          <a className="pv-olex-go" href={d.book} onClick={talk}>{t.fixCta} →</a><span className="pv-olex-or">{t.orReply}</span>
        </div>
      </section>
    </div>
  )
}
