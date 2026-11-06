'use client'
// Automation → Today: the day at a glance, in sections. Built for a phone first: one column, a row of section chips that
// stays at the top, big tap targets, and each section can be folded. All times are Lagos time, worked out on the server.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from './ui'
import { ChIcon, CSS } from './automationShared'

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
const HERO = {
  ok: ['Running on its own', 'Nothing needs you. Autopilot fixes small problems itself and replaces weak scripts.'],
  low: ['Running, but low on videos', 'The factory isn’t keeping up with the posting times. Make more starts the next one now.'],
  needs: ['Something needs you', 'Autopilot couldn’t sort everything out by itself. See Needs you below.'],
  off: ['Not running on its own yet', 'Switch YouTube to Autopilot, or turn Facebook posting on.'],
}

function Rows({ rows, empty }) {
  if (!rows.length) return <p className="at-note">{empty}</p>
  return <ul className="at-rows">{rows.map((r, i) => <li key={i} className={'at-row at-' + r.state}>
    <span className="at-time">{r.time}</span>
    <span className="at-what"><b>{r.title}</b><span>{r.what}</span></span>
    <span className={'at-s at-s-' + r.state}>{r.label}</span>
  </li>)}</ul>
}
function Section({ id, title, icon, badge, children }) {
  return <details className="at-sec" id={id} open>
    <summary><span className="at-h">{icon}{title}</span>{badge ? <span className="at-badge">{badge}</span> : null}<span className="at-fold" aria-hidden="true" /></summary>
    <div className="at-body">{children}</div>
  </details>
}

export default function AutomationToday({ data }) {
  const router = useRouter(), [busy, setBusy] = useState(false)
  const P = data.production, Y = data.youtube, F = data.facebook, M = data.making, W = data.week
  async function agent(platform, body, done) {
    setBusy(platform)
    try { const r = await fetch('/admin/api/youtube', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ ...body, platform }) })
      const j = await r.json().catch(() => ({})); if (r.status === 401) { window.location.assign('/admin/login'); return }
      toast(r.ok ? j.note || done : j.error || 'That didn’t work. Try again.'); if (r.ok) router.refresh() }
    catch { toast('No connection. Try again.') } finally { setBusy(false) }
  }
  async function makeMore() {
    setBusy(true)
    try { const r = await fetch('/admin/api/youtube', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action: 'make-more' }) })
      const j = await r.json().catch(() => ({})); if (r.status === 401) { window.location.assign('/admin/login'); return }
      toast(r.ok ? j.message : j.error || 'That didn’t work. Try again.'); if (r.ok) router.refresh() }
    catch { toast('No connection. Try again.') } finally { setBusy(false) }
  }
  const [h1, h2] = HERO[data.state] || HERO.ok
  const fbState = !F || !F.ready ? 'Not set up' : !F.connected ? 'Not connected' : F.paused ? 'Paused' : F.enabled ? 'On' : 'Off'
  const needsBox = <Section id="at-needs" title="Needs you" badge={data.needs.length ? String(data.needs.length) : null}>
    {data.needs.length ? <ul className="au-list">{data.needs.map((n, i) => <li key={i}><span>{n.text}</span><a href={n.href}>Open →</a></li>)}</ul>
      : <p className="at-note">Nothing right now. If something can’t be fixed on its own (for example, the factory fails 3 times), it shows here and on your phone.</p>}
  </Section>
  const chips = [['at-status', 'Status'], ...(data.needs.length ? [['at-needs', 'Needs you']] : []), ['at-yt', 'YouTube'], ['at-fb', 'Facebook'], ['at-make', 'Being made'], ['at-agent', 'Posting'], ['at-auto', 'Autopilot'], ...(data.needs.length ? [] : [['at-needs', 'Needs you']])]

  return (<div className="at">
    <nav className="at-chips" aria-label="Sections">{chips.map(([id, l]) => <a key={id} href={'#' + id}>{l}</a>)}</nav>

    <section id="at-status" className={'at-hero at-' + data.state} aria-label="Status">
      <span className="at-dot" aria-hidden="true" />
      <div className="at-ht"><b>{h1}</b><span>{h2}</span></div>
      {P.need ? <div className="at-ahead"><b>{P.days == null ? '–' : plural(P.days, 'day')}</b><span>of videos ready ahead</span></div> : null}
    </section>
    {P.need ? <section className={'au-prod' + (P.short ? ' au-short' : '')} aria-label="Production check">
      {P.short ? ChIcon.warn : <span className="au-ok" aria-hidden="true" />}
      <p><b>Production check:</b> {P.channels.join(' and ')} need{P.channels.length === 1 ? 's' : ''} <b>{P.need} video{P.need === 1 ? '' : 's'} a day</b>. The factory made <span className="au-n">{P.perDay}</span> a day this week, and <span className="au-n">{P.ready}</span> video{P.ready === 1 ? ' is' : 's are'} ready in the library.{P.short ? '' : ' Keeping up.'}</p>
      <button className="au-more" disabled={!!busy} onClick={makeMore}>{busy === true ? 'Starting…' : 'Make more'}</button>
    </section> : null}

    {data.needs.length ? needsBox : null}

    <div className="at-grid">
      <Section id="at-yt" title="YouTube" icon={ChIcon.youtube} badge={Y.mode === 'autopilot' ? 'Autopilot' : 'Approval'}>
        <Rows rows={Y.rows} empty={Y.connected ? 'Nothing posted or planned for today.' : 'YouTube isn’t connected.'} />
        <a className="at-more" href="/admin/youtube?view=videos">Posting times {(Y.times || []).join(' · ')} · Queue: {plural(Y.queue, 'video')} · {Y.connected ? Y.status : 'Not connected'} →</a>
      </Section>
      <Section id="at-fb" title="Facebook" icon={ChIcon.facebook} badge={fbState}>
        {F && F.connected ? <Rows rows={F.rows} empty="No Reels posted or planned for today." /> : <p className="at-note">Connect your Facebook Page to post Reels on their own times.</p>}
        <a className="at-more" href="/admin/automation/facebook">{F && F.connected ? `Posting times ${(F.times || []).join(' · ')} · Queue: ${plural(F.queue, 'video')} · ${F.page}` : 'Set up Facebook'} →</a>
      </Section>
      <Section id="at-make" title="Being made">
        {M.now ? <div className="at-job"><b>{M.now.name}</b><div className="at-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={M.now.pct}><i style={{ width: M.now.pct + '%' }} /></div>
          <span>{M.now.stage}{M.now.eta ? ' · ' + M.now.eta : ''}</span></div> : <p className="at-note">The factory is free right now.</p>}
        <ul className="at-facts">
          <li><b>{M.approved}</b> approved, waiting for the factory</li>
          <li><b>{M.toWrite}</b> picked idea{M.toWrite === 1 ? '' : 's'} waiting for a script</li>
          {M.held ? <li><b>{M.held}</b> on hold: Autopilot fixes {M.held === 1 ? 'it' : 'them'} within the hour</li> : null}
        </ul>
        <a className="at-more" href="/admin/youtube?view=progress">See progress →</a>
      </Section>
      <Section id="at-agent" title="Posting agent">
        {[['youtube', 'YouTube'], ['facebook', 'Facebook']].map(([k, name]) => { const a = (data.agent || {})[k]; if (!a) return null
          return <div key={k} className="at-agent">
            <div className="at-ag-top"><b>{name}</b><span className={'at-s ' + (a.enabled ? 'at-s-done' : 'at-s-empty')}>{a.enabled ? 'Deciding' : 'Off'}</span></div>
            <span className="at-ag-line">{a.enabled ? `${plural(a.perDay, 'post')} a day · next review ${a.nextReview === 'now' ? 'on the next run' : a.nextReview}` : 'You choose the posting times yourself.'}</span>
            {a.note ? <p className="at-ag-note">{a.note}</p> : null}
            <div className="at-ag-btns">
              <button className="at-btn" disabled={!!busy} onClick={() => agent(k, { action: 'post-agent', on: !a.enabled }, a.enabled ? `${name}: the agent is off. Your times stay as they are.` : `${name}: the agent is on.`)}>{busy === k ? 'Working…' : a.enabled ? 'Switch off' : 'Let it decide'}</button>
              {a.enabled ? <button className="at-btn" disabled={!!busy} onClick={() => agent(k, { action: 'post-agent-review' }, 'Reviewed.')}>Review now</button> : null}
            </div>
          </div> })}
        <p className="at-note">Starts at 1 a day, never more than 3. It posts more only when views per video and watch time hold and 3 days of videos are ready.</p>
      </Section>
      <Section id="at-auto" title="Autopilot this week">
        <ul className="at-facts">
          <li><b>{plural(W.fixed, 'script')}</b> mended (lines the site didn’t back removed, titles tidied)</li>
          <li><b>{plural(W.replaced, 'script')}</b> thrown away and written again</li>
          <li><b>{plural(W.remade, 'video')}</b> made again after the factory failed</li>
          <li><b>{W.waiting}</b> thing{W.waiting === 1 ? '' : 's'} waiting for you</li>
        </ul>
      </Section>
    </div>

    {data.needs.length ? null : needsBox}
    <style dangerouslySetInnerHTML={{ __html: CSS + TODAY_CSS }} />
  </div>)
}

const TODAY_CSS = `
.at{display:grid;gap:14px}
.at-chips{position:sticky;top:0;z-index:5;display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding:8px 0;margin:-8px 0 -4px;background:var(--night)}
.at-chips::-webkit-scrollbar{display:none}
.at-chips :where(a){flex:none;padding:9px 14px;border:1px solid var(--line);border-radius:999px;font-size:14px;font-weight:600;color:var(--dim);text-decoration:none;background:var(--raise);min-height:40px;display:flex;align-items:center}
.at-chips :where(a):hover{color:var(--paper)}
.at-sec,.at-hero{scroll-margin-top:64px}
.at-hero{display:flex;gap:14px;align-items:center;flex-wrap:wrap;border-radius:20px;padding:18px 20px;border:1px solid rgba(143,227,106,.35);background:linear-gradient(135deg,rgba(143,227,106,.12),rgba(143,227,106,.03))}
.at-hero.at-low{border-color:rgba(240,179,94,.45);background:linear-gradient(135deg,rgba(240,179,94,.12),rgba(240,179,94,.03))}
.at-hero.at-needs{border-color:rgba(239,122,106,.5);background:linear-gradient(135deg,rgba(239,122,106,.12),rgba(239,122,106,.03))}
.at-hero.at-off{border-color:var(--line);background:var(--raise)}
.at-dot{width:14px;height:14px;border-radius:50%;flex:none;background:var(--green);box-shadow:0 0 0 6px rgba(143,227,106,.15)}
.at-low .at-dot{background:var(--warn);box-shadow:0 0 0 6px rgba(240,179,94,.15)}.at-needs .at-dot{background:var(--bad);box-shadow:0 0 0 6px rgba(239,122,106,.15)}.at-off .at-dot{background:var(--faint);box-shadow:none}
.at-ht{flex:1 1 220px;min-width:0}.at-ht b{display:block;font-family:var(--display);font-weight:800;font-stretch:90%;font-size:22px;line-height:1.15}.at-ht span{color:var(--dim);font-size:14px}
.at-ahead{text-align:right;flex:none}.at-ahead b{display:block;font-family:var(--display);font-weight:800;font-size:32px;line-height:1;color:var(--green)}.at-ahead span{font-size:12px;color:var(--dim)}
.at-low .at-ahead b{color:var(--warn)}
.at-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start}
.at-sec{background:var(--raise);border:1px solid var(--line);border-radius:20px;overflow:hidden}
.at-sec>summary{list-style:none;display:flex;align-items:center;gap:10px;padding:16px 20px;cursor:pointer;min-height:56px}
.at-sec>summary::-webkit-details-marker{display:none}
.at-h{display:flex;align-items:center;gap:8px;font-weight:700;font-size:17px}
.at-badge{font-size:12px;font-weight:700;padding:2px 9px;border-radius:999px;background:rgba(143,227,106,.14);color:var(--green)}
.at-fold{margin-left:auto;width:10px;height:10px;border-right:2px solid var(--dim);border-bottom:2px solid var(--dim);transform:rotate(45deg);transition:transform .2s;margin-top:-4px}
.at-sec:not([open]) .at-fold{transform:rotate(-45deg);margin-top:0}
.at-body{padding:0 20px 18px;display:grid;gap:10px}
.at-rows{list-style:none;margin:0;padding:0}
.at-row{display:grid;grid-template-columns:52px minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px 0;border-top:1px solid var(--line)}
.at-row:first-child{border-top:0;padding-top:2px}
.at-time{font-family:var(--display);font-weight:700;font-size:16px}
.at-what{min-width:0}.at-what b{display:block;font-size:14.5px;font-weight:600;overflow-wrap:anywhere}.at-what span{font-size:12.5px;color:var(--dim)}
.at-empty .at-what b{color:var(--dim);font-weight:500}
.at-s{font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap}
.at-s-done{background:rgba(143,227,106,.14);color:var(--green)}.at-s-next{background:rgba(240,179,94,.14);color:var(--warn)}.at-s-empty{background:var(--raise2);color:var(--dim)}
.at-note{margin:0;color:var(--dim);font-size:14px}
.at-more{font-size:14px;font-weight:600;color:var(--dim);text-decoration:none;padding:6px 0;overflow-wrap:anywhere}.at-more:hover{color:var(--paper)}
.at-job b{font-size:14.5px}.at-job span{font-size:13px;color:var(--dim)}
.at-bar{height:6px;background:var(--raise2);border-radius:9px;overflow:hidden;margin:8px 0 6px}.at-bar i{display:block;height:100%;background:var(--green);border-radius:9px}
.at-agent{display:grid;gap:6px;padding:12px 0;border-top:1px solid var(--line)}.at-agent:first-child{border-top:0;padding-top:2px}
.at-ag-top{display:flex;align-items:center;justify-content:space-between;gap:10px}.at-ag-top b{font-size:15px}
.at-ag-line{font-size:13.5px;color:var(--dim)}.at-ag-note{margin:0;font-size:13.5px;line-height:1.5}
.at-ag-btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}
.at-btn{min-height:40px;padding:8px 14px;border-radius:999px;border:1px solid var(--line);background:var(--raise2);color:var(--paper);font:inherit;font-size:14px;font-weight:600;cursor:pointer}
.at-btn:disabled{opacity:.55;cursor:default}.at-btn:hover:not(:disabled){border-color:var(--green)}
.at-facts{margin:0;padding-left:18px;display:grid;gap:6px;color:var(--dim);font-size:14px}.at-facts b{color:var(--paper)}
@media (max-width:760px){
  .at-grid{grid-template-columns:1fr}
  .at-hero{padding:16px}.at-ahead{text-align:left;margin-left:28px}
  .at-sec>summary{padding:14px 16px}.at-body{padding:0 16px 16px}
  .au-prod .au-more{width:100%;min-height:44px;margin-left:0}
}
`
