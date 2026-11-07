'use client'
// Facebook, the simple view (Install 15): is it posting, what's coming up, how the last Reels did, and how often it posts.
// The detailed view (AutomationFacebook.jsx) is one tap away.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from './ui'
import { SIMPLE_CSS } from './AutomationSimple'
import { YS_CSS } from './YouTubeSimple'
import { showDetails } from './SimpleSwitch'

const fmt = (n) => Number(n || 0).toLocaleString('en-GB')
const dayWord = (x) => x.when === 'today' ? 'Today' : x.when === 'tomorrow' ? 'Tomorrow' : new Date(x.day + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const ago = (d) => { if (!d) return ''; const h = Math.round((Date.now() - new Date(d).getTime()) / 3600e3); return h < 1 ? 'just now' : h < 24 ? h + ' h ago' : Math.round(h / 24) + ' days ago' }

export default function FacebookSimple({ data }) {
  const router = useRouter(), F = data, [busy, setBusy] = useState('')
  async function meta(key, body, ok) {
    setBusy(key)
    try { const r = await fetch('/admin/api/meta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) }), j = await r.json().catch(() => ({}))
      if (r.status === 401) { window.location.assign('/admin/login'); return }
      if (!r.ok) toast(j.error || 'That didn’t work. Try again.'); else { toast(ok); router.refresh() } }
    catch { toast('No connection. Try again.') } finally { setBusy('') }
  }
  const on = F.enabled && !F.paused, Q = F.queue || { items: [], waiting: 0 }
  const state = F.paused ? 'needs' : on ? 'ok' : 'off'
  const title = F.paused ? 'Facebook posting stopped.' : on ? `Posting ${F.perDay} Reel${F.perDay === 1 ? '' : 's'} a day.` : 'Facebook posting is off.'
  const sub = F.paused ? F.paused.reason : on ? `To ${F.page.name}, each with its own ending (a question, so people comment).` : `Nothing goes to ${F.page.name} until you turn it on.`
  return (<div className="sm">
    <section className={'sm-hero sm-' + state} aria-label="Status">
      <div className="sm-hrow"><div className="sm-big" aria-hidden="true">{F.paused ? '!' : on ? '✓' : '–'}</div>
        <div><b className="sm-t">{title}</b><span className="sm-s">{sub}</span></div></div>
      {F.paused ? <button className="sm-btn sm-go" disabled={!!busy} onClick={() => meta('resume', { action: 'resume' }, 'Facebook posting is back on.')}>{busy === 'resume' ? 'Starting…' : 'Turn it back on'}</button>
        : <button className={'sm-btn ' + (on ? 'sm-line' : 'sm-go')} disabled={!!busy} onClick={() => meta('enable', { action: 'enable', on: !on }, on ? 'Facebook posting is off.' : 'Facebook posting is on.')}>{busy === 'enable' ? '…' : on ? 'Turn off' : 'Turn on'}</button>}
    </section>

    <div className="sm-grid"><div>
      <section className="sm-card" aria-label="Coming up">
        <h2>Coming up on Facebook</h2>
        {Q.items.length ? Q.items.map((x) => <div key={x.id + x.day + x.time} className="sm-item"><span className="sm-time">{x.time}</span><span className="sm-logo sm-fb">FB</span>
          <div className="sm-what"><b>{x.name}</b><span className={'sm-tag ' + (on ? 'sm-soon' : 'sm-none')}>{dayWord(x)}{on ? '' : ' · off'}</span></div></div>)
          : <p className="sm-note">No Reels ready yet. Each finished video comes here by itself.</p>}
        {Q.waiting > Q.items.length ? <p className="sm-note">{Q.waiting} Reels ready in total.</p> : null}
      </section>

      <section className="sm-card" aria-label="Posted lately">
        <h2>Posted lately</h2>
        {F.recent.length ? F.recent.map((r) => <div key={r.id} className="ys-line"><b>{r.title || r.name}</b>
          <span>{ago(r.at)}{r.views != null ? ` · ${fmt(r.views)} plays` : r.at && Date.now() - new Date(r.at).getTime() < 3 * 86400e3 ? ' · plays are read after 3 days' : ''}</span></div>)
          : <p className="sm-note">Nothing posted yet.</p>}
        {F.insights === 'denied' ? <p className="sm-note">Facebook isn’t letting the app read plays yet. To allow it: in your Meta app, add the <b>read_insights</b> permission to its login setup, then reconnect the Page (Detailed → Reconnect).</p> : null}
      </section>
    </div><div>

      <section className="sm-card" aria-label="How often">
        <h2>How many Reels a day?</h2>
        <div className="ys-per" role="group" aria-label="Reels a day">{[1, 2, 3].map((n) => <button key={n} aria-pressed={F.perDay === n} disabled={!!busy || F.perDay === n}
          onClick={() => meta('per' + n, { action: 'per-day', n }, `${n} Reel${n === 1 ? '' : 's'} a day.`)}><b>{n}</b>a day</button>)}</div>
        <p className="sm-note">At {F.times.join(', ')} (Lagos). If Smart posting times is on (Automation → Today), it adjusts this by itself when views hold up, never above 3.</p>
      </section>

      <section className="sm-card" aria-label="Page">
        <h2>Your Page</h2>
        <div className="ys-line"><b>{F.page.name}</b><span>Connected. Reels go here.</span></div>
      </section>

      <button className="sm-more" onClick={showDetails}>Show the details (times, caption style, safety) <span aria-hidden="true">→</span></button>
    </div></div>
    <style dangerouslySetInnerHTML={{ __html: SIMPLE_CSS + YS_CSS }} />
  </div>)
}
