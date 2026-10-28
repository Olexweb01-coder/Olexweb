'use client'
// Automation → Overview: is the factory keeping up, a card per channel, and what needs you.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from './ui'
import { ChIcon, CSS } from './automationShared'

const times = (t) => (t || []).join(' · ')
const days = (n) => (n === 0.5 ? '½ day' : n === 1 ? '1 day' : `${String(n).replace('.5', '½')} days`)

export default function AutomationOverview({ data }) {
  const router = useRouter(), [busy, setBusy] = useState(false)
  const P = data.production, Y = data.youtube, F = data.facebook
  async function makeMore() {
    setBusy(true)
    try { const r = await fetch('/admin/api/youtube', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action: 'make-more' }) })
      const j = await r.json().catch(() => ({})); if (r.status === 401) { window.location.assign('/admin/login'); return }
      toast(r.ok ? j.message : j.error || 'That didn’t work. Try again.'); if (r.ok) router.refresh() }
    catch { toast('No connection. Try again.') } finally { setBusy(false) }
  }
  const ytToday = `${Y.todayDone} posted${Y.nextToday ? ' · 1 at ' + Y.nextToday : ''}`
  const fbState = !F || !F.ready ? 'Not set up' : !F.connected ? 'Not connected' : F.paused ? 'Paused' : F.enabled ? 'On' : 'Off'
  return (<div className="au">
    {P.need ? <section className={'au-prod' + (P.short ? ' au-short' : '')} aria-label="Production check">
      {P.short ? ChIcon.warn : <span className="au-ok" aria-hidden="true" />}
      <p><b>Production check:</b> {P.channels.join(' and ')} need{P.channels.length === 1 ? 's' : ''} <b>{P.need} video{P.need === 1 ? '' : 's'} a day</b>. The factory made <span className="au-n">{P.perDay}</span> a day this week, and <span className="au-n">{P.ready}</span> video{P.ready === 1 ? ' is' : 's are'} ready in the library{P.days == null ? '' : P.days === 0 ? ' (not enough for a full day)' : ` (enough for ${P.days === 1 ? '1 day' : P.days + ' days'})`}.{P.short ? '' : ' Keeping up.'}</p>
      <button className="au-more" disabled={busy} onClick={makeMore}>{busy ? 'Starting…' : 'Make more'}</button>
    </section> : <section className="au-prod" aria-label="Production check"><span className="au-ok au-off" aria-hidden="true" /><p>No channel is posting on its own yet. Switch YouTube to Autopilot or turn Facebook posting on.</p></section>}

    <div className="au-cards">
      <a className="au-card" href="/admin/youtube?view=videos">
        <div className="au-ch">{ChIcon.youtube}<b>YouTube</b><span className={'au-pill' + (Y.mode === 'autopilot' ? ' au-on' : ' au-warn')}>{Y.mode === 'autopilot' ? 'Autopilot' : 'Approval'}</span></div>
        <dl className="au-rows">
          <div><dt>Posting times</dt><dd>{times(Y.times)}</dd></div>
          <div><dt>Today</dt><dd>{ytToday}</dd></div>
          <div><dt>Queue</dt><dd>{Y.queue} video{Y.queue === 1 ? '' : 's'}{Y.queue ? ` (${days(Y.queueDays)})` : ''}</dd></div>
          <div><dt>Status</dt><dd>{Y.connected ? Y.status : 'Not connected'}</dd></div>
        </dl>
      </a>
      <a className="au-card" href="/admin/automation/facebook">
        <div className="au-ch">{ChIcon.facebook}<b>Facebook</b><span className={'au-pill' + (fbState === 'On' ? ' au-on' : fbState === 'Paused' ? ' au-bad' : '')}>{fbState}</span></div>
        {F && F.connected ? <dl className="au-rows">
          <div><dt>Page</dt><dd>{F.page}</dd></div>
          <div><dt>Posting times</dt><dd>{times(F.times)}</dd></div>
          <div><dt>Today</dt><dd>{F.todayDone} Reel{F.todayDone === 1 ? '' : 's'} posted{F.enabled && F.nextToday ? ' · 1 at ' + F.nextToday : ''}</dd></div>
          <div><dt>Queue</dt><dd>{F.queue} video{F.queue === 1 ? '' : 's'}</dd></div>
        </dl> : <p className="au-note">Connect your Facebook Page to post Reels on their own times, without waiting for YouTube.</p>}
      </a>
      <a className="au-card" href="/admin/automation/instagram">
        <div className="au-ch">{ChIcon.instagram}<b>Instagram</b><span className="au-pill">Off</span></div>
        <p className="au-note">Waiting until your Instagram account has been stable for 2 weeks. Then: switch to Business, link it to the Olexweb Page, and turn it on here.</p>
      </a>
    </div>

    <section className="au-box" aria-label="Needs you">
      <h2>Needs you</h2>
      {data.needs.length ? <ul className="au-list">{data.needs.map((n, i) => <li key={i}><span>{n.text}</span><a href={n.href}>Open →</a></li>)}</ul> : <p className="au-note">Nothing right now. Everything is running on its own.</p>}
    </section>
    <style>{CSS}</style>
  </div>)
}
