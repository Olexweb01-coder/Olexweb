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

export default function PlanBoard({ data }) {
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
            {s.site ? <span className="pl-site">{s.format === 'versus' ? 'Business: ' : s.format === 'build' ? '' : 'Website: '}{s.site}</span> : null}
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
    <p className="sm-note">How the plan chooses: a different format every time on each channel, never the same format on YouTube and Facebook on the same day, and Poor vs Rich at most once a week. A video that misses its time (not approved, or not finished) moves to the next free time instead of being wasted.</p>
    <style dangerouslySetInnerHTML={{ __html: SIMPLE_CSS + CSS }} />
  </div>)
}
const CSS = `
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
