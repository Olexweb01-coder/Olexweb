'use client'
// Automation → Today, the simple view (Install 14): four plain questions, top to bottom.
//   1. Is it working?  2. What goes out today?  3. What's being made now?  4. What's switched on (and what kind of videos)?
// Everything technical stays in the detailed view (AutomationToday). All times are Lagos time, worked out on the server.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from './ui'

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
const HERO = {
  ok: ['All good. It’s running by itself.', 'Nothing needs you.'],
  low: ['Running, but low on videos.', 'The factory isn’t keeping up. Press “Make more” and it starts the next one now.'],
  needs: [null, 'Everything else keeps running.'],
  off: ['Not running by itself yet.', 'Turn Autopilot on below, and it writes, makes and posts on its own.'],
}
const STEPS = ['Written', 'Filming the site', 'His voice', 'Drawing', 'Sending back']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })
  if (r.status === 401) { window.location.assign('/admin/login'); return null }
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'That didn’t work. Try again.')
  return j
}

export default function AutomationSimple({ data, onDetailed }) {
  const router = useRouter(), [busy, setBusy] = useState(null)
  const P = data.production, Y = data.youtube, F = data.facebook, M = data.making, W = data.week, S = data.simple || {}, A = data.agent || {}
  async function act(key, url, body, done) {
    setBusy(key)
    try { const j = await post(url, body); if (j) { toast(typeof done === 'function' ? done(j) : done); router.refresh() } }
    catch (e) { toast(e.message === 'Failed to fetch' ? 'No connection. Try again.' : e.message) } finally { setBusy(null) }
  }
  const yt = (key, body, done) => act(key, '/admin/api/youtube', body, done)

  // 1. is it working?
  const [t1, t2] = HERO[data.state] || HERO.ok
  const title = data.state === 'needs' ? (data.needs.length === 1 ? '1 thing needs you.' : `${data.needs.length} things need you.`) : t1
  const days = P.need ? Math.max(0, Math.floor(P.days || 0)) : null
  const dow = new Date(Date.now() + 3600e3).getUTCDay()

  // 2. today, both platforms in one list
  const rows = [...(Y.rows || []).map((r) => ({ ...r, p: 'yt' })), ...((F && F.connected ? F.rows : []) || []).map((r) => ({ ...r, p: 'fb' }))].sort((a, b) => a.time.localeCompare(b.time))
  const tagOf = (r) => r.state === 'done' ? ['done', (r.label === 'Scheduled' ? '✓ Scheduled' : '✓ Posted')] : r.state === 'next' ? [r.what === 'Long story' ? 'long' : 'soon', (r.what === 'Long story' ? 'Long story · ' : '⏰ ') + r.label] : ['none', r.label === 'Empty' ? 'Nothing ready for this time yet' : r.label]

  // 4. switches
  const auto = Y.mode === 'autopilot', fbOn = !!(F && F.connected && F.enabled && !F.paused)
  const smart = !!((A.youtube && A.youtube.enabled) || (A.facebook && A.facebook.enabled))
  const story = S.style === 'story'

  return (<div className="sm">
    <section className={'sm-hero sm-' + data.state} aria-label="Status">
      <div className="sm-hrow"><div className="sm-big" aria-hidden="true">{data.state === 'needs' ? '!' : data.state === 'off' ? '–' : data.state === 'low' ? '!' : '✓'}</div>
        <div><b className="sm-t">{title}</b><span className="sm-s">{data.lastRun ? `Checked ${data.lastRun.label}. ` : ''}{t2}</span></div></div>
      {days != null ? <>
        <div className="sm-q">Videos ready for the next days</div>
        <div className="sm-days">{Array.from({ length: 7 }, (_, k) => <div key={k} className={'sm-day' + (k < days ? ' full' : '')}><i>{k === 0 ? 'Today' : DAYS[(dow + k) % 7]}</i><em aria-label={k < days ? 'ready' : 'not yet'}>{k < days ? '●' : '○'}</em></div>)}</div>
        <span className="sm-hint">{days >= 7 ? 'A week or more ready.' : days === 0 ? 'Nothing ready ahead yet.' : `${plural(days, 'day')} ready.`} {P.short ? '' : 'The factory keeps making more.'}</span>
        {P.short ? <button className="sm-btn sm-go" disabled={!!busy} onClick={() => yt('more', { action: 'make-more' }, (j) => j.message)}>{busy === 'more' ? 'Starting…' : 'Make more'}</button> : null}
      </> : null}
    </section>

    {data.needs.map((n, i) => <section key={i} className="sm-need"><b>{n.text}</b><a className="sm-btn sm-red" href={n.href}>Fix it</a></section>)}

    <div className="sm-grid"><div>
      <section className="sm-card" aria-label="Today">
        <h2>Today</h2>
        {rows.length ? rows.map((r, i) => { const [cls, label] = tagOf(r); return <div key={i} className={'sm-item' + (r.state === 'empty' ? ' sm-empty' : '')}>
          <span className="sm-time">{r.time}</span><span className={'sm-logo sm-' + r.p}>{r.p === 'yt' ? 'YT' : 'FB'}</span>
          <div className="sm-what"><b>{r.state === 'empty' ? (r.p === 'yt' ? 'YouTube' : 'Facebook') : r.title}</b><span className={'sm-tag sm-' + cls}>{label}</span></div></div> })
          : <p className="sm-note">Nothing posted or planned for today yet.</p>}
      </section>

      <section className="sm-card" aria-label="Being made now">
        <h2>Being made now</h2>
        {M.now ? <div className="sm-make"><b>{M.now.name}</b>
          <div className="sm-steps">{STEPS.map((l, k) => { const st = k < S.step ? 'done' : k === S.step ? 'now' : ''
            return <div key={k} className={'sm-st ' + st}><i style={st === 'now' && S.stepPct != null ? { background: `linear-gradient(90deg,var(--green) ${S.stepPct}%,var(--raise2) ${S.stepPct}%)` } : undefined} />{l}</div> })}</div>
          <span className="sm-left">{[S.note, M.now.eta].filter(Boolean).join(' · ') || M.now.stage}</span></div>
          : <p className="sm-note">The factory is free right now. It starts the next video by itself.</p>}
        <div className="sm-chips"><div className="sm-chip"><b>{plural(M.approved, 'video')}</b>waiting their turn in the factory</div>
          <div className="sm-chip"><b>{plural(M.toWrite, 'idea')}</b>{story ? 'picked for the next long story' : 'picked, waiting for a script'}</div></div>
      </section>
    </div><div>

      <section className="sm-card" aria-label="What kind of videos">
        <h2>What kind of videos?</h2>
        <button className={'sm-pick' + (story ? ' on' : '')} disabled={!!busy || story} onClick={() => yt('style', { action: 'short-style', style: 'story' }, 'Story videos are on: a long story every day, and Shorts cut from it.')}>
          <span className="sm-radio" aria-hidden="true" /><span><b>Story videos {story ? '· on' : ''}</b>Every day: one long story (his whole day, 5–8 minutes, a different site saving him each chapter), plus up to 3 Shorts cut from it. Facebook gets its own version.</span></button>
        <button className={'sm-pick' + (!story ? ' on' : '')} disabled={!!busy || !story} onClick={() => yt('style', { action: 'short-style', style: 'classic' }, 'Back to classic Shorts.')}>
          <span className="sm-radio" aria-hidden="true" /><span><b>Classic Shorts {!story ? '· on' : ''}</b>One “Secret websites” Short at a time, and a long video on the days you choose.</span></button>
        {story ? <p className="sm-note">The long story goes up at {S.sagaTime} every day. {S.sagaToday ? 'Today’s is already written.' : ''}</p> : null}
        {story && !S.sagaToday ? <button className="sm-btn sm-line" disabled={!!busy} onClick={() => yt('saga', { action: 'write-saga' }, (j) => `Written: ${j.chapters} chapters, plus ${(j.shorts || []).length} Shorts cut from it. The factory makes it next.`)}>{busy === 'saga' ? 'Writing… (2–4 minutes)' : 'Make today’s long story now'}</button> : null}
      </section>

      <section className="sm-card" aria-label="Switches">
        <h2>Switches</h2>
        <Switch on={auto} busy={busy === 'auto'} disabled={!!busy} title="Autopilot" text={auto ? 'Writes, makes and posts by itself.' : 'Off: every new script waits for you to approve it.'}
          onClick={() => yt('auto', { action: 'yt-mode', mode: auto ? 'approval' : 'autopilot' }, auto ? 'Autopilot is off. New scripts wait for you.' : 'Autopilot is on.')} />
        {F && F.connected ? <Switch on={fbOn} busy={busy === 'fb'} disabled={!!busy} title="Post to Facebook" text={F.paused ? 'Paused after a problem. Turn it on to try again.' : fbOn ? `${plural(F.perDay || 1, 'Reel')} a day on ${F.page}.` : 'Off: nothing goes to Facebook.'}
          onClick={() => act('fb', '/admin/api/meta', F.paused ? { action: 'resume' } : { action: 'enable', on: !fbOn }, fbOn ? 'Facebook posting is off.' : 'Facebook posting is on.')} />
          : <div className="sm-sw"><div><b>Post to Facebook</b><span>Not connected yet.</span></div><a className="sm-btn sm-line sm-small" href="/admin/automation/facebook">Set up</a></div>}
        <Switch on={smart} busy={busy === 'smart'} disabled={!!busy} title="Smart posting times" text={smart ? 'Posts more only when views hold up. Never more than 3 a day.' : 'Off: posts at the times you set.'}
          onClick={async () => { setBusy('smart')
            try { for (const p of ['youtube', 'facebook']) if (A[p]) await post('/admin/api/youtube', { action: 'post-agent', platform: p, on: !smart }); toast(smart ? 'Smart posting times are off. Your times stay as they are.' : 'Smart posting times are on.'); router.refresh() }
            catch (e) { toast(e.message) } finally { setBusy(null) } }} />
      </section>

      <section className="sm-card" aria-label="This week">
        <h2>This week</h2>
        <div className="sm-chips"><div className="sm-chip"><b>{plural((W.posted && W.posted.yt) || 0, 'video')}</b>on YouTube</div>
          <div className="sm-chip"><b>{plural((W.posted && W.posted.fb) || 0, 'Reel')}</b>on Facebook</div>
          <div className="sm-chip"><b>{(W.fixed || 0) + (W.replaced || 0) + (W.remade || 0)} fixed</b>by itself (no need to look)</div></div>
      </section>

      <button className="sm-more" onClick={onDetailed}>Show the details (times, queue, agent notes) <span aria-hidden="true">→</span></button>
    </div></div>
    <style dangerouslySetInnerHTML={{ __html: SIMPLE_CSS }} />
  </div>)
}

function Switch({ on, busy, disabled, title, text, onClick }) {
  return <div className="sm-sw"><div><b>{title}</b><span>{text}</span></div>
    <button className={'sm-tog' + (on ? '' : ' off')} role="switch" aria-checked={on} aria-label={title} disabled={disabled} onClick={onClick}><i /><em>{busy ? '…' : on ? 'ON' : 'OFF'}</em></button></div>
}

const SIMPLE_CSS = `
.sm{display:grid;gap:16px;--yt:#ff4e45;--fb:#4f8cff}
.sm-hero{border-radius:24px;padding:22px;display:grid;gap:14px;background:linear-gradient(150deg,rgba(143,227,106,.18),rgba(143,227,106,.04));border:1px solid rgba(143,227,106,.35)}
.sm-hero.sm-needs{background:linear-gradient(150deg,rgba(239,122,106,.2),rgba(239,122,106,.04));border-color:rgba(239,122,106,.5)}
.sm-hero.sm-low{background:linear-gradient(150deg,rgba(240,179,94,.18),rgba(240,179,94,.04));border-color:rgba(240,179,94,.45)}
.sm-hero.sm-off{background:var(--raise);border-color:var(--line)}
.sm-hrow{display:flex;gap:16px;align-items:center}
.sm-big{width:58px;height:58px;border-radius:50%;flex:none;display:grid;place-items:center;background:var(--green);color:#0a0b0a;font-size:32px;font-weight:900}
.sm-needs .sm-big{background:var(--bad)}.sm-low .sm-big{background:var(--warn)}.sm-off .sm-big{background:var(--raise2);color:var(--dim)}
.sm-t{display:block;font-family:var(--display);font-size:26px;font-weight:800;font-stretch:88%;line-height:1.1}
.sm-s{color:var(--dim);font-size:15px;line-height:1.45;display:block;margin-top:4px}
.sm-q{font-size:13px;font-weight:700;color:var(--faint);text-transform:uppercase;letter-spacing:.08em}
.sm-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
.sm-day{border-radius:12px;padding:8px 0 7px;text-align:center;background:rgba(10,11,10,.35);border:1px solid var(--line)}
.sm-day i{display:block;font-style:normal;font-size:11.5px;color:var(--dim);font-weight:700}
.sm-day em{display:block;font-style:normal;font-size:18px;margin-top:2px;color:var(--faint)}
.sm-day.full{border-color:rgba(143,227,106,.45)}.sm-day.full em{color:var(--green)}
.sm-hint{font-size:13.5px;color:var(--dim)}
.sm-need{border-radius:20px;padding:16px;background:var(--raise);border:1px solid rgba(239,122,106,.55);display:grid;gap:12px}
.sm-need b{font-size:16.5px;line-height:1.35}
.sm-btn{display:flex;align-items:center;justify-content:center;min-height:52px;border-radius:16px;font:inherit;font-weight:800;font-size:16px;border:0;cursor:pointer;text-decoration:none;padding:0 18px}
.sm-btn:disabled{opacity:.55;cursor:default}
.sm-go{background:var(--green);color:#0a0b0a}.sm-red{background:var(--bad);color:#160807}.sm-line{background:var(--raise2);color:var(--paper);border:1px solid var(--line)}
.sm-small{min-height:42px;font-size:14px;border-radius:999px}
.sm-card{background:var(--raise);border:1px solid var(--line);border-radius:22px;padding:18px;display:grid;gap:12px;min-width:0}
.sm-card h2{margin:0;font-family:var(--display);font-size:20px;font-weight:800;font-stretch:92%}
.sm-note{margin:0;color:var(--dim);font-size:14.5px;line-height:1.45}
.sm-item{display:grid;grid-template-columns:58px 40px minmax(0,1fr);gap:12px;align-items:center;padding:12px 0;border-top:1px solid var(--line)}
.sm-card h2+.sm-item{border-top:0;padding-top:0}
.sm-time{font-family:var(--display);font-size:19px;font-weight:800;font-stretch:90%}
.sm-logo{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;font-weight:900;font-size:13px}
.sm-yt{background:rgba(255,78,69,.16);color:var(--yt)}.sm-fb{background:rgba(79,140,255,.16);color:var(--fb)}
.sm-what{min-width:0}.sm-what b{display:block;font-size:15.5px;font-weight:700;line-height:1.25;overflow-wrap:anywhere}
.sm-empty .sm-what b{color:var(--dim);font-weight:600}
.sm-tag{display:inline-flex;margin-top:5px;font-size:13px;font-weight:700;padding:4px 10px;border-radius:999px}
.sm-done{background:rgba(143,227,106,.14);color:var(--green)}.sm-soon{background:rgba(240,179,94,.14);color:var(--warn)}.sm-long{background:rgba(242,239,233,.1);color:var(--paper)}.sm-none{background:var(--raise2);color:var(--dim)}
.sm-make{display:grid;gap:10px}.sm-make b{font-size:16px;overflow-wrap:anywhere}
.sm-steps{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}
.sm-st{text-align:center;font-size:11.5px;font-weight:700;color:var(--faint);line-height:1.25}
.sm-st i{display:block;height:8px;border-radius:9px;background:var(--raise2);margin-bottom:6px}
.sm-st.done{color:var(--dim)}.sm-st.done i{background:var(--green)}
.sm-st.now{color:var(--paper)}.sm-st.now i{background:linear-gradient(90deg,var(--green) 45%,var(--raise2) 45%)}
.sm-left{font-size:14px;color:var(--dim)}
.sm-chips{display:flex;gap:10px;flex-wrap:wrap}
.sm-chip{background:var(--raise2);border:1px solid var(--line);border-radius:14px;padding:10px 12px;font-size:13.5px;color:var(--dim);flex:1 1 140px}
.sm-chip b{display:block;color:var(--paper);font-size:15px}
.sm-pick{display:flex;gap:12px;align-items:flex-start;text-align:left;width:100%;padding:14px;border-radius:16px;border:1px solid var(--line);background:var(--raise2);color:var(--dim);font:inherit;font-size:14px;line-height:1.45;cursor:pointer}
.sm-pick b{display:block;color:var(--paper);font-size:16px;margin-bottom:2px}
.sm-pick.on{border-color:var(--green);background:rgba(143,227,106,.08);cursor:default}
.sm-pick:disabled:not(.on){opacity:.6;cursor:default}
.sm-radio{width:22px;height:22px;border-radius:50%;border:2px solid var(--dim);flex:none;margin-top:1px}
.sm-pick.on .sm-radio{border-color:var(--green);background:radial-gradient(circle,var(--green) 45%,transparent 50%)}
.sm-sw{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px 0;border-top:1px solid var(--line)}
.sm-card h2+.sm-sw{border-top:0;padding-top:0}
.sm-sw b{display:block;font-size:16px}.sm-sw span{font-size:14px;color:var(--dim);line-height:1.4}
.sm-tog{display:grid;justify-items:center;gap:4px;background:none;border:0;padding:0;cursor:pointer;font:inherit}
.sm-tog i{display:block;width:60px;height:34px;border-radius:999px;background:var(--green);position:relative}
.sm-tog i:after{content:"";position:absolute;right:4px;top:4px;width:26px;height:26px;border-radius:50%;background:#0a0b0a}
.sm-tog.off i{background:var(--raise2);border:1px solid var(--line)}.sm-tog.off i:after{left:4px;right:auto;background:var(--dim)}
.sm-tog em{font-style:normal;font-size:12px;font-weight:800;color:var(--green)}.sm-tog.off em{color:var(--dim)}
.sm-tog:disabled{opacity:.6;cursor:default}
.sm-more{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;padding:16px 18px;border-radius:18px;border:1px dashed var(--line);background:none;color:var(--dim);font:inherit;font-weight:700;font-size:15px;cursor:pointer;text-align:left}
.sm-more:hover{color:var(--paper)}
.sm-grid,.sm-grid>div{display:grid;gap:16px;min-width:0}
@media (min-width:980px){.sm-grid{grid-template-columns:1.2fr 1fr;align-items:start}}
@media (max-width:420px){.sm-hero{padding:18px}.sm-t{font-size:23px}.sm-item{grid-template-columns:52px 36px minmax(0,1fr);gap:10px}.sm-logo{width:36px;height:36px}}
`
