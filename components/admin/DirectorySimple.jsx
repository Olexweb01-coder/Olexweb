'use client'
// Admin → Directory, the simple view (Install 16): is it posting, today's times and what went out, what's ready, how many
// people came this week, and a few big controls. The detailed view (AdminDirectory) is one tap away.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from './ui'
import { SIMPLE_CSS } from './AutomationSimple'
import { YS_CSS } from './YouTubeSimple'
import { showDetails } from './SimpleSwitch'

const KN = { tool: 'Tool', update: 'Tech update', guide: 'How-to', alert: 'Safety alert', story: 'Tech story' }
const KS = { tool: 'Tools', update: 'Tech updates', guide: 'How-tos', alert: 'Safety alerts', story: 'Tech stories & history' }
const fmt = (n) => Number(n || 0).toLocaleString('en-GB')
const googleLine = (g) => !g ? 'Bing is told about each new post the moment it goes live. Google finds them through your sitemap.'
  : g.ok ? 'Bing and Google are both told about new posts the same day.'
  : /isn’t set up/.test(g.why || '') ? 'Bing is told the moment a post goes live. Google finds them through your sitemap; to tell Google directly too, connect Search Console (ask Olex AI to walk you through it).'
  : /Full/.test(g.why || '') ? 'Bing is told at once. To tell Google directly too: in Search Console → Settings → Users and permissions, change the Olexweb service account to “Full”.'
  : 'Bing is told at once. Google didn’t answer last time; it still finds new posts through your sitemap.'

export default function DirectorySimple({ data }) {
  const router = useRouter(), D = data, S = D.settings, [busy, setBusy] = useState('')
  // repeats already on the site (blog and Directory): keep the first, take the copy down with a redirect
  const [rep, setRep] = useState(null)
  const loadRep = () => fetch('/admin/api/directory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action: 'repeats' }) }).then((r) => r.json()).then((j) => { if (j && j.blog) setRep(j) }).catch(() => {})
  useEffect(() => { loadRep() }, [])
  async function merge(p) {
    setBusy('m' + p.repeat.id)
    try { const r = await fetch('/admin/api/directory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action: 'merge-repeat', type: p.type, keep: p.keep.id, repeat: p.repeat.id }) }), j = await r.json().catch(() => ({}))
      if (!r.ok) toast(j.error || 'That didn’t work. Try again.'); else { toast('Done. The copy now sends people to the one you kept.'); loadRep(); router.refresh() } }
    catch { toast('No connection. Try again.') } finally { setBusy('') }
  }
  const pairs = rep ? [...rep.blog, ...rep.dir] : []
  async function call(key, body, ok) {
    setBusy(key)
    try { const r = await fetch('/admin/api/directory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) }), j = await r.json().catch(() => ({}))
      if (r.status === 401) { window.location.assign('/admin/login'); return }
      if (!r.ok) toast(j.error || 'That didn’t work. Try again.'); else { toast(typeof ok === 'function' ? ok(j) : ok); router.refresh() } }
    catch { toast('No connection. Try again.') } finally { setBusy('') }
  }
  const on = S.autoPublish && S.perDay > 0, posted = D.times.filter((t) => t.state === 'live').length
  const readyAll = Object.values(D.ready).reduce((a, b) => a + b, 0), live = Object.values(D.counts).reduce((a, b) => a + b, 0)
  const toggleKind = (k) => { const next = S.kinds.includes(k) ? S.kinds.filter((x) => x !== k) : [...S.kinds, k]; call('k' + k, { action: 'simple-settings', kinds: next }, S.kinds.includes(k) ? KS[k] + ' are off.' : KS[k] + ' are on.') }
  return (<div className="sm">
    <h1 className="d" style={{ margin: 0 }}>Directory</h1>
    <section className={'sm-hero ' + (on ? 'sm-ok' : 'sm-off')} aria-label="Status">
      <div className="sm-hrow"><div className="sm-big" aria-hidden="true">{on ? '✓' : '–'}</div>
        <div><b className="sm-t">{on ? `Posting ${S.perDay} new thing${S.perDay === 1 ? '' : 's'} a day.` : 'Not posting by itself.'}</b>
          <span className="sm-s">{on ? `${posted} out today so far. ${fmt(live)} posts live in total.` : 'Turn it on below and it posts at set times every day.'}</span></div></div>
      <div className="sm-chips"><div className="sm-chip"><b>{fmt(D.week.views)}</b>visits this week</div><div className="sm-chip"><b>{fmt(D.week.leads)}</b>people tapped your offer</div></div>
    </section>

    <div className="sm-grid"><div>
      <section className="sm-card" aria-label="Today">
        <h2>Today</h2>
        {D.times.length ? D.times.map((t) => <div key={t.time} className="sm-item"><span className="sm-time">{t.time}</span>
          <div className="sm-what">{t.state === 'live' ? <><b><a href={t.path} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>{t.name}</a></b><span className="sm-tag sm-done">✓ {KN[t.kind]} · live</span></>
            : t.state === 'missed' ? <><b>Nothing went out</b><span className="sm-tag sm-none">Nothing was ready in time</span></>
            : <><b>{KN[t.plan]}{t.plan === 'guide' ? ' or safety alert' : ''}</b><span className="sm-tag sm-soon">⏰ Coming up</span></>}</div></div>)
          : <p className="sm-note">No times set: it isn’t posting.</p>}
      </section>

      <section className="sm-card" aria-label="Ready">
        <h2>Ready to go out</h2>
        <div className="sm-chips">{['tool', 'story', 'update', 'guide', 'alert'].map((k) => <div key={k} className="sm-chip"><b>{D.ready[k] || 0}</b>{KS[k].toLowerCase()}</div>)}</div>
        <p className="sm-note">{readyAll ? 'Written and checked, waiting for their time. Every fact is quoted from its source.' : 'The next ones are being written and checked.'}</p>
        <button className="sm-btn sm-line" disabled={!!busy || !readyAll} onClick={() => call('now', { action: 'publish-now' }, (j) => `Live now: ${j.name}`)}>{busy === 'now' ? 'Publishing…' : 'Publish one now'}</button>
      </section>

      <section className="sm-card" aria-label="Most read">
        <h2>Most read this week</h2>
        {D.top.length ? D.top.map((t) => <a key={t.kind + t.slug} className="ys-link" href={t.path} target="_blank" rel="noopener noreferrer"><span><b>{t.name}</b>{KN[t.kind]} · {fmt(t.views)} visits</span><em aria-hidden="true">↗</em></a>)
          : <p className="sm-note">No visits counted yet this week.</p>}
      </section>
    </div><div>

      <section className="sm-card" aria-label="How many a day">
        <h2>How many a day?</h2>
        <div className="ys-per" role="group" aria-label="Posts a day">{[5, 8, 12].map((n) => <button key={n} aria-pressed={S.perDay === n} disabled={!!busy || S.perDay === n}
          onClick={() => call('per' + n, { action: 'simple-settings', perDay: n, autoPublish: true }, `${n} a day.`)}><b>{n}</b>a day</button>)}</div>
        <p className="sm-note">At {S.slots.join(', ')} (Lagos), so there’s always something new during the day.</p>
      </section>

      <section className="sm-card" aria-label="What it posts">
        <h2>What it posts</h2>
        {['tool', 'story', 'update', 'guide', 'alert'].map((k) => <div key={k} className="sm-sw"><div><b>{KS[k]}</b><span>{{ tool: 'Useful websites and AI tools, explained', update: 'What changed in apps people use, and what to do', guide: 'Step-by-step help people can follow today', alert: 'Scams and safety risks going round now', story: 'Big tech moments (space, sport tech, records) and tech history' }[k]} · {fmt(D.counts[k] || 0)} live</span></div>
          <button className={'sm-tog' + (S.kinds.includes(k) ? '' : ' off')} role="switch" aria-checked={S.kinds.includes(k)} aria-label={KS[k]} disabled={!!busy} onClick={() => toggleKind(k)}><i /><em>{busy === 'k' + k ? '…' : S.kinds.includes(k) ? 'ON' : 'OFF'}</em></button></div>)}
      </section>

      {rep ? <section className="sm-card" aria-label="Repeats">
        <h2>Repeats</h2>
        <p className="sm-note">New posts are now checked against everything already on the site, in the blog and the Directory, so the same story or topic isn’t posted twice. {pairs.length ? 'These were posted before that check. Google ignores copies and trusts the site less for them, so keep one of each:' : 'Nothing on the site repeats another post.'}</p>
        {pairs.map((p) => <div key={p.type + p.repeat.id} className="sm-rep">
          <div><span className="sm-tag">{p.type === 'post' ? 'Blog' : 'Directory'}</span><a href={p.keep.url} target="_blank" rel="noopener noreferrer"><b>Keep:</b> {p.keep.title}</a><a href={p.repeat.url} target="_blank" rel="noopener noreferrer"><b>Copy:</b> {p.repeat.title}</a></div>
          <button className="sm-btn sm-line" disabled={!!busy} onClick={() => merge(p)}>{busy === 'm' + p.repeat.id ? 'Merging…' : 'Take the copy down'}</button></div>)}
        <style>{`.sm-rep{display:flex;gap:12px;justify-content:space-between;align-items:center;flex-wrap:wrap;padding:12px 0;border-top:1px solid var(--line)}.sm-rep>div{display:grid;gap:4px;min-width:0;flex:1 1 260px}.sm-rep a{color:var(--paper);text-decoration:none;font-size:14px;overflow-wrap:anywhere}.sm-rep a b{color:var(--dim);font-weight:600}.sm-tag{width:fit-content;font-size:11.5px;font-weight:700;padding:2px 8px;border-radius:99px;background:var(--raise2);color:var(--dim)}`}</style>
      </section> : null}

      <section className="sm-card" aria-label="Getting seen">
        <h2>Getting seen</h2>
        <div className="sm-sw"><div><b>Share the day’s best on Facebook</b><span>One link post a day on your Page, with its own picture.</span></div>
          <button className={'sm-tog' + (S.fbShare ? '' : ' off')} role="switch" aria-checked={S.fbShare} aria-label="Share on Facebook" disabled={!!busy} onClick={() => call('fb', { action: 'simple-settings', fbShare: !S.fbShare }, S.fbShare ? 'Facebook sharing is off.' : 'Facebook sharing is on.')}><i /><em>{S.fbShare ? 'ON' : 'OFF'}</em></button></div>
        <div className="ys-line"><b>Google and Bing</b><span>{googleLine(S.google)}</span></div>
        <div className="ys-line"><b>Shared links look good</b><span>Every post has its own picture for WhatsApp, Facebook and X, share buttons, and a news feed at olexweb.com/feed.xml.</span></div>
        <div className="ys-line"><b>Your videos</b><span>Each video’s description links to its post.</span></div>
      </section>

      <div className="sm-sw" style={{ padding: '0 4px' }}><div><b>Posting by itself</b><span>{on ? 'On: posts go live at their times.' : 'Off: posts wait for you in Detailed.'}</span></div>
        <button className={'sm-tog' + (S.autoPublish ? '' : ' off')} role="switch" aria-checked={S.autoPublish} aria-label="Posting by itself" disabled={!!busy} onClick={() => call('auto', { action: 'simple-settings', autoPublish: !S.autoPublish }, S.autoPublish ? 'Posting by itself is off.' : 'Posting by itself is on.')}><i /><em>{S.autoPublish ? 'ON' : 'OFF'}</em></button></div>

      <button className="sm-more" onClick={showDetails}>Show the details (every page, its checks, settings) <span aria-hidden="true">→</span></button>
    </div></div>
    <style dangerouslySetInnerHTML={{ __html: SIMPLE_CSS + YS_CSS + '.sm-card .sm-item{grid-template-columns:58px minmax(0,1fr)}' }} />
  </div>)
}
