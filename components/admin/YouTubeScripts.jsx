'use client'
// YouTube → Scripts: each picked idea's Short, scene by scene, with the checks it passed and the quotes behind its claims.
// Edit any line, choose the title, then approve it for the factory.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from './ui'
import JobProgress from './JobProgress'

const card = { padding: 18, borderRadius: 20, background: 'var(--raise)', border: '1px solid var(--line)' }
const dim = { color: 'var(--dim)' }
const h3 = { margin: '0 0 8px', fontSize: 14, fontWeight: 700 }
const STATUS = { needs_review: ['Needs your eye', 'draft'], draft: ['Ready for review', 'res'], approved: ['Approved for the factory', 'live'], rendering: ['In the factory', 'res'], rendered: ['Video ready', 'live'], uploaded: ['Uploaded', 'live'], failed: ['The factory stopped', 'draft'] }
const TYPE = { hook: 'Hook', demo: 'The site', infographic: 'Infographic', talk: 'Talk', url: 'Address', cta: 'Follow',
  'story-yell': 'The peak (opens the video)', 'story-timejump': 'Time jump', 'story-desk': 'Setup', 'story-buzz': 'The trigger', 'story-read': 'Reads it out', 'story-panic': 'Panic', 'story-cry': 'Crying', 'story-idea': 'The idea', 'story-reveal': 'The site', 'story-proof': 'Proof', 'story-celebrate': 'Celebration', 'story-again': 'The loop', 'story-intro': 'Hello (to camera)', 'story-chapter': 'Chapter card', 'story-outro': 'Goodbye' }
const POSE = { shocked: '😮', pointing: '👉', thinking: '🤔', dancing: '🕺', waving: '👋', idle: '🙂', panic: '😱', shock: '😮', cry: '😭', excited: '🤩', happy: '😄', calm: '🙂', curious: '🤔', smug: '😏', focus: '🧐' }

async function call(body) {
  const r = await fetch('/admin/api/youtube', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (r.status === 401) { window.location.assign('/admin/login'); return null }
  if (!r.ok) throw new Error(j.error || 'Something went wrong. Try again.')
  return j
}

export default function YouTubeScripts({ data }) {
  const router = useRouter(), [busy, setBusy] = useState(null), [err, setErr] = useState('')
  async function run(key, body, msg) {
    setBusy(key); setErr('')
    try { const j = await call(body); if (j) { toast(typeof msg === 'function' ? msg(j) : msg); router.refresh() } } catch (e) { setErr(e.message) } finally { setBusy(null) }
  }
  return (<>
    <p style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.55, ...dim }}>Each picked idea gets a 20–35 second script. The checks run in code: a short hook first, one cut per line, real footage of the site, no year numbers, and every fact backed by a quote from the site’s own page. In Autopilot, a script that passes everything is approved by itself.</p>
    <JobProgress kind="script" title="Writing the script" watch={/^[wr]\d|^ws/.test(busy || '')} onDone={() => router.refresh()} />
    <JobProgress kind="upload" title="Uploading to YouTube" watch={/^u\d/.test(busy || '')} onDone={() => router.refresh()} />
    <Publishing st={data.settings} run={run} busy={busy} />
    <StoryStyle st={data.settings} run={run} busy={busy} waiting={data.waiting.length} />
    <JobProgress kind="render" title="Making the video" watch={data.scripts.some((x) => x.status === 'rendering') || /^f\d/.test(busy || '')} onDone={() => router.refresh()} />
    {!data.settings.factory ? <p style={{ ...card, margin: '0 0 12px', padding: '12px 16px', fontSize: 13.5, lineHeight: 1.55, ...dim }}>The video factory isn’t connected yet: it needs FACTORY_SECRET in Vercel and in the factory’s GitHub secrets (see the setup steps).</p> : null}
    {err ? <p className="err" role="alert" style={{ margin: '0 0 12px' }}>{err}</p> : null}
    {data.waiting.length ? <section style={{ ...card, marginBottom: 12 }} aria-label="Waiting for a script">
      <h2 style={{ ...h3, fontSize: 16 }}>Picked, waiting for a script</h2>
      <div style={{ display: 'grid', gap: 8 }}>{data.waiting.map((w) => <div key={w.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span><b>{w.name}</b> <span style={dim}>· {w.score}/100</span></span>
        <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-green" disabled={!!busy} onClick={() => run('w' + w.id, { action: 'write-script', id: w.id }, (j) => j.status === 'replaced' ? 'It didn’t pass its checks; it will be written again.' : j.status === 'needs_review' ? 'Written, but it needs your eye.' : 'Script written.')}>{busy === 'w' + w.id ? 'Writing…' : 'Write script now'}</button>
          {data.settings.short_style !== 'story' ? <button className="btn btn-line" disabled={!!busy} onClick={() => run('ws' + w.id, { action: 'write-story', id: w.id }, (j) => j.message || (j.status === 'needs_review' ? 'Story written, but it needs your eye.' : 'Story written.'))}>{busy === 'ws' + w.id ? 'Writing the story…' : 'Write as a story'}</button> : null}
        </span>
      </div>)}</div>
    </section> : null}
    {data.scripts.length ? <div style={{ display: 'grid', gap: 12 }}>{data.scripts.map((s) => <Script key={s.id} s={s} st0={data.settings} busy={busy} run={run} factory={data.settings.factory} rendering={data.scripts.some((x) => x.status === 'rendering')} />)}</div>
      : !data.waiting.length ? <section style={card}><p style={{ margin: 0, lineHeight: 1.6, ...dim }}>No scripts yet. Pick an idea with “Make a video” on the Ideas tab and its script appears here.</p></section> : null}
  </>)
}

// Lagos time (UTC+1 all year), formatted the same on the server and in the browser (no hydration mismatch)
const lagos = (d) => { const t = new Date(new Date(d).getTime() + 3600e3); return String(t.getUTCHours()).padStart(2, '0') + ':' + String(t.getUTCMinutes()).padStart(2, '0') }
// New Shorts: the story style (sketch, his acted voice) or the classic style. While classic, a test story can be written:
// its video waits for you (it isn't queued or posted by itself) until you switch new Shorts to story.
function StoryStyle({ st, run, busy, waiting }) {
  const story = st.short_style === 'story', [sagaTime, setSagaTime] = useState(st.saga_time || '16:00')
  return (<section style={{ ...card, marginBottom: 12, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10 }} aria-label="Short style">
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
      <h2 style={{ ...h3, fontSize: 16, margin: 0 }}>New Shorts</h2>
      <div role="radiogroup" aria-label="Style of new Shorts" style={{ display: 'flex', gap: 6 }}>
        {[['story', 'Story (sketch)'], ['classic', 'Classic']].map(([k, l]) => <button key={k} role="radio" aria-checked={st.short_style === k} className={st.short_style === k ? 'btn btn-green' : 'btn btn-line'} disabled={!!busy || st.short_style === k}
          onClick={() => { if (k !== 'story' || window.confirm('Make every new Short a story video? Videos already made stay as they are.')) run('style', { action: 'short-style', style: k }, k === 'story' ? 'New Shorts are now stories.' : 'New Shorts are classic again.') }}>{l}</button>)}
      </div>
    </div>
    <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, ...dim }}>{story
      ? 'Every new Short is a story: he lives a relatable moment, panics, and the site saves the day, in his own acted voice. The main video is a real story: a scam thriller, a hustle story or a mystery in turn, set in the UK or the US, with its own cast, places and voices, cliffhangers and a twist. Your picked websites become the story Shorts, one by one.'
      : 'New Shorts use the classic style. Try a story first: it’s written and made like any Short, but its video waits for you here (it isn’t queued or posted) until you switch new Shorts to story.'}</p>
    {story ? <div style={{ display: 'grid', gap: 8, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <b style={{ fontSize: 14 }}>The long story</b>
        <label style={{ fontSize: 14, display: 'flex', gap: 8, alignItems: 'center' }}>goes up daily at <input className="input" type="time" value={sagaTime} onChange={(e) => setSagaTime(e.target.value)} style={{ width: 120 }} /> Lagos</label>
        {sagaTime !== (st.saga_time || '16:00') ? <button className="btn btn-green" disabled={!!busy} onClick={() => run('stime', { action: 'saga-time', time: sagaTime }, 'Saved: the long story goes up at ' + sagaTime + '.')}>Save time</button> : null}
        <button className="btn btn-line" disabled={!!busy} onClick={() => run('wsaga', { action: 'write-saga' }, (j) => `Long story written: ${j.chapters} chapters, plus ${(j.shorts || []).length} Shorts cut from it.`)}>{busy === 'wsaga' ? 'Writing… (2–4 minutes)' : 'Write today’s long story now'}</button>
      </div>
      {st.formats ? <span style={{ fontSize: 12.5, ...dim }}>The five formats take turns. Next long story: “{st.formats.long}”. Next Short: “{st.formats.short}”.</span> : null}
    </div> : null}
    {!story ? <div><button className="btn btn-line" disabled={!!busy || !waiting} onClick={() => run('ws', { action: 'write-story' }, (j) => j.message || (j.status === 'needs_review' ? 'Story written, but it needs your eye.' : 'Story written. Send it to the factory to see it.'))}>{busy === 'ws' ? 'Writing the story…' : 'Write a test story'}</button>
      {!waiting ? <span style={{ fontSize: 13, marginLeft: 8, ...dim }}>Pick an idea first (Ideas tab).</span> : null}</div> : null}
  </section>)
}
function Script({ s, st0, busy, run, factory, rendering }) {
  const sc = s.script.scenes, pk = { ...s.package, titles: (s.package && s.package.titles) || [] }, [st, pill] = STATUS[s.status] || [s.status, 'draft']
  const editable = ['draft', 'needs_review', 'approved'].includes(s.status)
  const [edit, setEdit] = useState(null)
  const failed = (s.checks || []).filter((c) => !c.ok), wide = s.kind === 'long' || s.kind === 'saga'
  function start() { setEdit({ scenes: sc.map((x) => ({ text: x.text, big: x.big || '' })), title: pk.title, titles: pk.titles, description: pk.description, hashtags: (pk.hashtags || []).join(' ') }) }
  const save = () => run('s' + s.id, { action: 'save-script', id: s.id, edit: { ...edit, hashtags: edit.hashtags.split(/\s+/).filter(Boolean) } }, (j) => { setEdit(null); return j.status === 'needs_review' ? `Saved (${j.seconds}s), but a check still fails.` : `Saved and checked: ${j.seconds}s.` })
  return (<article style={{ ...card, display: 'grid', gap: 14, borderColor: s.status === 'needs_review' ? 'rgba(255,209,102,.45)' : 'var(--line)' }} aria-labelledby={'sc' + s.id}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0 }}>
        <h2 id={'sc' + s.id} style={{ margin: 0, fontFamily: 'var(--display)', fontWeight: 800, fontStretch: '88%', fontSize: 21 }}>{s.kind === 'long' ? `Long video · Vol. ${s.script.volume}` : s.kind === 'saga' ? (pk.title || 'Long story') : s.name || s.script.site.name}{s.kind === 'story' || s.kind === 'saga' ? <span className="pill live" style={{ marginLeft: 8, fontSize: 12, verticalAlign: 'middle' }}>{s.kind === 'saga' ? 'Long story' : 'Story'}</span> : null}</h2>
        <div style={{ fontSize: 13, marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', ...dim }}>
          <span className={'pill ' + pill}>{st}</span>{s.part ? <span>Part {s.part}</span> : null}<span>{wide ? `about ${Math.round(s.seconds / 60 * 10) / 10} min · ${(s.script.chapters || []).filter((c) => c.site || s.script.mode === 'tale').length} ${s.kind === 'saga' ? 'chapters' : 'sites'}${s.script.mode === 'tale' ? ' · ' + ({ scam: 'scam thriller', hustle: 'hustle story', mystery: 'mystery' }[s.script.genre] || 'story') + (s.script.city ? ', ' + s.script.city : '') : ''}` : `${s.seconds}s · ${sc.length} scenes`}</span>{s.script.from ? <span>· cut from a long story (chapter {s.script.from.chapter})</span> : null}{s.writer ? <span>· written by {s.writer}</span> : null}{s.mention ? <span>· mentions olexweb.com</span> : null}
        </div>
      </div>
    </div>
    {s.hold_until && s.status === 'needs_review' ? <p style={{ margin: 0, fontSize: 14, ...dim }}><b style={{ color: 'var(--paper)' }}>Autopilot:</b> it goes ahead by itself at {lagos(s.hold_until)} (Lagos) unless you change it. Anything critical is thrown away and written again.</p> : null}
    {Array.isArray(s.auto_fixes) && s.auto_fixes.length ? <details style={{ fontSize: 14, ...dim }}><summary style={{ cursor: 'pointer' }}>Autopilot fixed {s.auto_fixes.length} thing{s.auto_fixes.length === 1 ? '' : 's'} itself</summary><ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{s.auto_fixes.map((f, i) => <li key={i}>{f}</li>)}</ul></details> : null}

    {s.status === 'rendered' && s.video ? <section aria-label="The finished video" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <video controls preload="metadata" playsInline src={'/admin/api/youtube/video?id=' + s.id} style={{ width: wide ? 'min(100%, 560px)' : 'min(100%, 300px)', aspectRatio: wide ? '16 / 9' : '9 / 16', borderRadius: 16, background: '#000', border: '1px solid var(--line)' }} />
      <div style={{ fontSize: 14, lineHeight: 1.6, ...dim, flex: '1 1 200px' }}>
        <b style={{ color: 'var(--paper)', fontSize: 16 }}>{s.kind === 'long' ? `Vol. ${s.script.volume} is ready` : s.kind === 'saga' ? 'The long story is ready' : (s.part ? `Part ${s.part} is ready` : 'The video is ready')}</b><br />
        {Math.round(s.video.seconds || 0)} seconds · {s.video.width}×{s.video.height} · {(s.video.bytes / 1048576).toFixed(1)} MB<br />
        Made {new Date(s.video.made_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.
        {s.video.fb ? <>Facebook gets its own version (it ends on his question, not the loop).<br /></> : null}
        <div style={{ marginTop: 10 }}>{s.kind === 'saga' ? <span>It goes up by itself at its own time ({st0.saga_time || '16:00'} Lagos) on Autopilot.</span> : s.queue_pos != null ? <a className="btn btn-line" href="/admin/youtube?view=videos">Queued: see Up next</a> : <button className="btn btn-green" disabled={!!busy} onClick={() => run('q' + s.id, { action: 'queue-add', id: s.id }, 'Added to the queue: one video a day.')}>{busy === 'q' + s.id ? 'Adding…' : 'Add to queue'}</button>}</div>
      </div>
    </section> : null}
    {s.status === 'uploaded' ? <p style={{ margin: 0, padding: '10px 14px', borderRadius: 14, border: '1px solid rgba(143,227,106,.35)', fontSize: 14, lineHeight: 1.6 }}>
      <b>{s.kind === 'long' ? `On YouTube (Vol. ${s.script.volume})` : s.kind === 'saga' ? 'On YouTube (long story)' : (s.part ? `On YouTube as part ${s.part}` : 'On YouTube')}</b> · {s.upload && s.upload.done ? s.upload.done.replace('until', 'until').replace(/T(\d\d:\d\d).*$/, ' $1 UTC') : 'private'} ·{' '}
      <a href={(wide ? 'https://youtube.com/watch?v=' : 'https://youtube.com/shorts/') + s.yt_video_id} target="_blank" rel="noopener noreferrer">watch</a> · <a href={'https://studio.youtube.com/video/' + s.yt_video_id + '/edit'} target="_blank" rel="noopener noreferrer">open in YouTube Studio</a></p> : null}
    {s.status === 'failed' ? <p role="alert" style={{ margin: 0, padding: '10px 14px', borderRadius: 14, border: '1px solid rgba(255,107,107,.45)', fontSize: 14, lineHeight: 1.5 }}><b>The factory stopped:</b> {s.render_error || 'unknown reason'}</p> : null}
    {['approved', 'failed', 'rendered'].includes(s.status) ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <button className={s.status === 'rendered' ? 'btn btn-line' : 'btn btn-green'} disabled={!!busy || !factory || rendering} onClick={() => { if (s.status !== 'rendered' || window.confirm('Make this video again? The current one is replaced.')) run('f' + s.id, { action: 'send-to-factory', id: s.id }, (j) => j.part ? `Sent to the factory as part ${j.part}.` : 'Sent to the factory.') }}>
        {busy === 'f' + s.id ? 'Sending…' : s.status === 'rendered' ? 'Make it again' : s.status === 'failed' ? 'Try again' : 'Send to the factory'}</button>
      {rendering && s.status !== 'rendering' ? <span style={{ fontSize: 13, ...dim }}>The factory makes one video at a time; this one can go next.</span> : null}
    </div> : null}

    <div style={{ display: 'grid', gap: 8 }} role="list" aria-label="Scenes">
      {sc.map((x, i) => [s.kind === 'saga' && (i === 0 || sc[i - 1].ch !== x.ch) ? <div key={'sg' + i} style={{ marginTop: i ? 8 : 0, fontWeight: 800, fontSize: 15 }}>{x.ch < 0 ? 'Hello' : x.ch >= (s.script.chapters || []).length ? 'Goodbye' : `Chapter ${x.ch + 1}: ${((s.script.chapters || [])[x.ch] || {}).title || ''}${((s.script.chapters || [])[x.ch] || {}).time ? ' · ' + s.script.chapters[x.ch].time : ''} · ${({ update: 'Tech update: ', guide: 'How-to: ', alert: 'Safety alert: ' })[((s.script.chapters || [])[x.ch] || {}).type] || ''}${(((s.script.chapters || [])[x.ch] || {}).site || {}).name || ''}`}</div> : null, s.kind === 'long' && (i === 0 || sc[i - 1].seg !== x.seg) ? <div key={'ch' + x.seg} style={{ marginTop: i ? 8 : 0, fontWeight: 800, fontSize: 15 }}>{x.seg < 0 ? 'Intro' : x.seg >= ((s.script.chapters || []).filter((c) => c.site || s.script.mode === 'tale').length) ? 'Outro' : `Chapter ${x.seg + 1}: ${((s.script.chapters || []).find((c) => c.seg === x.seg) || {}).title || ''}`}</div> : null, <div key={x.id} role="listitem" style={{ display: 'grid', gridTemplateColumns: '30px minmax(0,1fr)', gap: 10, padding: '10px 12px', borderRadius: 14, background: 'rgba(242,239,233,.04)', border: '1px solid var(--line)' }}>
        <span aria-hidden="true" style={{ fontSize: 20, lineHeight: '24px' }}>{POSE[x.pose] || '🙂'}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', ...dim }}>{i + 1}. {TYPE[x.type] || x.type}{x.capture ? <span style={{ textTransform: 'none', fontWeight: 500, letterSpacing: 0 }}> · film: {x.capture}</span> : null}</div>
          {edit ? <>
            <textarea className="input" aria-label={`Scene ${i + 1} line`} rows={2} value={edit.scenes[i].text} onChange={(e) => setEdit({ ...edit, scenes: edit.scenes.map((y, k) => (k === i ? { ...y, text: e.target.value } : y)) })} style={{ width: '100%', marginTop: 6, fontSize: 15 }} />
            <input className="input" aria-label={`Scene ${i + 1} on-screen words`} placeholder="On-screen words (optional)" value={edit.scenes[i].big} onChange={(e) => setEdit({ ...edit, scenes: edit.scenes.map((y, k) => (k === i ? { ...y, big: e.target.value } : y)) })} style={{ width: '100%', marginTop: 6 }} />
          </> : <>
            <p style={{ margin: '4px 0 0', fontSize: 15.5, lineHeight: 1.45 }}>{x.text}</p>
            {x.big ? <p style={{ margin: '4px 0 0', fontWeight: 800, fontSize: 13.5, color: 'var(--green)' }}>On screen: {x.big}</p> : null}
            {x.stats ? <p style={{ margin: '4px 0 0', fontSize: 13, ...dim }}>{x.stats.map((t) => t.value + ' ' + t.label).join(' · ')}</p> : null}
            {x.chips ? <p style={{ margin: '4px 0 0', fontSize: 13, ...dim }}>{x.chips.join(' · ')}</p> : null}
          </>}
        </div>
      </div>])}
    </div>

    {s.kind === 'story' && s.script.story && s.script.story.ask ? <p style={{ margin: 0, fontSize: 14, ...dim }}><b style={{ color: 'var(--paper)' }}>Facebook’s ending:</b> “{s.script.story.ask}” (instead of the loop, so people comment)</p> : null}
    {s.kind === 'story' && Array.isArray(s.script.ideas) && s.script.ideas.length ? <details style={{ fontSize: 14, ...dim }}><summary style={{ cursor: 'pointer' }}>The 10 situations it considered (the best one was written)</summary>
      <ol style={{ margin: '8px 0 0', paddingLeft: 20, display: 'grid', gap: 4 }}>{s.script.ideas.map((x, i) => <li key={i} style={i === s.script.chosen ? { color: 'var(--paper)', fontWeight: 600 } : {}}>{x.situation} <span style={dim}>({(x.score || []).reduce((a, b) => a + b, 0)}/30{i === s.script.chosen ? ', chosen' : ''})</span></li>)}</ol></details> : null}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 14 }}>
      <section aria-label="Checks"><h3 style={h3}>Checks</h3><ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 5, fontSize: 13.5, lineHeight: 1.45 }}>
        {(s.checks || []).map((c) => <li key={c.key} style={{ display: 'flex', gap: 8 }}><span aria-label={c.ok ? 'passed' : 'failed'} style={{ color: c.ok ? 'var(--green)' : '#ffd166', fontWeight: 800 }}>{c.ok ? '✓' : '!'}</span><span style={c.ok ? dim : {}}>{c.note}</span></li>)}
      </ul></section>
      <section aria-label="Claims"><h3 style={h3}>What it claims, and the site’s own words</h3>
        {(s.claims || []).length ? <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8, fontSize: 13.5, lineHeight: 1.45 }}>
          {s.claims.map((c, i) => <li key={i}><b style={{ fontWeight: 600 }}>{c.claim}</b><br /><span style={dim}>“{c.quote}”</span></li>)}</ul> : <p style={{ margin: 0, fontSize: 13.5, ...dim }}>No factual claims.</p>}
      </section>
    </div>

    <section aria-label="Title and description" style={{ display: 'grid', gap: 8 }}>
      <h3 style={{ ...h3, margin: 0 }}>Title</h3>
      {edit ? <div role="radiogroup" aria-label="Choose the title" style={{ display: 'grid', gap: 6 }}>
        {edit.titles.map((t, i) => <label key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14.5 }}>
          <input type="radio" name={'t' + s.id} checked={edit.title === t} onChange={() => setEdit({ ...edit, title: t })} style={{ width: 18, height: 18, accentColor: 'var(--green)' }} />
          <input className="input" aria-label={`Title option ${i + 1}`} value={t} onChange={(e) => setEdit({ ...edit, titles: edit.titles.map((y, k) => (k === i ? e.target.value : y)), title: edit.title === t ? e.target.value : edit.title })} style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: t.length > 60 ? '#ffd166' : 'var(--dim)' }}>{t.length}/60</span></label>)}
      </div> : <><p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{pk.title}</p>{pk.titles.length > 1 ? <p style={{ margin: 0, fontSize: 13, ...dim }}>Other options: {pk.titles.filter((t) => t !== pk.title).join(' · ')}</p> : null}</>}
      <h3 style={{ ...h3, margin: '6px 0 0' }}>Description</h3>
      {edit ? <textarea className="input" aria-label="Description" rows={4} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} style={{ width: '100%' }} />
        : <p style={{ margin: 0, whiteSpace: 'pre-line', fontSize: 14, lineHeight: 1.55, ...dim }}>{pk.description}</p>}
      {edit ? <input className="input" aria-label="Hashtags" value={edit.hashtags} onChange={(e) => setEdit({ ...edit, hashtags: e.target.value })} />
        : <p style={{ margin: 0, fontSize: 14, color: 'var(--green)' }}>{(pk.hashtags || []).join(' ')}</p>}
    </section>

    {editable ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 12 }}>
      {edit ? <>
        <button className="btn btn-green" disabled={!!busy} onClick={save}>{busy === 's' + s.id ? 'Saving and checking…' : 'Save'}</button>
        <button className="btn btn-line" disabled={!!busy} onClick={() => setEdit(null)}>Cancel</button>
      </> : <>
        {s.status === 'draft' ? <button className="btn btn-green" disabled={!!busy} onClick={() => run('a' + s.id, { action: 'approve-script', id: s.id }, 'Approved for the factory.')}>Approve</button> : null}
        {s.status === 'needs_review' ? <button className="btn btn-line" disabled={!!busy} onClick={() => { if (window.confirm(`Approve anyway? ${failed.length} check${failed.length === 1 ? '' : 's'} didn’t pass:\n\n${failed.map((c) => '• ' + c.note).join('\n')}`)) run('a' + s.id, { action: 'approve-script', id: s.id, force: true }, 'Approved by you, despite the checks.') }}>Approve anyway</button> : null}
        <button className="btn btn-line" disabled={!!busy} onClick={start}>Edit</button>
        {s.idea_id ? <button className="btn btn-line" disabled={!!busy} onClick={() => { if (window.confirm('Write a fresh script? This one is replaced.')) run('r' + s.id, { action: 'write-script', id: s.idea_id }, 'Rewritten.') }}>{busy === 'r' + s.id ? 'Rewriting…' : 'Rewrite'}</button> : null}
        <button className="btn btn-line" disabled={!!busy} onClick={() => { if (window.confirm('Remove this script? The idea stays picked.')) run('d' + s.id, { action: 'drop-script', id: s.id }, 'Script removed.') }}>Remove</button>
      </>}
    </div> : null}
  </article>)
}

function Publishing({ st, run, busy }) {
  const [mode, setMode] = useState(st.publish_mode), [time, setTime] = useState(st.publish_time)
  const [series, setSeries] = useState(st.series), [inTitle, setInTitle] = useState(st.series_in_title !== false), [intro, setIntro] = useState(st.spoken_intro !== false)
  const [days, setDays] = useState(String(st.long_days || 'tue,fri').split(',').filter(Boolean)), [count, setCount] = useState(st.long_count || 6)
  const changed = mode !== st.publish_mode || time !== st.publish_time || series !== st.series || inTitle !== (st.series_in_title !== false) || intro !== (st.spoken_intro !== false) || days.join(',') !== String(st.long_days || 'tue,fri') || Number(count) !== Number(st.long_count || 6)
  const tick = (v, set, label) => <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}><input type="checkbox" checked={v} onChange={(e) => set(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--green)' }} />{label}</label>
  const sample = (series || '').replace(/\b\w/g, (c) => c.toUpperCase())
  const [yt, setYt] = useState(st.yt_mode || 'approval'), storyMode = st.short_style === 'story'
  return (<><section style={{ ...card, marginBottom: 12, display: 'grid', gap: 8 }} aria-label="YouTube automation">
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}><b style={{ fontSize: 14.5 }}>YouTube automation</b>
      <div className="seg" role="group" aria-label="YouTube automation" style={{ margin: 0 }}>
        <button type="button" aria-pressed={yt === 'approval'} disabled={!!busy} onClick={() => { setYt('approval'); run('ytm', { action: 'yt-mode', mode: 'approval' }, 'YouTube: each script waits for your approval.') }}>Approve each script</button>
        <button type="button" aria-pressed={yt === 'autopilot'} disabled={!!busy} onClick={() => { setYt('autopilot'); run('ytm', { action: 'yt-mode', mode: 'autopilot' }, 'YouTube is on Autopilot.') }}>Autopilot</button></div></div>
    <span style={{ fontSize: 13, color: 'var(--dim)' }}>{yt === 'autopilot' ? 'Scripts that pass every check go to the factory and into the posting queue by themselves.' : 'Scripts wait for you; approved ones go to the factory.'} Separate from the blog’s setting.</span>
  </section>
  <section style={{ ...card, marginBottom: 12, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10 }} aria-label="Publishing">
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <b style={{ fontSize: 14.5 }}>Publishing</b>
      <div className="seg" role="group" aria-label="How videos go up" style={{ margin: 0 }}>
        <button type="button" aria-pressed={mode === 'private'} onClick={() => setMode('private')}>Private</button>
        <button type="button" aria-pressed={mode === 'scheduled'} onClick={() => setMode('scheduled')}>Scheduled</button>
      </div>
      {mode === 'scheduled' ? <label style={{ fontSize: 14, display: 'flex', gap: 8, alignItems: 'center' }}>daily at <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ width: 120 }} /> Lagos</label> : null}
    </div>
    <span style={{ fontSize: 12.5, ...dim }}>{mode === 'private' ? 'Autopilot uploads one finished video a day as Private; your phone tells you, and you make it Public in YouTube Studio (one tap from its card here). After Google’s audit, switch to Scheduled and it goes public by itself.' : 'Autopilot uploads one finished video a day, and it goes public by itself at ' + time + ' (Lagos). Needs the audit to be approved.'}</span>
    {/* the series name is only for the classic style: stories and long stories never use it */}
    {!storyMode ? <><div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <label style={{ fontSize: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>Series (classic Shorts and long videos only) <input className="input" value={series} onChange={(e) => setSeries(e.target.value)} maxLength={50} style={{ width: 'min(280px, 58vw)' }} /></label>
      {tick(inTitle, setInTitle, 'In every title')}{tick(intro, setIntro, 'Said at the start of each video')}
    </div>
    {inTitle ? <span style={{ fontSize: 12.5, ...dim }}>Titles look like: “{sample} (Part 12) | This free site turns photos into palettes”</span> : null}</> : null}
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
      <b style={{ fontSize: 14 }}>{storyMode ? 'Long story days' : 'Long videos'}</b>
      <div className="seg" role="group" aria-label="Long-video days" style={{ margin: 0, minWidth: 0 }}>{['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => <button key={d} type="button" aria-pressed={days.includes(d)} onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}>{d[0].toUpperCase() + d.slice(1)}</button>)}</div>
      <label style={{ fontSize: 14, display: 'flex', gap: 8, alignItems: 'center' }}>sites in each <select className="input" value={count} onChange={(e) => setCount(Number(e.target.value))} style={{ width: 80 }}>{[4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
      {!storyMode ? <button className="btn btn-line" disabled={!!busy} onClick={() => run('wl', { action: 'write-long' }, 'Long video written.')}>{busy === 'wl' ? 'Writing… (2–3 minutes)' : 'Write long video now'}</button> : null}
    </div>
    <span style={{ fontSize: 12.5, ...dim }}>{storyMode ? 'On the chosen days, Autopilot writes the long story: his whole day, a chapter per site (the number above), about 5–8 minutes.' : `On the chosen days, Autopilot writes a landscape video (about 5–8 minutes) from the latest finds that already went out as Shorts, with a chapter per site. Next: Vol. ${st.long_volume || 1}.`}</span>
    {changed ? <div><button className="btn btn-green" disabled={!!busy} onClick={() => run('ps', { action: 'publish-settings', mode, time, series, inTitle, intro, longDays: days, longCount: count }, 'Publishing settings saved.')}>Save</button></div> : null}
  </section></>)
}
