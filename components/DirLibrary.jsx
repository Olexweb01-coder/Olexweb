'use client'
// olexweb.com/tools: search and browse every Directory page.
import { useMemo, useState } from 'react'
import { DIR_CSS, PRICE } from './dirStyles'

export default function DirLibrary({ entries }) {
  const [q, setQ] = useState(''), [cat, setCat] = useState('All'), [price, setPrice] = useState('all')
  const cats = useMemo(() => ['All', ...[...new Set(entries.map((e) => e.category).filter(Boolean))].slice(0, 14)], [entries])
  const list = useMemo(() => { const n = q.trim().toLowerCase(); return entries.filter((e) => (cat === 'All' || e.category === cat) && (price === 'all' || (price === 'free' ? ['free', 'freemium'].includes(e.price) : e.price === price))
    && (!n || [e.name, e.one, e.category, ...(e.tags || [])].join(' ').toLowerCase().includes(n))) }, [entries, q, cat, price])
  return (<div className="dx">
    <style dangerouslySetInnerHTML={{ __html: DIR_CSS + CSS }} />
    <div className="dx-w"><header className="dx-bar"><a className="dx-mark" href="/"><span><i /></span>Olexweb</a><nav className="dx-nav"><a href="/tools" aria-current="page">Directory</a><a href="/aoc">Free course</a></nav></header>
      <section className="dl-hero"><span className="dx-eb">The Olexweb Directory</span>
        <h1 className="dx-h1"><span className="dx-ln"><span>Useful tools,</span></span><span className="dx-ln"><span style={{ animationDelay: '.1s' }}>explained <span className="dl-hl">clearly.</span></span></span></h1>
        <p className="dx-lede">Websites, AI and tech tools for creators, students, freelancers and small businesses. What they do, if they’re free, and how to start. Every fact checked against the site itself.</p>
        <div className="dl-search"><svg className="dx-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tools: “remove background”, “diagram”, “resume”…" aria-label="Search the directory" /></div>
        <div className="dl-filters"><div className="dl-chips">{cats.map((c) => <button key={c} className={cat === c ? 'on' : ''} aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}</div>
          <div className="dl-chips">{[['all', 'Any price'], ['free', 'Free to start'], ['paid', 'Paid']].map(([k, l]) => <button key={k} className={price === k ? 'on' : ''} aria-pressed={price === k} onClick={() => setPrice(k)}>{l}</button>)}</div></div>
      </section>
      <p className="dl-count">{list.length} {list.length === 1 ? 'tool' : 'tools'}</p>
      <div className="dl-grid">{list.map((e, i) => <a key={e.slug} href={'/tools/' + e.slug} className="dx-card dl-card" style={{ animationDelay: Math.min(i, 12) * 0.04 + 's' }}>
        <span className={'dx-badge dx-' + (e.price || 'unknown')}>{PRICE[e.price || 'unknown']}</span><b>{e.name}</b><p>{e.one}</p>{e.category ? <span className="dl-cat">{e.category}</span> : null}</a>)}</div>
      {!list.length ? <p className="dl-empty">{entries.length ? 'Nothing matches that yet. Try a simpler word.' : 'The first tools are being written and checked. Come back soon.'}</p> : null}
      <footer className="dx-foot"><span>© {new Date().getFullYear()} Olexweb · Olaitan Adebayo</span><span><a href="/">olexweb.com</a> · <a href="/privacy">Privacy</a></span></footer>
    </div>
  </div>)
}
const CSS = `
.dl-hero{padding:24px 0 10px}.dl-hl{position:relative;z-index:0}.dl-hl::before{content:"";position:absolute;left:-.04em;right:-.06em;bottom:.08em;height:.34em;background:var(--g);z-index:-1;transform:scaleX(0);transform-origin:left;animation:dlSweep .7s var(--ease) .9s forwards}@keyframes dlSweep{to{transform:scaleX(1)}}
.dl-search{display:flex;gap:12px;align-items:center;margin-top:24px;padding:6px 6px 6px 18px;border-radius:999px;background:#fff;border:1px solid var(--line);box-shadow:0 20px 40px -30px rgba(10,11,10,.4);max-width:680px;opacity:0;animation:dxIn .6s var(--ease) .65s forwards}
.dl-search input{flex:1;min-width:0;padding:14px 4px;border:0;background:transparent;font:500 16px var(--font-mona),system-ui;color:var(--ink);outline:0}.dl-search .dx-ico{color:var(--dim)}
.dl-filters{display:grid;gap:10px;margin-top:18px}.dl-chips{display:flex;gap:8px;flex-wrap:nowrap;overflow-x:auto;padding-bottom:2px}.dl-chips button{flex:none;padding:9px 14px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--ink);font:700 14px var(--font-mona),system-ui;cursor:pointer;transition:background .2s,color .2s}.dl-chips button.on{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.dl-count{margin:22px 0 10px;font-size:13.5px;color:var(--dim)}
.dl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}.dl-card{display:grid;gap:8px;align-content:start;text-decoration:none;opacity:0;transform:translateY(10px);animation:dxIn .5s var(--ease) forwards;transition:transform .25s var(--ease),border-color .25s}
.dl-card:hover{transform:translateY(-3px);border-color:var(--gi)}.dl-card b{font-size:18px}.dl-card p{font-size:14.5px;line-height:1.45;color:var(--dim)}.dl-card .dx-badge{justify-self:start}.dl-cat{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--gi)}
.dl-empty{padding:30px 0;color:var(--dim)}`
