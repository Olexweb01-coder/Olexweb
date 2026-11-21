'use client'
// olexweb.com/tools: search and browse every Directory post (Install 16: tools, tech updates, how-tos and safety alerts;
// /updates, /guides and /alerts show one kind each).
import { VERIFIED_HTML } from '@/lib/site/trust'   // Install 46
import { useEffect, useMemo, useState } from 'react'
import { DIR_CSS, PRICE } from './dirStyles'

const KPATH = { tool: 'tools', update: 'updates', guide: 'guides', alert: 'alerts', story: 'stories' }
const KNAME = { tool: 'Tool', update: 'Tech update', guide: 'How-to', alert: 'Safety alert', story: 'Tech story' }
const KTABS = [['/tools', 'Everything', null], ['/tools?kind=tool', 'Tools', 'tool'], ['/stories', 'Tech stories', 'story'], ['/updates', 'Tech updates', 'update'], ['/guides', 'How-tos', 'guide'], ['/alerts', 'Safety alerts', 'alert']]
// Install 27: filter by topic (lib/site/dirnews.js TOPICS)
const TOPICS = [['tools', 'Tools'], ['hot', 'Hot news'], ['space', 'Space'], ['history', 'History'], ['ai', 'AI'], ['phones', 'Phones & gadgets'], ['security', 'Security'],
  ['sport', 'Sport tech'], ['gaming', 'Gaming'], ['science', 'Science & future'], ['africa', 'Africa tech'], ['apps', 'Apps & internet'], ['howto', 'How-to']]
const topicOf = (e) => (TOPICS.some((t) => t[0] === e.topic) ? e.topic : ({ tool: 'tools', guide: 'howto', alert: 'security' })[e.kind || 'tool'] || 'hot')
const today = () => new Date(Date.now() + 3600e3).toISOString().slice(0, 10)
export default function DirLibrary({ entries: all, kind: fixed = null, heading = null }) {
  // /tools?kind=tool shows only the tools (the footer's Tools link)
  const [only, setOnly] = useState(null)
  const [topic, setTopic] = useState('all')
  useEffect(() => { const p = new URLSearchParams(location.search); if (!fixed && p.get('kind') === 'tool') setOnly('tool'); if (TOPICS.some((t) => t[0] === p.get('topic'))) setTopic(p.get('topic')) }, [fixed])
  const kind = fixed || only, base = useMemo(() => (only ? all.filter((e) => (e.kind || 'tool') === 'tool') : all), [all, only])
  const topics = useMemo(() => TOPICS.filter(([k]) => base.some((e) => topicOf(e) === k)), [base])
  const entries = useMemo(() => (topic === 'all' ? base : base.filter((e) => topicOf(e) === topic)), [base, topic])
  const pickTopic = (k) => { setTopic(k); try { const u = new URL(location.href); if (k === 'all') u.searchParams.delete('topic'); else u.searchParams.set('topic', k); history.replaceState(null, '', u) } catch {} }
  const [q, setQ] = useState(''), [cat, setCat] = useState('All'), [price, setPrice] = useState('all')
  // Install 32: the day's new tools first (or the newest ones, early in the day)
  const tools = useMemo(() => all.filter((e) => (e.kind || 'tool') === 'tool').sort((a, b) => String(b.published_at || '').localeCompare(String(a.published_at || ''))), [all])
  const todays = tools.filter((e) => e.published_at && new Date(new Date(e.published_at).getTime() + 3600e3).toISOString().slice(0, 10) === today())
  const freshToday = todays.length >= 3, freshTools = (freshToday ? todays : tools).slice(0, 10)
  const cats = useMemo(() => ['All', ...[...new Set(entries.map((e) => e.category).filter(Boolean))].slice(0, 14)], [entries])
  const list = useMemo(() => { const n = q.trim().toLowerCase(); return entries.filter((e) => (cat === 'All' || e.category === cat) && (price === 'all' || (price === 'free' ? ['free', 'freemium'].includes(e.price) : e.price === price))
    && (!n || [e.name, e.one, e.category, ...(e.tags || [])].join(' ').toLowerCase().includes(n))) }, [entries, q, cat, price])
  return (<div className="dx">
    <style dangerouslySetInnerHTML={{ __html: DIR_CSS + CSS }} />
    <div className="dx-w"><header className="dx-bar"><a className="dx-mark" href="/" aria-label="Olexweb, home"><img src="/studio/mark.png" alt="" width="21" height="24" />Olexweb</a><nav className="dx-nav"><a href="/tools" aria-current={kind ? undefined : 'page'}>Directory</a><a href="/aoc">Free course</a></nav></header>
      <section className="dl-hero"><span className="dx-eb">The Olexweb Directory</span>
        {heading ? <h1 className="dx-h1 dl-h1k">{heading[0]}</h1>
          : <h1 className="dx-h1"><span className="dx-ln"><span>Useful tech,</span></span><span className="dx-ln"><span style={{ animationDelay: '.1s' }}>explained <span className="dl-hl">clearly.</span></span></span></h1>}
        <p className="dx-lede">{heading ? heading[1] : 'New tools before everyone else, the big tech stories (space, AI, phones, tech in sport), tech history, how-tos and scam alerts. New tools every day and new posts all day, every fact checked.'}</p>
        <nav className="dl-kinds" aria-label="What to show">{KTABS.map(([h, l, k]) => <a key={h} href={h} aria-current={kind === k ? 'page' : undefined}>{l}</a>)}</nav>
        {topics.length > 1 ? <div className="dl-topics" role="group" aria-label="Topics"><button className={topic === 'all' ? 'on' : ''} aria-pressed={topic === 'all'} onClick={() => pickTopic('all')}>All</button>{topics.map(([k, l]) => <button key={k} className={topic === k ? 'on' : ''} aria-pressed={topic === k} onClick={() => pickTopic(k)}>{l}</button>)}</div> : null}
        <div className="dl-search"><svg className="dx-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={kind === 'alert' ? 'Search alerts: “WhatsApp”, “bank”, “job offer”…' : kind ? 'Search: “WhatsApp”, “Android”, “AI”…' : 'Search: “remove background”, “WhatsApp”, “scam”…'} aria-label="Search the directory" /></div>
        <div className="dl-filters">{cats.length > 2 ? <div className="dl-chips">{cats.map((c) => <button key={c} className={cat === c ? 'on' : ''} aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}</div> : null}
          {kind === 'tool' || topic === 'tools' ? <div className="dl-chips">{[['all', 'Any price'], ['free', 'Free to start'], ['paid', 'Paid']].map(([k, l]) => <button key={k} className={price === k ? 'on' : ''} aria-pressed={price === k} onClick={() => setPrice(k)}>{l}</button>)}</div> : null}</div>
      </section>
      {!kind ? <a className="dl-own" href="/tools/graceville-fast-bible"><span className="dl-own-ic" aria-hidden="true">✦</span><span><small>Made by Olexweb · Private</small><b>Graceville Fast Bible</b><span>Scripture on screen the moment it’s preached. For Graceville’s media team.</span></span><span className="dl-own-go" aria-hidden="true">→</span></a> : null}
      <style>{`.dl-own{display:flex;gap:16px;align-items:center;margin:4px 0 18px;padding:18px 20px;border-radius:22px;text-decoration:none;color:#f2efe9;background:#0a0b0a;border:1px solid rgba(143,227,106,.4)}
.dl-own-ic{display:grid;place-items:center;flex:none;width:48px;height:48px;border-radius:14px;background:#8fe36a;color:#0e1a0b;font-size:22px}.dl-own small{display:block;color:#8fe36a;font-weight:700;letter-spacing:.06em;text-transform:uppercase;font-size:11.5px}
.dl-own b{display:block;font-size:19px;margin:2px 0}.dl-own span span{color:#c9c6bf;font-size:14.5px}.dl-own-go{margin-left:auto;font-size:22px;color:#8fe36a}`}</style>
      {!fixed && topic === 'all' && !q && freshTools.length ? <section className="dl-fresh" aria-label={freshToday ? 'New tools today' : 'Newest tools'}>
        <h2>{freshToday ? <>New tools today <span>{freshTools.length}</span></> : 'Newest tools'}</h2>
        <div className="dl-frow">{freshTools.map((e) => <a key={e.slug} href={'/tools/' + e.slug} className="dl-fcard"><span className={'dx-badge dx-' + (e.price || 'unknown')}>{PRICE[e.price || 'unknown']}</span><b>{e.name}</b><p>{e.one}</p></a>)}</div>
      </section> : null}
      <p className="dl-count">{list.length} {kind ? KNAME[kind].toLowerCase() + (list.length === 1 ? '' : 's') : list.length === 1 ? 'post' : 'posts'}</p>
      <div className="dl-grid">{list.map((e, i) => { const k = e.kind || 'tool', fresh = e.published_at && new Date(new Date(e.published_at).getTime() + 3600e3).toISOString().slice(0, 10) === today()
        return <a key={k + e.slug} href={'/' + KPATH[k] + '/' + e.slug} className="dx-card dl-card" style={{ animationDelay: Math.min(i, 12) * 0.04 + 's' }}>
        <span className="dl-top">{k === 'tool' ? <span className={'dx-badge dx-' + (e.price || 'unknown')}>{PRICE[e.price || 'unknown']}</span> : <span className={'dl-kind dl-' + k}>{KNAME[k]}</span>}{fresh ? <span className="dl-new">New today</span> : null}</span>
        <b>{e.name}</b><p>{e.one}</p>{k === 'tool' && e.category ? <span className="dl-cat">{e.category}</span> : <span className="dl-cat">{(TOPICS.find((t) => t[0] === topicOf(e)) || [])[1]}</span>}</a> })}</div>
      {!list.length ? <p className="dl-empty">{entries.length ? 'Nothing matches that yet. Try a simpler word.' : 'The first tools are being written and checked. Come back soon.'}</p> : null}
      <footer className="dx-foot"><span>© {new Date().getFullYear()} Olexweb · Olaitan Adebayo</span><span><a href="/">olexweb.com</a> · <a href="/privacy">Privacy</a></span><span style={{ flexBasis: '100%' }} dangerouslySetInnerHTML={{ __html: VERIFIED_HTML }} /></footer>
    </div>
  </div>)
}
const CSS = `
.dl-fresh{margin:6px 0 22px}.dl-fresh h2{font:800 22px/1.1 var(--font-mona),system-ui;margin:0 0 12px;display:flex;align-items:center;gap:10px}
.dl-fresh h2 span{font-size:13px;padding:3px 10px;border-radius:999px;background:var(--g);color:#0e1a0b}
.dl-frow{display:flex;gap:12px;overflow-x:auto;padding-bottom:6px;scroll-snap-type:x mandatory}.dl-frow::-webkit-scrollbar{height:6px}
.dl-fcard{flex:0 0 240px;scroll-snap-align:start;display:flex;flex-direction:column;gap:6px;padding:16px;border:1px solid var(--line);border-radius:18px;background:#fff;color:var(--ink);text-decoration:none}
.dl-fcard b{font-size:17px}.dl-fcard p{margin:0;font-size:14px;line-height:1.45;color:var(--dim);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.dl-fcard .dx-badge{width:fit-content}
.dl-topics{display:flex;gap:8px;overflow-x:auto;margin-top:12px;padding-bottom:2px;scrollbar-width:none}.dl-topics::-webkit-scrollbar{display:none}
.dl-topics button{flex:none;padding:8px 14px;border-radius:999px;border:1px solid var(--line);background:#fff;color:var(--ink);font:800 13.5px var(--font-mona),system-ui;cursor:pointer}
.dl-topics button.on{background:var(--g);border-color:var(--g);color:#0e1a0b}
.dl-kinds{display:flex;gap:8px;overflow-x:auto;margin-top:18px;padding-bottom:2px}.dl-kinds a{flex:none;padding:10px 16px;border-radius:999px;border:1px solid var(--line);font-weight:800;font-size:14.5px;text-decoration:none;color:var(--ink)}
.dl-kinds a[aria-current=page]{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.dl-h1k{font-size:clamp(40px,8vw,84px);line-height:.95;max-width:16ch}
.dl-top{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.dl-kind{display:inline-flex;padding:5px 10px;border-radius:999px;font-size:11.5px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
.dl-update{background:#dff1ff;color:#0b3a5c}.dl-story{background:#fff1cc;color:#5a3d00}.dl-guide{background:#e8f8df;color:#173d0b}.dl-alert{background:#ffe2dc;color:#6a1405}
.dl-new{font-size:11.5px;font-weight:900;color:#173d0b;background:var(--g);padding:5px 10px;border-radius:999px}
.dl-hero{padding:24px 0 10px}.dl-hl{position:relative;z-index:0}.dl-hl::before{content:"";position:absolute;left:-.04em;right:-.06em;bottom:.08em;height:.34em;background:var(--g);z-index:-1;transform:scaleX(0);transform-origin:left;animation:dlSweep .7s var(--ease) .9s forwards}@keyframes dlSweep{to{transform:scaleX(1)}}
.dl-search{display:flex;gap:12px;align-items:center;margin-top:24px;padding:6px 6px 6px 18px;border-radius:999px;background:#fff;border:1px solid var(--line);box-shadow:0 20px 40px -30px rgba(10,11,10,.4);max-width:680px;opacity:0;animation:dxIn .6s var(--ease) .65s forwards}
.dl-search input{flex:1;min-width:0;padding:14px 4px;border:0;background:transparent;font:500 16px var(--font-mona),system-ui;color:var(--ink);outline:0}.dl-search .dx-ico{color:var(--dim)}
.dl-filters{display:grid;gap:10px;margin-top:18px}.dl-chips{display:flex;gap:8px;flex-wrap:nowrap;overflow-x:auto;padding-bottom:2px}.dl-chips button{flex:none;padding:9px 14px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--ink);font:700 14px var(--font-mona),system-ui;cursor:pointer;transition:background .2s,color .2s}.dl-chips button.on{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.dl-count{margin:22px 0 10px;font-size:13.5px;color:var(--dim)}
.dl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}.dl-card{display:grid;gap:8px;align-content:start;text-decoration:none;opacity:0;transform:translateY(10px);animation:dxIn .5s var(--ease) forwards;transition:transform .25s var(--ease),border-color .25s}
.dl-card:hover{transform:translateY(-3px);border-color:var(--gi)}.dl-card b{font-size:18px}.dl-card p{font-size:14.5px;line-height:1.45;color:var(--dim)}.dl-card .dx-badge{justify-self:start}.dl-cat{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--gi)}
.dl-empty{padding:30px 0;color:var(--dim)}`
