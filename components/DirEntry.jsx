'use client'
// One Directory page: checked facts (each with the site's own words), your Short, how to start, verdict, alternatives, one next step.
import { useEffect, useRef, useState } from 'react'
import { DIR_CSS, PRICE } from './dirStyles'
import DirShare from './DirShare'

const I = { arrow: <path d="M5 12h13M13 6.5 18.5 12 13 17.5" />, out: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>,
  check: <path d="m5 12.5 4.2 4L19 7" />, warn: <><path d="M12 4 21 19H3Z" /><path d="M12 10v4M12 16.8v.2" /></>, quote: <path d="M9 8H6a2 2 0 0 0-2 2v3h4v4H4M20 8h-3a2 2 0 0 0-2 2v3h4v4h-4" />, play: <path d="M8 5.5v13l10-6.5Z" /> }
const Ico = ({ n }) => <svg className="dx-ico" viewBox="0 0 24 24" aria-hidden="true">{I[n]}</svg>
const lines = (t) => { const w = String(t || '').split(/\s+/); if (w.length <= 3) return [w.join(' ')]; const h = Math.ceil(w.length / 2); return [w.slice(0, h).join(' '), w.slice(h).join(' ')] }
const beacon = (slug, lead) => { try { fetch('/api/dir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, lead }), keepalive: true }).catch(() => {}) } catch {} }

export default function DirEntry({ e }) {
  const c = e.content || {}, root = useRef(null), [play, setPlay] = useState(false), name = e.name, [head, ...rest] = String(c.title || name).split(':')
  useEffect(() => { beacon(e.slug, false)
    const el = root.current; if (!el || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const items = [...el.querySelectorAll('.dx-rv')].filter((x) => x.getBoundingClientRect().top > window.innerHeight * 0.92); items.forEach((x) => x.classList.add('dx-wait'))
    const io = new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { x.target.classList.remove('dx-wait'); io.unobserve(x.target) } }), { rootMargin: '0px 0px -8% 0px' })
    items.forEach((x) => io.observe(x)); const t = setTimeout(() => items.forEach((x) => x.classList.remove('dx-wait')), 2500); return () => { io.disconnect(); clearTimeout(t) }
  }, [e.slug])
  const price = (c.pricing && c.pricing.status) || 'unknown', host = (() => { try { return new URL(e.url).hostname.replace(/^www\./, '') } catch { return e.url } })()
  return (<div ref={root} className="dx">
    <style dangerouslySetInnerHTML={{ __html: DIR_CSS + ENTRY_CSS }} />
    <div className="dx-w"><header className="dx-bar"><a className="dx-mark" href="/" aria-label="Olexweb, home"><img src="/studio/mark.png" alt="" width="21" height="24" />Olexweb</a><nav className="dx-nav"><a href="/tools">Directory</a><a href={e.offer.href} onClick={() => beacon(e.slug, true)}>Free resources</a></nav></header>
      <nav className="de-crumb" aria-label="Breadcrumb"><a href="/tools">Directory</a><span>/</span>{e.category ? <span>{e.category}</span> : null}{e.category ? <span>/</span> : null}<span aria-current="page">{name}</span></nav>
      <section className="de-hero">
        <div className="de-meta"><span className={'dx-badge dx-' + price}>{PRICE[price]}</span>{e.category ? <span className="dx-eb">{e.category}</span> : null}</div>
        <h1 className="dx-h1" aria-label={c.title}>{lines(head).map((l, i) => <span key={i} className="dx-ln" aria-hidden="true"><span style={{ animationDelay: i * 0.1 + 's' }}>{l}</span></span>)}</h1>
        {rest.length ? <p className="de-sub">{rest.join(':').trim()}</p> : null}
        <p className="dx-lede">{c.summary}</p>
        <div className="de-acts"><a className="dx-btn" href={e.url} target="_blank" rel="noopener nofollow">Open {host}<Ico n="out" /></a><a className="dx-btn dx-g" href="#start">How to start<Ico n="arrow" /></a></div>
        <DirShare path={'/tools/' + e.slug} title={c.title || name} />
      </section>
      <div className="de-grid">
        <main className="de-main">
          {e.video ? <section className="dx-rv de-sec"><span className="dx-eb">Watch it in 30 seconds</span>
            <div className="de-video">{play ? <iframe src={`https://www.youtube-nocookie.com/embed/${e.video}?autoplay=1&rel=0`} title={'Video: ' + name} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
              : <button onClick={() => setPlay(true)} aria-label={'Play the video about ' + name}><img src={`https://i.ytimg.com/vi/${e.video}/hqdefault.jpg`} alt="" loading="lazy" /><span><Ico n="play" /></span></button>}</div></section> : null}
          <section className="dx-rv de-sec"><span className="dx-eb">What it does</span><h2>The facts, in its own words</h2>
            <ul className="de-facts">{(c.facts || []).map((f, i) => <li key={i}><b><Ico n="check" />{f.claim}</b><span><Ico n="quote" />“{f.quote}”, {host}</span></li>)}</ul>
            {c.pricing && c.pricing.status !== 'unknown' && c.pricing.quote ? <p className="de-price"><b>{PRICE[price]}.</b> {c.pricing.claim} <span>“{c.pricing.quote}”</span></p> : null}</section>
          <section className="dx-rv de-sec"><span className="dx-eb">Who it’s for</span><ul className="de-chips">{(c.whoFor || []).map((x, i) => <li key={i}>{x}</li>)}</ul></section>
          <section className="dx-rv de-sec" id="start"><span className="dx-eb">How to start</span><h2>Up and running today</h2><ol className="de-steps">{(c.howToStart || []).map((x, i) => <li key={i}><span>{String(i + 1).padStart(2, '0')}</span>{x}</li>)}</ol></section>
          <section className="dx-rv de-sec de-take"><span className="dx-eb">Our take</span><p>{c.ourTake}</p>
            <div className="de-two"><div><b>Good for</b><ul>{(c.goodFor || []).map((x, i) => <li key={i}><Ico n="check" />{x}</li>)}</ul></div><div><b>Watch out for</b><ul>{(c.watchOut || []).map((x, i) => <li key={i}><Ico n="warn" />{x}</li>)}</ul></div></div></section>
          {(c.faq || []).length ? <section className="dx-rv de-sec"><span className="dx-eb">Questions</span><div className="de-faq">{c.faq.map((f, i) => <details key={i} open={i === 0}><summary>{f.q}</summary><p>{f.a}</p></details>)}</div></section> : null}
          <p className="de-note">Facts on this page are quoted from {host} and checked when written ({new Date(e.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}). Sites change; check the site before you rely on details like prices.</p>
        </main>
        <aside className="de-side"><div className="de-offer dx-rv"><span className="dx-eb">Free from Olaitan</span><b>{e.offer.title}</b><p>{e.offer.line}</p><a className="dx-btn dx-g" href={e.offer.href + (e.offer.href.includes('?') ? '&' : '?') + 'from=tools-' + e.slug} onClick={() => beacon(e.slug, true)}>{e.offer.kind === 'link' ? 'Join on WhatsApp' : 'Get it free'}<Ico n="arrow" /></a></div></aside>
      </div>
      {(e.related || []).length ? <section className="dx-rv de-sec"><span className="dx-eb">Alternatives and similar tools</span><div className="de-rel">{e.related.map((r) => <a key={r.slug} href={'/tools/' + r.slug} className="dx-card"><span className={'dx-badge dx-' + (r.price || 'unknown')}>{PRICE[r.price || 'unknown']}</span><b>{r.name}</b><p>{r.one}</p></a>)}</div></section> : null}
      <footer className="dx-foot"><span>© {new Date().getFullYear()} Olexweb · Olaitan Adebayo</span><span><a href="/tools">All tools</a> · <a href="/privacy">Privacy</a></span></footer>
    </div>
  </div>)
}
export const ENTRY_CSS = `
.de-crumb{display:flex;gap:8px;flex-wrap:wrap;font-size:13px;color:var(--dim);margin-top:6px}.de-crumb a{text-decoration:none}
.de-hero{padding:22px 0 26px}.de-meta{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.de-sub{font-size:clamp(18px,3.6vw,24px);font-weight:700;margin-top:10px;max-width:34ch}
.de-acts{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px;opacity:0;animation:dxIn .6s var(--ease) .7s forwards}
.de-grid{display:grid;gap:28px;align-items:start}@media(min-width:960px){.de-grid{grid-template-columns:minmax(0,1fr) 300px}.de-side{position:sticky;top:20px}}
.de-sec{padding:28px 0 4px}.de-sec h2{font-family:var(--font-hubot),system-ui;font-stretch:78%;font-weight:900;font-size:clamp(28px,6vw,42px);line-height:.98;margin-top:8px}
.de-video{margin-top:14px;border-radius:22px;overflow:hidden;background:var(--ink);aspect-ratio:16/9;max-width:640px}.de-video iframe,.de-video button{width:100%;height:100%;border:0;display:block}.de-video button{position:relative;padding:0;cursor:pointer;background:var(--ink)}
.de-video img{width:100%;height:100%;object-fit:cover;opacity:.85}.de-video button span{position:absolute;inset:0;margin:auto;width:64px;height:64px;border-radius:50%;background:var(--g);color:var(--gi);display:grid;place-items:center}.de-video button span .dx-ico{fill:currentColor;stroke:none;width:24px;height:24px}
.de-facts{list-style:none;padding:0;margin:16px 0 0;display:grid;gap:10px}.de-facts li{display:grid;gap:8px;padding:16px;border-radius:18px;background:var(--card);border:1px solid var(--line)}
.de-facts b{display:flex;gap:10px;align-items:flex-start;font-size:16px;line-height:1.4}.de-facts b .dx-ico{color:var(--gi);margin-top:2px}.de-facts span{display:flex;gap:8px;font-size:13.5px;color:var(--dim);line-height:1.45}.de-facts span .dx-ico{width:15px;height:15px;margin-top:2px}
.de-price{margin-top:12px;font-size:15px;line-height:1.5}.de-price span{color:var(--dim)}
.de-chips{list-style:none;padding:0;margin:14px 0 0;display:flex;gap:8px;flex-wrap:wrap}.de-chips li{padding:10px 14px;border-radius:999px;background:var(--card);border:1px solid var(--line);font-weight:700;font-size:14.5px}
.de-steps{list-style:none;padding:0;margin:16px 0 0;display:grid;gap:10px}.de-steps li{display:grid;grid-template-columns:40px 1fr;gap:12px;align-items:start;padding:15px 16px;border-radius:18px;background:var(--card);border:1px solid var(--line);font-size:16px;line-height:1.45}
.de-steps span{font-family:var(--font-mona),system-ui;font-stretch:80%;font-weight:900;font-size:24px;line-height:1;color:var(--gi)}
.de-take>p{font-size:clamp(18px,3.6vw,21px);line-height:1.55;margin-top:12px;max-width:52ch}.de-two{display:grid;gap:12px;margin-top:16px}@media(min-width:640px){.de-two{grid-template-columns:1fr 1fr}}
.de-two>div{padding:16px;border-radius:18px;background:var(--card);border:1px solid var(--line)}.de-two ul{list-style:none;padding:0;margin:10px 0 0;display:grid;gap:8px}.de-two li{display:flex;gap:10px;font-size:15px;line-height:1.45}.de-two li .dx-ico{color:var(--gi);margin-top:2px}
.de-faq{display:grid;gap:8px;margin-top:14px}.de-faq details{padding:16px;border-radius:16px;background:var(--card);border:1px solid var(--line)}.de-faq summary{cursor:pointer;font-weight:700;font-size:16px}.de-faq p{margin-top:10px;line-height:1.55;color:var(--dim)}
.de-note{margin-top:22px;font-size:13px;color:var(--dim);line-height:1.5;max-width:60ch}
.de-offer{display:grid;gap:10px;padding:20px;border-radius:22px;background:var(--ink);color:var(--paper)}.de-offer .dx-eb{color:var(--g)}.de-offer b{font-family:var(--font-hubot),system-ui;font-stretch:80%;font-weight:900;font-size:28px;line-height:1}.de-offer p{font-size:14.5px;line-height:1.5;color:rgba(242,239,233,.75)}
.de-rel{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-top:14px}.de-rel a{display:grid;gap:8px;align-content:start;text-decoration:none;transition:transform .25s var(--ease),border-color .25s}.de-rel a:hover{transform:translateY(-3px);border-color:var(--gi)}.de-rel b{font-size:17px}.de-rel p{font-size:14px;color:var(--dim);line-height:1.45}.de-rel .dx-badge{justify-self:start}`
