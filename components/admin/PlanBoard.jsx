'use client'
// The plan (Install 26): every video for the next 3 days, YouTube and Facebook each with their own. Read it, watch it once
// it's made, approve it, change its title, swap it for a different one, or leave a time empty. Nothing posts unapproved.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from './ui'
import { SIMPLE_CSS } from './AutomationSimple'

const dayName = (d, today) => {
  const diff = Math.round((Date.parse(d) - Date.parse(today)) / 86400e3)
  return diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
}
const TONE = { 'Needs you': 'pl-need', Ready: 'pl-ok', Posted: 'pl-done', Missed: 'pl-bad', Empty: 'pl-dim', Approved: 'pl-go', 'Being made': 'pl-go', 'Being made again': 'pl-go' }

export default function PlanBoard({ data, stories = null }) {
  const router = useRouter(), D = data, [busy, setBusy] = useState(''), [edit, setEdit] = useState(null), [title, setTitle] = useState('')
  const [tab, setTab] = useState((D.channels[0] || {}).key || 'youtube')
  async function act(key, body, ok) {
    setBusy(key)
    try {
      const r = await fetch('/admin/api/youtube', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) }), j = await r.json().catch(() => ({}))
      if (r.status === 401) { window.location.assign('/admin/login'); return false }
      if (!r.ok) { toast(j.error || 'That didn’t work. Try again.'); return false }
      toast(typeof ok === 'function' ? ok(j) : ok); router.refresh(); return true
    } catch { toast('No connection. Try again.'); return false } finally { setBusy('') }
  }
  if (!D.channels.length) return (<div className="sm"><section className="sm-card"><h2>Nothing to plan yet</h2>
    <p className="sm-note">Connect YouTube (and your Facebook Page) first. The plan fills itself once a channel is connected.</p></section><style dangerouslySetInnerHTML={{ __html: SIMPLE_CSS + CSS }} /></div>)
  const C = D.channels.find((c) => c.key === tab) || D.channels[0]
  return (<div className="sm pl">
    <section className={'sm-hero ' + (D.on ? (D.waiting ? 'sm-needs' : 'sm-ok') : 'sm-off')} aria-label="Status">
      <div className="sm-hrow"><div className="sm-big" aria-hidden="true">{!D.on ? '–' : D.waiting ? D.waiting : '✓'}</div>
        <div><b className="sm-t">{!D.on ? 'The plan is off.' : D.waiting ? `${D.waiting} video${D.waiting === 1 ? '' : 's'} wait${D.waiting === 1 ? 's' : ''} for you.` : 'Everything planned is approved.'}</b>
          <span className="sm-s">{!D.on ? 'Videos go out the old way (one queue for both channels).'
            : D.mode === 'autopilot' ? 'Autopilot approves new videos itself. You can still swap or remove any of them here before its time.'
            : 'The next 3 days, planned. Each channel gets its own video, and nothing posts until you approve it.'}</span></div></div>
      <div className="pl-top">
        {D.on && D.waiting ? <button className="sm-btn sm-go" disabled={!!busy} onClick={() => act('all', { action: 'plan-approve-all' }, (j) => `${j.approved} approved. They’ll be made and posted at their times.`)}>{busy === 'all' ? 'Approving…' : `Approve all ${D.waiting}`}</button> : null}
        {D.on ? <button className="sm-btn sm-line" disabled={!!busy} onClick={() => act('write', { action: 'plan-write-now' }, (j) => j.script ? 'The next video is written.' : j.failed || j.waiting || j.note || 'Done.')}>{busy === 'write' ? 'Writing… (about a minute)' : 'Write the next one now'}</button> : null}
        <button className="sm-btn sm-line" disabled={!!busy} onClick={() => act('on', { action: 'plan-on', on: !D.on }, D.on ? 'The plan is off.' : 'The plan is on.')}>{D.on ? 'Turn the plan off' : 'Turn the plan on'}</button>
      </div>
    </section>

    <nav className="pl-ch" role="tablist" aria-label="Channel">
      {D.channels.map((c) => { const n = c.slots.filter((s) => s.needsYou).length
        return <button key={c.key} role="tab" aria-selected={c.key === C.key} onClick={() => setTab(c.key)}>{c.name}{n ? <i>{n}</i> : null}</button> })}
    </nav>
    {C.off ? <p className="pl-warn">{C.off}</p> : null}
    <p className="sm-note">{C.name} posts at {C.times.join(', ')} (Lagos time).</p>

    <div className="pl-days">
      {D.days.map((d) => { const list = C.slots.filter((s) => s.day === d)
        return (<section key={d} className="sm-card pl-day" aria-label={dayName(d, D.today)}>
          <h2>{dayName(d, D.today)}</h2>
          {list.length ? list.map((s) => (<article key={s.id} className="pl-slot">
            <div className="pl-head"><span className="sm-time">{s.time}</span><span className="pl-fmt">{s.formatName}</span><span className={'pl-st ' + (TONE[s.label] || '')}>{s.label}</span></div>
            {edit === s.id ? <form className="pl-edit" onSubmit={async (e) => { e.preventDefault(); if (await act('t' + s.id, { action: 'plan-title', id: s.id, title }, 'Title changed.')) setEdit(null) }}>
                <input value={title} maxLength={90} onChange={(e) => setTitle(e.target.value)} aria-label="Title" autoFocus />
                <button className="sm-btn sm-go" disabled={!!busy}>Save</button><button type="button" className="sm-btn sm-line" onClick={() => setEdit(null)}>Cancel</button></form>
              : <b className="pl-title">{s.title ? s.title.replace(/\s*#shorts\s*$/i, '') : <span className="pl-dimt">{s.hint}</span>}</b>}
            {s.story ? <span className="pl-site">{s.story.logline}{s.story.cast ? <><br />With {s.story.cast}{s.story.city ? ', in ' + s.story.city : ''}</> : null}</span> : s.site ? <span className="pl-site">{s.format === 'versus' ? 'Business: ' : s.format === 'build' ? '' : 'Website: '}{s.site}</span> : null}
            {s.title && s.hint ? <span className="pl-hint">{s.hint}</span> : null}
            {s.failing.length && s.needsYou ? <ul className="pl-fail">{s.failing.map((f, i) => <li key={i}>{f}</li>)}</ul> : null}
            {s.lines.length ? <details className="pl-words"><summary>Read the words ({s.lines.length} lines{s.seconds ? `, about ${Math.round(s.seconds)} s` : ''})</summary><ol>{s.lines.map((l, i) => <li key={i}>{l}</li>)}</ol></details> : null}
            {s.video ? <details className="pl-words"><summary>Watch the video</summary><video controls preload="none" playsInline src={'/admin/api/youtube/video?id=' + s.scriptId} /></details> : null}
            {s.ytId ? <a className="pl-link" href={'https://youtu.be/' + s.ytId} target="_blank" rel="noopener noreferrer">Open on YouTube ↗</a> : null}
            {s.canAct ? <div className="pl-acts">
              {s.needsYou ? <button className="sm-btn sm-go" disabled={!!busy} onClick={() => act('a' + s.id, { action: 'plan-approve', id: s.id }, 'Approved. It’ll be made and posted at ' + s.time + '.')}>{busy === 'a' + s.id ? '…' : 'Approve'}</button> : null}
              {s.title && s.scriptStatus !== 'rendering' ? <button className="sm-btn sm-line" disabled={!!busy} onClick={() => { setEdit(s.id); setTitle((s.title || '').replace(/\s*#shorts\s*$/i, '')) }}>Change title</button> : null}
              {s.scriptStatus !== 'rendering' ? <button className="sm-btn sm-line" disabled={!!busy} onClick={() => act('s' + s.id, { action: 'plan-swap', id: s.id }, (j) => j.written ? 'Swapped for a different video.' : (j.note || 'Swapped. The new one is written shortly.'))}>{busy === 's' + s.id ? 'Writing a different one…' : 'Swap'}</button> : null}
              {s.scriptStatus !== 'rendering' ? <button className="sm-btn sm-line pl-x" disabled={!!busy} onClick={() => { if (window.confirm('Leave ' + s.time + ' empty? Its video is thrown away.')) act('k' + s.id, { action: 'plan-skip', id: s.id }, 'Left empty.') }}>Leave empty</button> : null}
            </div> : null}
          </article>)) : <p className="sm-note">No posting time left on this day.</p>}
        </section>) })}
    </div>
    {stories ? <Stories S={stories} act={act} busy={busy} /> : null}
    <p className="sm-note">Every video is “You build it” in 3D: you want something simple, the first fix is silly, every fix causes the next problem, until “Congratulations! You just built…” the real invention. A new tech or internet topic every time, never repeated. One a day on YouTube, three a week on Facebook. A video that misses its time moves to the next free time instead of being wasted.</p>
    <style dangerouslySetInnerHTML={{ __html: SIMPLE_CSS + CSS }} />
  </div>)
}
// Install 29: the daily Facebook story (words and pictures). They post by themselves at their time after the checks.
function Stories({ S, act, busy }) {
  return (<section className="sm-card pl-stories" aria-label="Daily stories">
    <div className="pl-sh"><h2>Daily stories</h2>
      <button className="sm-btn sm-line" disabled={!!busy} onClick={() => act('so', { action: 'plan-stories', on: !S.on }, S.on ? 'Daily stories are off.' : 'Daily stories are on.')}>{S.on ? 'Turn stories off' : 'Turn stories on'}</button></div>
    <p className="sm-note">A story in words and pictures every day at {S.time} (Lagos): Tayo’s World, True tech stories and The turnaround in turn. Each one is checked and then posts by itself, with the link in the first comment. Facebook videos go out on Monday, Wednesday and Friday.{S.fbOn ? '' : ' Facebook posting is off, so nothing posts until you turn it on.'}</p>
    {S.stories.length ? S.stories.map((x) => (<article key={x.id} className="pl-story">
      <div className="pl-head"><span className="sm-time">{x.day === S.today ? 'Today' : new Date(x.day + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span><span className="pl-fmt">{x.seriesName}{x.episode ? ' · Episode ' + x.episode : ''}</span>
        <span className={'pl-st ' + ({ ready: 'pl-ok', posted: 'pl-done', skipped: 'pl-bad', missed: 'pl-bad' })[x.status]}>{({ ready: 'Goes out at ' + S.time, posted: 'Posted', skipped: 'Not posting', missed: 'Missed' })[x.status]}</span></div>
      <b className="pl-title">{x.title}</b>
      {x.note ? <span className="pl-hint">{x.note}</span> : null}
      <div className="pl-slides">{x.images.map((src, i) => <img key={i} src={src} alt={'Slide ' + (i + 1)} loading="lazy" />)}</div>
      <details className="pl-words"><summary>Read the post</summary><p className="pl-post">{x.post}</p><p className="pl-hint">First comment: {x.comment}</p></details>
      {['ready', 'skipped', 'missed'].includes(x.status) ? <div className="pl-acts">
        <button className="sm-btn sm-line" disabled={!!busy} onClick={() => act('sr' + x.id, { action: 'plan-story-rewrite', id: x.id }, (j) => j.status === 'ready' ? 'Rewritten.' : (j.note || 'Rewritten, but it didn’t pass the checks.'))}>{busy === 'sr' + x.id ? 'Writing… (about a minute)' : 'Write a different one'}</button>
        {x.status === 'ready' ? <button className="sm-btn sm-line pl-x" disabled={!!busy} onClick={() => act('ss' + x.id, { action: 'plan-story-stop', id: x.id }, 'It won’t be posted.')}>Don’t post this one</button> : null}
      </div> : null}
    </article>)) : <p className="sm-note">The next three days’ stories are written over the next few runs.</p>}
  </section>)
}
const CSS = `
.pl-stories{margin:6px 0 14px}.pl-sh{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.pl-story{border-top:1px solid var(--line);padding:14px 0;display:flex;flex-direction:column;gap:8px}
.pl-slides{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px}.pl-slides img{flex:none;width:150px;aspect-ratio:4/5;border-radius:8px;object-fit:cover;background:#111}
.pl-post{white-space:pre-wrap;font-size:14.5px;line-height:1.55;margin:8px 0}
.pl-top{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.pl-ch{display:flex;gap:6px;margin:18px 0 8px}
.pl-ch button{padding:8px 16px;border-radius:999px;border:1px solid var(--line);background:none;color:var(--dim);font:inherit;font-weight:700;cursor:pointer}
.pl-ch button[aria-selected=true]{background:var(--green);border-color:var(--green);color:#06140a}
.pl-ch i{font-style:normal;margin-left:6px;background:#e5484d;color:#fff;border-radius:999px;padding:0 7px;font-size:12px}
.pl-warn{margin:6px 0;padding:10px 12px;border-radius:10px;background:rgba(229,72,77,.12);color:var(--paper);font-size:14px}
.pl-days{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:10px 0 14px}
@media (max-width:980px){.pl-days{grid-template-columns:1fr}}
.pl-day{display:flex;flex-direction:column;justify-content:flex-start;align-content:start;gap:0}
.pl-day h2{margin-bottom:8px}
.pl-slot{border-top:1px solid var(--line);padding:12px 0;display:flex;flex-direction:column;gap:6px}
.pl-slot:first-of-type{border-top:0;padding-top:4px}
.pl-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.pl-fmt{font-size:12.5px;color:var(--dim);font-weight:700}
.pl-st{margin-left:auto;font-size:12px;font-weight:800;padding:2px 9px;border-radius:999px;background:rgba(255,255,255,.08);color:var(--dim)}
.pl-need{background:rgba(245,166,35,.18);color:#f5a623}.pl-ok{background:rgba(46,204,113,.16);color:var(--green)}.pl-done{background:rgba(46,204,113,.1);color:var(--green)}
.pl-bad{background:rgba(229,72,77,.15);color:#ff6b6b}.pl-go{background:rgba(90,150,255,.15);color:#8fb4ff}.pl-dim{opacity:.7}
.pl-title{font-size:15.5px;line-height:1.35}.pl-dimt{font-weight:500;color:var(--dim)}
.pl-site,.pl-hint{font-size:13px;color:var(--dim)}
.pl-fail{margin:0;padding-left:18px;font-size:13px;color:#f5a623}
.pl-words summary{cursor:pointer;font-size:13.5px;font-weight:700;color:var(--green)}
.pl-words ol{margin:8px 0 0;padding-left:20px;font-size:14px;line-height:1.5}
.pl-words video{width:100%;max-width:280px;margin-top:8px;border-radius:10px;background:#000;aspect-ratio:9/16}
.pl-link{font-size:13.5px;color:var(--green)}
.pl-acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.pl-acts .sm-btn{padding:7px 12px;font-size:13.5px}
.pl-x{color:#ff8a8a}
.pl-edit{display:flex;gap:6px;flex-wrap:wrap}.pl-edit input{flex:1 1 200px;min-width:0;padding:8px 10px;border-radius:8px;border:1px solid var(--line);background:transparent;color:var(--paper);font:inherit}
`
