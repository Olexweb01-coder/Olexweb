'use client'
// Like, save and share on an article, plus real-only proof (badge, readers, reading now). No sign-up, no cookies:
// likes and saves are remembered on the reader's own device; the server keeps only anonymous daily totals.
import { useEffect, useRef, useState, useCallback } from 'react'

const LIKED = 'olx-liked', SAVED = 'olx-saved'
const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]') } catch { return [] } }
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }
const send = (body) => { try { fetch('/api/blog/event', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {}) } catch {} }
let statsPromise = null
const getStats = (slug) => (statsPromise ||= fetch('/api/blog/stats?slugs=' + slug).then((r) => r.json()).then((j) => (j.posts || {})[slug] || {}).catch(() => ({})))

const Heart = ({ on }) => <svg width="19" height="19" viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
const Mark = ({ on }) => <svg width="19" height="19" viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z" /></svg>
const ShareIc = () => <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 13v6h14v-6" /></svg>

function useArticle({ slug, title, summary, minutes }) {
  const [liked, setLiked] = useState(false), [saved, setSaved] = useState(false), [stats, setStats] = useState({})
  const likedAtLoad = useRef(null)                                  // already in the server's count if they liked on an earlier visit
  useEffect(() => {
    const sync = () => { const l = read(LIKED).includes(slug); if (likedAtLoad.current === null) likedAtLoad.current = l; setLiked(l); setSaved(read(SAVED).some((s) => s.slug === slug)) }
    sync(); window.addEventListener('olx-engage', sync); window.addEventListener('storage', sync)
    getStats(slug).then(setStats)
    return () => { window.removeEventListener('olx-engage', sync); window.removeEventListener('storage', sync) }
  }, [slug])
  const toggleLike = useCallback(() => {
    const now = !read(LIKED).includes(slug)
    write(LIKED, now ? [...read(LIKED), slug] : read(LIKED).filter((s) => s !== slug))
    send({ slug, type: now ? 'like' : 'unlike' }); window.dispatchEvent(new Event('olx-engage'))
  }, [slug])
  const toggleSave = useCallback(() => {
    const list = read(SAVED), now = !list.some((s) => s.slug === slug)
    write(SAVED, now ? [{ slug, title, summary, minutes, at: Date.now() }, ...list].slice(0, 200) : list.filter((s) => s.slug !== slug))
    send({ slug, type: now ? 'save' : 'unsave' }); window.dispatchEvent(new Event('olx-engage'))
  }, [slug, title, summary, minutes])
  const likeCount = stats.likes != null ? Math.max(0, stats.likes + (liked ? 1 : 0) - (likedAtLoad.current ? 1 : 0)) : null   // +1 straight away when they tap
  return { liked, saved, stats, likeCount, toggleLike, toggleSave }
}

function ShareGrid({ slug, title, url, onDone }) {
  const [copied, setCopied] = useState(false), [native, setNative] = useState(false)
  useEffect(() => { setNative(typeof navigator !== 'undefined' && !!navigator.share) }, [])
  const tag = (s) => url + '?utm_source=' + s, e = encodeURIComponent
  const apps = [['whatsapp', 'WhatsApp', 'https://wa.me/?text=' + e(title + ' ' + tag('whatsapp'))], ['linkedin', 'LinkedIn', 'https://www.linkedin.com/sharing/share-offsite/?url=' + e(tag('linkedin'))],
    ['facebook', 'Facebook', 'https://www.facebook.com/sharer/sharer.php?u=' + e(tag('facebook'))], ['x', 'X', 'https://x.com/intent/post?url=' + e(tag('x')) + '&text=' + e(title)]]
  async function copy() {
    try { await navigator.clipboard.writeText(url) } catch { const t = document.createElement('textarea'); t.value = url; document.body.appendChild(t); t.select(); try { document.execCommand('copy') } catch {} t.remove() }
    setCopied(true); send({ slug, type: 'share', app: 'copy' }); setTimeout(() => setCopied(false), 2400)
  }
  async function more() { try { await navigator.share({ title, url }); send({ slug, type: 'share', app: 'more' }); onDone && onDone() } catch {} }
  return (<div className="olx-grid">
    {apps.map(([k, label, href]) => <a key={k} href={href} target="_blank" rel="noopener noreferrer" onClick={() => { send({ slug, type: 'share', app: k }); onDone && onDone() }}>{label}</a>)}
    <button type="button" onClick={copy} className={copied ? 'on' : ''}>{copied ? 'Link copied' : 'Copy link'}</button>
    {native ? <button type="button" onClick={more}>More apps</button> : null}
  </div>)
}

export default function ArticleSocial(props) {
  const { part, slug, title, url } = props
  const a = useArticle(props)
  const [sheet, setSheet] = useState(false), [bar, setBar] = useState(false), [reading, setReading] = useState(null)
  const row = useRef(null)

  useEffect(() => {                                                    // the view, the "read", and "reading now" (top part only)
    if (part !== 'top') return
    const p = new URLSearchParams(location.search)
    send({ slug, type: 'view', ref: document.referrer, utm: p.get('utm_source') || '' })
    const t0 = Date.now(); let readSent = false
    const onScroll = () => {
      const art = document.querySelector('.art') || document.body, r = art.getBoundingClientRect()
      const seen = (innerHeight - r.top) / Math.max(r.height, 1)
      if (!readSent && seen >= 0.75 && Date.now() - t0 > 10000) { readSent = true; send({ slug, type: 'read' }) }
      if (row.current) setBar(row.current.getBoundingClientRect().bottom < 0)
    }
    const ping = () => { if (document.visibilityState !== 'visible') return
      fetch('/api/blog/presence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug }) }).then((r) => r.json()).then((j) => setReading(j.reading)).catch(() => {}) }
    ping(); const timer = setInterval(ping, 30000)
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll()
    return () => { clearInterval(timer); window.removeEventListener('scroll', onScroll) }
  }, [part, slug])
  useEffect(() => { if (!sheet) return; const k = (e) => { if (e.key === 'Escape') setSheet(false) }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [sheet])

  const likeLabel = (short) => (a.likeCount != null ? String(a.likeCount) : short ? 'Like' : 'Like')
  if (part === 'end') return (<section className="olx-end" aria-labelledby="olxHelp"><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <h2 id="olxHelp">Did this help?</h2>
    <p>A like tells Olaitan what to write more of. No sign-up needed.</p>
    <div className="olx-row">
      <button type="button" className="olx-big" aria-pressed={a.liked} onClick={a.toggleLike}><Heart on={a.liked} />{a.liked ? 'You liked this' : 'Like this article'}</button>
      <button type="button" className="olx-pill" aria-pressed={a.saved} onClick={a.toggleSave}><Mark on={a.saved} />{a.saved ? 'Saved for later' : 'Save for later'}</button>
    </div>
    <p className="olx-k">Share it</p>
    <ShareGrid slug={slug} title={title} url={url} />
  </section>)

  const s = a.stats
  return (<>
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    {s.badge || s.reads || reading ? <div className="olx-proof">
      {s.badge ? <span className="olx-badge">{s.badge}</span> : null}
      {s.reads ? <span className="olx-chip">{s.reads} reads</span> : null}
      {reading ? <span className="olx-chip"><i aria-hidden="true" />{reading} reading now</span> : null}
    </div> : null}
    <div className="olx-actions" ref={row}>
      <button type="button" className={'olx-pill' + (a.liked ? ' on' : '')} aria-pressed={a.liked} aria-label="Like this article" onClick={a.toggleLike}><Heart on={a.liked} />{likeLabel()}</button>
      <button type="button" className={'olx-pill' + (a.saved ? ' on' : '')} aria-pressed={a.saved} aria-label="Save for later" onClick={a.toggleSave}><Mark on={a.saved} />{a.saved ? 'Saved' : 'Save'}</button>
      <button type="button" className="olx-pill olx-push" onClick={() => setSheet(true)}><ShareIc />Share</button>
    </div>
    <div className={'olx-bar' + (bar && !sheet ? ' show' : '')} aria-hidden={!bar}>
      <button type="button" className={a.liked ? 'on' : ''} aria-pressed={a.liked} aria-label="Like this article" tabIndex={bar ? 0 : -1} onClick={a.toggleLike}><Heart on={a.liked} />{likeLabel(true)}</button>
      <button type="button" className={a.saved ? 'on' : ''} aria-pressed={a.saved} aria-label="Save for later" tabIndex={bar ? 0 : -1} onClick={a.toggleSave}><Mark on={a.saved} />{a.saved ? 'Saved' : 'Save'}</button>
      <button type="button" tabIndex={bar ? 0 : -1} onClick={() => setSheet(true)}><ShareIc />Share</button>
    </div>
    {sheet ? <div className="olx-scrim" onClick={(e) => { if (e.target === e.currentTarget) setSheet(false) }}>
      <div className="olx-sheet" role="dialog" aria-modal="true" aria-labelledby="olxShareT">
        <div className="olx-sheet-top"><h2 id="olxShareT">Share this article</h2><button type="button" aria-label="Close" onClick={() => setSheet(false)}>&times;</button></div>
        <ShareGrid slug={slug} title={title} url={url} onDone={() => setSheet(false)} />
      </div></div> : null}
  </>)
}

const CSS = `
.olx-proof{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 0}
.olx-badge{display:inline-flex;align-items:center;height:30px;padding:0 11px;border-radius:999px;background:var(--green,#8fe36a);color:#0e1a0b;font-size:13px;font-weight:700}
.olx-chip{display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 11px;border-radius:999px;border:1px solid rgba(242,239,233,.16);font-size:13px;font-weight:600;color:rgba(242,239,233,.85)}
.olx-chip i{width:8px;height:8px;border-radius:50%;background:var(--green,#8fe36a);box-shadow:0 0 0 4px rgba(143,227,106,.18)}
.olx-actions{display:flex;flex-wrap:wrap;gap:8px;margin:20px 0 6px;padding:12px 0;border-top:1px solid rgba(242,239,233,.11);border-bottom:1px solid rgba(242,239,233,.11)}
.olx-pill{appearance:none;height:44px;padding:0 16px;border-radius:999px;border:1px solid rgba(242,239,233,.18);background:transparent;color:var(--paper,#f2efe9);font:inherit;font-size:15px;font-weight:600;display:inline-flex;align-items:center;gap:8px;cursor:pointer}
.olx-pill.on,.olx-pill[aria-pressed="true"]{border-color:rgba(143,227,106,.5);background:rgba(143,227,106,.12);color:var(--green,#8fe36a)}
.olx-push{margin-left:auto}
.olx-bar{position:fixed;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 14px);z-index:50;height:60px;border-radius:20px;background:rgba(18,20,18,.94);border:1px solid rgba(242,239,233,.14);box-shadow:0 16px 40px rgba(0,0,0,.5);display:none;align-items:center;justify-content:space-around;transform:translateY(130%);transition:transform .35s cubic-bezier(.16,1,.3,1)}
.olx-bar button{appearance:none;min-width:88px;height:44px;border:0;background:transparent;color:var(--paper,#f2efe9);font:inherit;font-size:15px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:7px;cursor:pointer}
.olx-bar button.on{color:var(--green,#8fe36a)}
@media (max-width:820px){.olx-bar{display:flex;left:calc(clamp(14px,2.2vw,28px) + 60px);right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 9px)}.olx-bar.show{transform:none}.olx-bar button{min-width:0;flex:1}}
/* the site's sound button keeps its corner; its label steps aside while the bar is showing */
body:has(.olx-bar.show) .sound-tip{opacity:0!important;pointer-events:none}
@media (prefers-reduced-motion:reduce){.olx-bar{transition:none}}
.olx-end{margin:40px 0 0;padding:26px 22px;border-radius:24px;background:#121412;border:1px solid rgba(242,239,233,.11);display:flex;flex-direction:column;gap:16px}
.olx-end h2{margin:0!important;font-family:var(--display);font-weight:800;font-stretch:88%;font-size:26px;line-height:1.05}
.olx-end p{margin:0;font-size:15px;line-height:1.55;color:rgba(242,239,233,.66)}
.olx-end .olx-k{margin-top:6px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(242,239,233,.5)}
.olx-row{display:flex;gap:10px;flex-wrap:wrap}
.olx-big{appearance:none;height:48px;padding:0 20px;border-radius:999px;border:0;background:var(--green,#8fe36a);color:#0e1a0b;font:inherit;font-size:15px;font-weight:700;display:inline-flex;align-items:center;gap:8px;cursor:pointer}
.olx-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.olx-grid a,.olx-grid button{appearance:none;height:46px;border-radius:14px;border:1px solid rgba(242,239,233,.14);background:transparent;color:var(--paper,#f2efe9);display:flex;align-items:center;justify-content:center;text-decoration:none;font:inherit;font-size:14px;font-weight:600;cursor:pointer}
.olx-grid button.on{background:var(--green,#8fe36a);border-color:transparent;color:#0e1a0b}
.olx-scrim{position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center}
.olx-sheet{width:min(560px,100%);background:#121412;border:1px solid rgba(242,239,233,.14);border-radius:26px 26px 0 0;padding:18px 20px calc(env(safe-area-inset-bottom,0px) + 26px);display:flex;flex-direction:column;gap:16px}
@media (min-width:821px){.olx-scrim{align-items:center}.olx-sheet{border-radius:26px}}
.olx-sheet-top{display:flex;align-items:center;justify-content:space-between}
.olx-sheet-top h2{margin:0!important;font-family:var(--display);font-weight:800;font-stretch:88%;font-size:24px}
.olx-sheet-top button{appearance:none;width:44px;height:44px;border-radius:50%;border:1px solid rgba(242,239,233,.14);background:transparent;color:var(--paper,#f2efe9);font-size:22px;cursor:pointer}
`
