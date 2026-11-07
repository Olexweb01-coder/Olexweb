'use client'
// YouTube, the simple view (Install 15): how the channel is doing, what needs a decision, what's coming up, the best videos
// lately, and how it posts, in plain words. The detailed view (YouTube.jsx: Analytics) is one tap away.
import { SIMPLE_CSS } from './AutomationSimple'
import { showDetails } from './SimpleSwitch'

const fmt = (n) => Number(n || 0).toLocaleString('en-GB')
const plural = (n, w) => `${fmt(n)} ${w}${Number(n) === 1 ? '' : 's'}`
const dayWord = (d, today) => { if (d === today) return 'Today'; const t = new Date(today + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + 1)
  return d === t.toISOString().slice(0, 10) ? 'Tomorrow' : new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) }

export default function YouTubeSimple({ data, extra }) {
  const d = data, a = d.account || {}, t = d.totals || {}, b = d.before || {}, X = extra, C = X.counts || {}
  const ch = b.views ? Math.round(((t.views - b.views) / b.views) * 100) : null
  const series = d.series || [], max = Math.max(1, ...series.map((s) => s.views))
  const trend = ch == null ? ['steady', 'Not enough history yet to compare.'] : ch >= 10 ? ['up', `Up ${ch}% on the ${d.days} days before. It’s growing.`] : ch <= -10 ? ['down', `Down ${Math.abs(ch)}% on the ${d.days} days before.`] : ['steady', `About the same as the ${d.days} days before.`]
  const since = Date.now() - d.days * 86400e3
  const best = (d.videos || []).filter((v) => v.published_at && new Date(v.published_at).getTime() > since && v.views > 0).sort((x, y) => y.views - x.views).slice(0, 3)
  const decide = [C.scripts ? [`${plural(C.scripts, 'script')} to check`, 'What he’ll say, before it’s made', '/admin/youtube?view=scripts'] : null,
    C.ideas ? [`${plural(C.ideas, 'new website')} found`, X.autopilot ? 'Optional: Autopilot also picks the best ones' : 'Pick the ones worth a video', '/admin/youtube?view=ideas'] : null].filter(Boolean)
  return (<div className="sm">
    <section className={'sm-hero ' + (trend[0] === 'down' ? 'sm-low' : 'sm-ok')} aria-label="Your channel">
      <div className="sm-hrow">
        {a.thumb ? <img src={a.thumb} alt="" width="58" height="58" style={{ borderRadius: '50%', flex: 'none' }} referrerPolicy="no-referrer" /> : <div className="sm-big" aria-hidden="true">▶</div>}
        <div><b className="sm-t">{fmt(t.views)} views</b><span className="sm-s">in the last {d.days} days. {trend[1]}</span></div></div>
      {series.length > 1 ? <div className="ys-bars" aria-hidden="true">{series.map((s) => <i key={s.day} style={{ height: Math.max(3, Math.round(48 * s.views / max)) + 'px' }} />)}</div> : null}
      <div className="sm-chips"><div className="sm-chip"><b>{fmt(a.subscribers)}</b>subscribers{t.gained ? ` (+${fmt(t.gained)} lately)` : ''}</div>
        <div className="sm-chip"><b>{t.avg_pct == null ? '–' : Math.round(t.avg_pct) + '%'}</b>of each video watched, on average</div></div>
    </section>

    {decide.map(([title, sub, href]) => <a key={href} className="ys-link sm-need-soft" href={href}><span><b>{title}</b>{sub}</span><em aria-hidden="true">→</em></a>)}

    <div className="sm-grid"><div>
      <section className="sm-card" aria-label="Coming up">
        <h2>Coming up on YouTube</h2>
        {X.style === 'story' && C.sagas ? <div className="sm-item"><span className="sm-time">{X.sagaTime}</span><span className="sm-logo sm-yt">YT</span><div className="sm-what"><b>The next long story (ready)</b><span className="sm-tag sm-long">Long story · goes up at {X.sagaTime}</span></div></div> : null}
        {X.queue.length ? X.queue.map((v) => <div key={v.id} className="sm-item"><span className="sm-time">{v.time}</span><span className="sm-logo sm-yt">YT</span>
          <div className="sm-what"><b>{v.title}</b><span className="sm-tag sm-soon">{dayWord(v.day, X.today)}{v.kind === 'long' ? ' · long video' : ''}</span></div></div>)
          : <p className="sm-note">Nothing in line yet. Finished videos join by themselves{X.autopilot ? '' : ' once you approve their scripts'}.</p>}
        <p className="sm-note">{plural(C.ready, 'video')} finished and ready in total.</p>
      </section>

      <section className="sm-card" aria-label="Best lately">
        <h2>Your best videos lately</h2>
        {best.length ? best.map((v) => <a key={v.video_id} className="ys-vid" href={(v.is_short ? 'https://youtube.com/shorts/' : 'https://youtube.com/watch?v=') + v.video_id} target="_blank" rel="noopener noreferrer">
          {v.thumb ? <img src={v.thumb} alt="" referrerPolicy="no-referrer" loading="lazy" /> : <span className="ys-noimg" />}
          <span><b>{v.title}</b>{fmt(v.views)} views{v.avg_view_pct != null ? ` · people watched ${Math.round(v.avg_view_pct)}% of it` : ''}</span></a>)
          : <p className="sm-note">No videos with views in the last {d.days} days yet.</p>}
      </section>
    </div><div>

      <section className="sm-card" aria-label="How it posts">
        <h2>How it posts</h2>
        <div className="ys-line"><b>{X.mode === 'scheduled' ? 'Public by itself' : 'Private first'}</b><span>{X.mode === 'scheduled' ? 'Each video goes public by itself at its time.' : 'Each video goes up as Private. You make it public in YouTube Studio (until the channel audit is approved).'}</span></div>
        <div className="ys-line"><b>{X.times.length ? X.times.join(' · ') : 'No times set'}</b><span>When the Shorts go up (Lagos time).{X.style === 'story' ? ` The long story goes up at ${X.sagaTime}.` : ''}</span></div>
        <div className="ys-line"><b>{X.style === 'story' ? 'Story videos' : 'Classic Shorts'}</b><span>{X.style === 'story' ? 'A long story every day, and Shorts cut from it.' : 'One “Secret websites” Short at a time.'} Change it on Automation → Today.</span></div>
        <div className="ys-line"><b>{X.autopilot ? 'Autopilot on' : 'You approve each script'}</b><span>{X.autopilot ? 'Nothing waits for you.' : 'New scripts wait for you on Scripts.'}</span></div>
        <a className="sm-btn sm-line" href="/admin/youtube?view=scripts">Change these</a>
      </section>

      <section className="sm-card" aria-label="Everything else">
        <h2>Everything else</h2>
        {[['All videos', 'Every finished and posted video, with its numbers', '/admin/youtube?view=videos'], ['Scripts', 'What he says in each video', '/admin/youtube?view=scripts'],
          ['Ideas', 'The websites found for videos', '/admin/youtube?view=ideas'], ['The factory', 'How the video being made is getting on', '/admin/youtube?view=progress']]
          .map(([title, sub, href]) => <a key={href} className="ys-link" href={href}><span><b>{title}</b>{sub}</span><em aria-hidden="true">→</em></a>)}
      </section>

      <button className="sm-more" onClick={showDetails}>Show the details (all the numbers) <span aria-hidden="true">→</span></button>
    </div></div>
    <style dangerouslySetInnerHTML={{ __html: SIMPLE_CSS + YS_CSS }} />
  </div>)
}

export const YS_CSS = `
.ys-bars{display:flex;align-items:flex-end;gap:2px;height:50px}
.ys-bars i{flex:1;background:rgba(143,227,106,.55);border-radius:3px 3px 0 0;min-width:2px}
.ys-link{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-radius:16px;background:var(--raise2);border:1px solid var(--line);color:var(--dim);text-decoration:none;font-size:14px;line-height:1.4}
.ys-link b{display:block;color:var(--paper);font-size:16px}.ys-link em{font-style:normal;font-size:18px;color:var(--paper)}
.ys-link:hover{border-color:var(--green)}
.sm-need-soft{background:var(--raise);border-color:rgba(240,179,94,.5)}
.ys-vid{display:grid;grid-template-columns:96px minmax(0,1fr);gap:12px;align-items:center;color:var(--dim);text-decoration:none;font-size:13.5px;line-height:1.4}
.ys-vid img,.ys-noimg{width:96px;height:54px;object-fit:cover;border-radius:10px;background:var(--raise2);display:block}
.ys-vid b{display:block;color:var(--paper);font-size:15px;line-height:1.25;margin-bottom:3px;overflow-wrap:anywhere}
.ys-line{display:grid;gap:2px;padding:10px 0;border-top:1px solid var(--line)}
.sm-card h2+.ys-line{border-top:0;padding-top:0}
.ys-line b{font-size:16px}.ys-line span{color:var(--dim);font-size:14px;line-height:1.45}
.ys-per{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.ys-per button{min-height:64px;border-radius:16px;border:1px solid var(--line);background:var(--raise2);color:var(--paper);font:inherit;font-weight:800;font-size:15px;cursor:pointer}
.ys-per button b{display:block;font-size:24px;font-family:var(--display)}
.ys-per button[aria-pressed=true]{border-color:var(--green);background:rgba(143,227,106,.1);color:var(--green)}
.ys-per button:disabled{cursor:default}
`
