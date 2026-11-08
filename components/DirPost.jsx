'use client'
// One news-side Directory post (Install 16): a tech update, a how-to or a safety alert. What it is, the key points, why it
// matters, what to do (steps), the facts in the article's own words (credited), questions, sharing, and one next step.
import { useEffect } from 'react'
import { DIR_CSS } from './dirStyles'
import { ENTRY_CSS } from './DirEntry'
import DirShare from './DirShare'

const NAME = { update: 'Tech update', guide: 'How-to', alert: 'Safety alert' }
const PATH = { update: 'updates', guide: 'guides', alert: 'alerts' }
const POINTS = { update: 'What changed', guide: 'What it helps with', alert: 'How to spot it' }
const TODO = { update: 'What to do', guide: 'Step by step', alert: 'Protect yourself' }
const beacon = (slug, lead) => { try { fetch('/api/dir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, lead }), keepalive: true }).catch(() => {}) } catch {} }

export default function DirPost({ e }) {
  const c = e.content || {}, path = '/' + PATH[e.kind] + '/' + e.slug
  useEffect(() => { beacon(e.slug, false) }, [e.slug])
  const when = e.published_at ? new Date(e.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
  return (<div className="dx">
    <style dangerouslySetInnerHTML={{ __html: DIR_CSS + ENTRY_CSS + CSS }} />
    <div className="dx-w"><header className="dx-bar"><a className="dx-mark" href="/" aria-label="Olexweb, home"><img src="/studio/mark.png" alt="" width="21" height="24" />Olexweb</a><nav className="dx-nav"><a href="/tools">Directory</a><a href={'/' + PATH[e.kind]}>{NAME[e.kind]}s</a><a href={e.offer.href} onClick={() => beacon(e.slug, true)}>Free resources</a></nav></header>
      <nav className="de-crumb" aria-label="Breadcrumb"><a href="/tools">Directory</a><span>/</span><a href={'/' + PATH[e.kind]}>{NAME[e.kind]}s</a><span>/</span><span aria-current="page">{c.title}</span></nav>
      <section className="de-hero">
        <div className="de-meta"><span className={'dp-kind dp-' + e.kind}>{NAME[e.kind]}</span>{when ? <span className="dx-eb">{when}</span> : null}</div>
        <h1 className="dx-h1 dp-h1">{c.title}</h1>
        <p className="dx-lede">{c.summary}</p>
        <DirShare path={path} title={c.title} />
      </section>
      <div className="de-grid">
        <main className="de-main">
          <section className="de-sec"><span className="dx-eb">{POINTS[e.kind]}</span><ul className="dp-points">{(c.points || []).map((x, i) => <li key={i}>{x}</li>)}</ul></section>
          {c.whyItMatters ? <section className="de-sec de-take"><span className="dx-eb">Why it matters</span><p>{c.whyItMatters}</p></section> : null}
          <section className="de-sec" id="do"><span className="dx-eb">{TODO[e.kind]}</span><ol className="de-steps">{(c.whatToDo || []).map((x, i) => <li key={i}><span>{String(i + 1).padStart(2, '0')}</span>{x}</li>)}</ol></section>
          <section className="de-sec"><span className="dx-eb">The facts</span><h2>In the source’s own words</h2>
            <ul className="de-facts">{(c.facts || []).map((f, i) => <li key={i}><b>{f.claim}</b><span>“{f.quote}”, {e.source}</span></li>)}</ul></section>
          {(c.faq || []).length ? <section className="de-sec"><span className="dx-eb">Questions</span><div className="de-faq">{c.faq.map((f, i) => <details key={i} open={i === 0}><summary>{f.q}</summary><p>{f.a}</p></details>)}</div></section> : null}
          <p className="de-note">Written by Olexweb in our own words, based on reporting by <a href={e.url} target="_blank" rel="noopener nofollow">{e.source}</a>{when ? ' (' + when + ')' : ''}. Every fact is quoted from that source. Things change: check the source before you rely on details.</p>
        </main>
        <aside className="de-side"><div className="de-offer"><span className="dx-eb">Free from Olaitan</span><b>{e.offer.title}</b><p>{e.offer.line}</p><a className="dx-btn dx-g" href={e.offer.href + (e.offer.href.includes('?') ? '&' : '?') + 'from=' + PATH[e.kind] + '-' + e.slug} onClick={() => beacon(e.slug, true)}>{e.offer.kind === 'link' ? 'Join on WhatsApp' : 'Get it free'}</a></div></aside>
      </div>
      {(e.related || []).length ? <section className="de-sec"><span className="dx-eb">More {NAME[e.kind].toLowerCase()}s</span><div className="de-rel">{e.related.map((r) => <a key={r.slug} href={'/' + PATH[e.kind] + '/' + r.slug} className="dx-card"><b>{r.name}</b><p>{r.one}</p></a>)}</div></section> : null}
      <footer className="dx-foot"><span>© {new Date().getFullYear()} Olexweb · Olaitan Adebayo</span><span><a href="/tools">The Directory</a> · <a href="/privacy">Privacy</a></span></footer>
    </div>
  </div>)
}
const CSS = `
.dp-h1{font-size:clamp(34px,7vw,64px);line-height:.98;max-width:22ch}
.dp-kind{display:inline-flex;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}
.dp-update{background:#dff1ff;color:#0b3a5c}.dp-guide{background:#e8f8df;color:#173d0b}.dp-alert{background:#ffe2dc;color:#6a1405}.dp-tool{background:#efe9ff;color:#2d1a66}
.dp-points{list-style:none;padding:0;margin:14px 0 0;display:grid;gap:10px}.dp-points li{padding:15px 16px;border-radius:18px;background:var(--card);border:1px solid var(--line);font-size:16px;line-height:1.5}
.de-note a{color:inherit}`
