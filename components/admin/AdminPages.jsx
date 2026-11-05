'use client'
// Pages & links: every page (cards), "What are you making?" templates, and short links (olexweb.com/anything → WhatsApp or a website).
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from './ui'

const ICON = {
  audio: <><path d="M4.5 14v-2a7.5 7.5 0 0 1 15 0v2" /><rect x="3.5" y="13.5" width="4" height="6.5" rx="1.6" /><rect x="16.5" y="13.5" width="4" height="6.5" rx="1.6" /></>,
  webinar: <><rect x="3" y="4.5" width="18" height="12.5" rx="2.5" /><path d="M8.5 20.5h7M12 17v3.5" /></>,
  event: <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.4" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
}
const Ic = ({ n }) => <svg className="pg-ic" viewBox="0 0 24 24" aria-hidden="true">{ICON[n]}</svg>
const NAME = { audio: 'Audio course', webinar: 'Webinar', event: 'Event' }
const TPL = [['audio', 'Audio course', 'Recordings people unlock with their name, like Anatomy of Creation.'], ['webinar', 'Webinar', 'Date, time and topic; after sign-up, the details and your WhatsApp community.'],
  ['event', 'Event', 'Date, venue and map; after sign-up, the details and your community.'], ['link', 'Short link', 'olexweb.com/anything → WhatsApp or any website, with tap counts.']]
const SAY = { open: (g) => `Only ${g} slots`, few: () => 'Few spaces left', bonus: () => 'Bonus spots opened', closed: () => 'Sign-ups closed' }
const when = (w) => { const t = Date.parse(w + ':00+01:00'); return t ? new Date(t).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' }) : '' }

export default function AdminPages({ data }) {
  const router = useRouter(), [busy, setBusy] = useState(''), [err, setErr] = useState(''), [pick, setPick] = useState(null), [open, setOpen] = useState(false)
  const [lk, setLk] = useState(null)                     // the short link being edited
  async function call(body, ok) {
    setBusy(body.action); setErr('')
    try { const r = await fetch('/admin/api/pages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })
      const j = await r.json().catch(() => ({})); if (r.status === 401) { window.location.assign('/admin/login'); return null }
      if (!r.ok) { setErr(j.error || 'Something went wrong.'); return null } if (ok) toast(ok); return j }
    catch { setErr('No connection. Try again.'); return null } finally { setBusy('') }
  }
  async function create() {
    if (pick === 'link') { setOpen(false); setLk({ slug: '', phone: '', message: '', url: '', kind: 'wa', original: null }); return }
    const j = await call({ action: 'create', type: pick }); if (j && j.id) router.push('/admin/pages/' + j.id)
  }
  return (<>
    <div className="pg-top"><h1 className="d" style={{ margin: 0 }}>Pages &amp; links</h1><button className="btn btn-green" onClick={() => { setPick(null); setOpen(true) }}><Ic n="plus" />New page</button></div>
    {err ? <p className="err" role="alert">{err}</p> : null}
    <div className="pg-grid">
      {data.aoc ? <a className="pg-card" href="/admin/aoc"><span className="pg-ty"><Ic n="audio" />Audio course</span><b>Anatomy of Creation</b><span className="pg-u">olexweb.com/aoc</span>
        <span className={'pg-tag ' + (data.aoc.accepting ? 'live' : 'off')}>{data.aoc.accepting ? 'Live' : 'Sign-ups closed'}</span><span className="pg-st"><span><b>{data.aoc.joined}</b> joined</span><span><b>{data.aoc.feedback}</b> feedback</span></span></a> : null}
      {data.pages.map((p) => <a key={p.id} className="pg-card" href={'/admin/pages/' + p.id}><span className="pg-ty"><Ic n={p.type} />{NAME[p.type]}</span><b>{p.title || 'Untitled ' + NAME[p.type].toLowerCase()}</b><span className="pg-u">olexweb.com/{p.slug}</span>
        <span className={'pg-tag ' + (p.status === 'live' ? (p.stage === 'closed' ? 'off' : 'live') : 'draft')}>{p.status === 'live' ? `Live · ${SAY[p.stage](p.goal)}` : 'Draft · not public yet'}{p.when && p.status === 'live' ? ' · ' + when(p.when) : ''}</span>
        <span className="pg-st"><span><b>{p.signups}</b> signed up</span>{p.today ? <span><b>+{p.today}</b> today</span> : null}{p.feedback ? <span><b>{p.feedback}</b> feedback</span> : null}</span></a>)}
    </div>

    <section className="pg-links"><div className="pg-lh"><h2>Short links</h2><button className="btn btn-line" onClick={() => setLk({ slug: '', phone: '', message: '', url: '', kind: 'wa', original: null })}><Ic n="plus" />New short link</button></div>
      <div className="pg-lt">{data.links.map((l) => <div key={l.slug} className="pg-lr"><div><b>olexweb.com/{l.slug}</b><span>{l.phone ? `WhatsApp${l.message ? ' · “' + l.message.slice(0, 60) + (l.message.length > 60 ? '…' : '') + '”' : ''}` : l.url}</span></div>
        <span className="pg-taps"><b>{l.today}</b> today · {l.clicks} total</span>
        <span className="pg-la">{l.slug === 'me' ? <a className="btn btn-line" href="/admin/aoc">Edit</a> : <button className="btn btn-line" onClick={() => setLk({ slug: l.slug, phone: l.phone || '', message: l.message || '', url: l.url || '', kind: l.phone ? 'wa' : 'url', original: l.slug })}>Edit</button>}
          <button className="btn btn-line" onClick={() => { navigator.clipboard.writeText('https://olexweb.com/' + l.slug); toast('Link copied.') }}>Copy</button></span></div>)}</div></section>

    {open ? <div className="pg-ov" role="dialog" aria-modal="true" aria-label="New page" onClick={() => setOpen(false)}><div className="pg-dl" onClick={(e) => e.stopPropagation()}>
      <h3>What are you making?</h3><p>Pick a template. You can write it yourself or let AI draft it from your idea.</p>
      <div className="pg-tp">{TPL.map(([k, t, d]) => <button key={k} className={'pg-t' + (pick === k ? ' on' : '')} aria-pressed={pick === k} onClick={() => setPick(k)}><Ic n={k === 'link' ? 'link' : k} /><b>{t}</b><span>{d}</span></button>)}</div>
      <div className="pg-bt"><button className="btn btn-line" onClick={() => setOpen(false)}>Cancel</button><button className="btn btn-green" disabled={!pick || !!busy} onClick={create}>{busy === 'create' ? 'Creating…' : 'Continue'}</button></div></div></div> : null}

    {lk ? <div className="pg-ov" role="dialog" aria-modal="true" aria-label="Short link" onClick={() => setLk(null)}><div className="pg-dl" onClick={(e) => e.stopPropagation()}>
      <h3>{lk.original ? 'Edit short link' : 'New short link'}</h3>
      <label className="pg-l">Address<div className="pg-url"><span>olexweb.com/</span><input value={lk.slug} onChange={(e) => setLk({ ...lk, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} placeholder="whatsapp" aria-label="Address" /></div></label>
      <div className="pg-seg">{[['wa', 'Opens WhatsApp'], ['url', 'Opens a website']].map(([k, l]) => <button key={k} className={lk.kind === k ? 'on' : ''} aria-pressed={lk.kind === k} onClick={() => setLk({ ...lk, kind: k })}>{l}</button>)}</div>
      {lk.kind === 'wa' ? <><label className="pg-l">WhatsApp number, with country code<input className="input" value={lk.phone} onChange={(e) => setLk({ ...lk, phone: e.target.value })} inputMode="numeric" placeholder="2347011726321" /></label>
        <label className="pg-l">The message they send<textarea className="input" rows={2} value={lk.message} onChange={(e) => setLk({ ...lk, message: e.target.value })} placeholder="Hi Olex, I want…" /></label></>
        : <label className="pg-l">Website address<input className="input" value={lk.url} onChange={(e) => setLk({ ...lk, url: e.target.value })} placeholder="https://…" /></label>}
      <div className="pg-bt">{lk.original ? <button className="btn btn-line" style={{ marginRight: 'auto' }} disabled={!!busy} onClick={async () => { if (window.confirm('Delete olexweb.com/' + lk.original + '? Anyone using it will see “not found”.') && await call({ action: 'link-delete', slug: lk.original }, 'Link deleted.')) { setLk(null); router.refresh() } }}>Delete</button> : null}
        <button className="btn btn-line" onClick={() => setLk(null)}>Cancel</button>
        <button className="btn btn-green" disabled={!!busy} onClick={async () => { const j = await call({ action: 'link-save', slug: lk.slug, original: lk.original, phone: lk.kind === 'wa' ? lk.phone : '', message: lk.kind === 'wa' ? lk.message : '', url: lk.kind === 'url' ? lk.url : '' }, 'Link saved.'); if (j) { setLk(null); router.refresh() } }}>{busy === 'link-save' ? 'Saving…' : 'Save link'}</button></div>
      {err ? <p className="err" role="alert" style={{ marginTop: 10 }}>{err}</p> : null}</div></div> : null}

    <style dangerouslySetInnerHTML={{ __html: `
.pg-top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin:4px 0 16px}.pg-ic{width:18px;height:18px;flex:none;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.pg-top .btn,.pg-lh .btn{display:inline-flex;gap:8px;align-items:center}
.pg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
.pg-card{display:grid;gap:8px;align-content:start;padding:18px;border-radius:20px;background:var(--raise);border:1px solid var(--line);text-decoration:none;color:var(--paper);transition:transform .25s cubic-bezier(.2,.8,.2,1),border-color .25s}
.pg-card:hover{transform:translateY(-3px);border-color:rgba(143,227,106,.4)}.pg-ty{display:flex;gap:8px;align-items:center;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}.pg-ty .pg-ic{color:var(--green)}
.pg-card b{font-size:19px;line-height:1.2}.pg-u{font-size:13.5px;color:var(--green)}.pg-st{display:flex;gap:12px;font-size:13px;color:var(--dim)}.pg-st b{color:var(--paper)}
.pg-tag{justify-self:start;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:800}.pg-tag.live{background:rgba(143,227,106,.15);color:var(--green)}.pg-tag.draft{background:rgba(242,239,233,.08);color:var(--dim)}.pg-tag.off{background:rgba(242,239,233,.12);color:var(--paper)}
.pg-links{margin-top:28px}.pg-lh{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.pg-lh h2{margin:0;font-size:19px}
.pg-lt{border-radius:20px;background:var(--raise);border:1px solid var(--line);padding:4px 16px}.pg-lr{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:14px;align-items:center;padding:13px 0;border-bottom:1px solid var(--line)}.pg-lr:last-child{border:0}
.pg-lr b{font-size:15px}.pg-lr span{display:block;font-size:13px;color:var(--dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pg-taps{font-size:13px;color:var(--dim)}.pg-taps b{color:var(--paper)}.pg-la{display:flex!important;gap:6px}
@media(max-width:640px){.pg-lr{grid-template-columns:1fr}.pg-la{justify-content:flex-start}}
.pg-ov{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.6);display:grid;place-items:center;padding:16px;animation:pgF .2s ease}.pg-dl{width:min(96vw,760px);max-height:92vh;overflow:auto;padding:22px;border-radius:24px;background:var(--raise);border:1px solid var(--line);animation:pgUp .35s cubic-bezier(.2,.8,.2,1)}
@keyframes pgF{from{opacity:0}}@keyframes pgUp{from{opacity:0;transform:translateY(14px) scale(.98)}}
.pg-dl h3{margin:0 0 4px;font-size:21px}.pg-dl>p{margin:0;color:var(--dim);font-size:14.5px}
.pg-tp{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-top:16px}.pg-t{display:grid;gap:8px;align-content:start;text-align:left;padding:16px;border-radius:18px;border:1px solid var(--line);background:transparent;color:var(--paper);font:inherit;cursor:pointer;transition:border-color .2s,background .2s}
.pg-t .pg-ic{width:26px;height:26px;color:var(--green)}.pg-t b{font-size:15.5px}.pg-t span{font-size:13px;line-height:1.45;color:var(--dim)}.pg-t.on{border-color:var(--green);background:rgba(143,227,106,.07)}
.pg-bt{display:flex;gap:10px;justify-content:flex-end;margin-top:18px}.pg-l{display:grid;gap:6px;margin-top:12px;font-size:14px}
.pg-url{display:flex;align-items:center;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--bg,#0d0f0d)}.pg-url span{padding:12px 0 12px 13px;color:var(--dim);font-size:15px}.pg-url input{flex:1;min-width:0;padding:12px 13px 12px 2px;border:0;background:transparent;color:var(--paper);font:700 15px inherit;outline:0}
.pg-seg{display:inline-flex;gap:4px;margin-top:14px;padding:4px;border-radius:999px;border:1px solid var(--line)}.pg-seg button{padding:8px 14px;border-radius:999px;border:0;background:transparent;color:var(--dim);font:700 13.5px inherit;cursor:pointer}.pg-seg button.on{background:var(--paper);color:#111}
` }} />
  </>)
}
