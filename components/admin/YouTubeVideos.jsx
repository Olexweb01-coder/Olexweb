'use client'
// The Videos tab: the one-a-day queue ("Up next"), and every finished or uploaded video with search, filters and sorting.
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from './ui'

const dim = { color: 'var(--dim)' }
const fmtLen = (s) => { s = Math.round(s || 0); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
const dayName = (d, today) => { if (d === today) return 'Today'; const t = new Date(Date.parse(today + 'T12:00:00Z') + 86400e3).toISOString().slice(0, 10); if (d === t) return 'Tomorrow'; return new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) }
const label = (v) => v.kind === 'long' ? `Vol. ${v.volume || ''}` : v.part ? `Part ${v.part}` : 'Video'
const when = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

export default function YouTubeVideos({ data }) {
  const router = useRouter(), [busy, setBusy] = useState(''), [err, setErr] = useState('')
  const [q, setQ] = useState(''), [show, setShow] = useState('all'), [sort, setSort] = useState('newest'), [since, setSince] = useState('any')
  const [play, setPlay] = useState(null), [confirm, setConfirm] = useState(null)
  const [edit, setEdit] = useState(false), [per, setPer] = useState(data.queue.perDay), [t1, setT1] = useState(data.queue.times[0]), [t2, setT2] = useState(data.queue.times[1] || '20:00')
  const Q = data.queue, queuedIds = new Set(Q.items.map((x) => x.id))
  async function call(body, ok) {
    setBusy(body.action + (body.id || '')); setErr('')
    try {
      const r = await fetch('/admin/api/youtube', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })
      const j = await r.json().catch(() => ({})); if (r.status === 401) { window.location.assign('/admin/login'); return }
      if (!r.ok) setErr(j.error || 'Something went wrong.'); else { toast(ok); router.refresh() }
    } catch { setErr('No connection. Try again.') } finally { setBusy('') }
  }
  const stateOf = (v) => v.status === 'uploaded' ? (v.privacy === 'public' ? 'public' : 'youtube') : queuedIds.has(v.id) ? 'queued' : 'ready'
  const counts = useMemo(() => { const c = { all: data.videos.length, ready: 0, queued: 0, youtube: 0 }; for (const v of data.videos) { const s = stateOf(v); if (s === 'ready') c.ready++; else if (s === 'queued') c.queued++; else c.youtube++ } return c }, [data])
  const list = useMemo(() => {
    const cut = since === 'any' ? 0 : Date.now() - Number(since) * 86400e3, needle = q.trim().toLowerCase()
    let l = data.videos.filter((v) => { const s = stateOf(v); if (show !== 'all' && !(show === 'youtube' ? (s === 'youtube' || s === 'public') : s === show)) return false
      if (cut && new Date(v.uploadedAt || v.madeAt).getTime() < cut) return false
      return !needle || [v.name, v.title, label(v)].join(' ').toLowerCase().includes(needle) })
    if (sort === 'views') l = [...l].sort((a, b) => (b.views || 0) - (a.views || 0))
    else if (sort === 'watched') l = [...l].sort((a, b) => (b.watched || 0) - (a.watched || 0))
    return l
  }, [data, q, show, sort, since])
  const queueDay = (id) => { const x = Q.items.find((i) => i.id === id); return x ? dayName(x.day, Q.today) + ' ' + x.time : '' }

  return (<>
    {err ? <p className="err" role="alert">{err}</p> : null}
    <section className="yv-vq" aria-label="Up next">
      <div className="yv-vqh"><b>Up next · {Q.perDay === 2 ? 'two videos a day' : 'one video a day'} at {Q.time} <button className="yv-link" onClick={() => setEdit(!edit)} aria-expanded={edit}>{edit ? 'Close' : 'Posting times'}</button></b><span style={dim}>Approving more never posts more. {data.autopilot ? 'Autopilot adds finished videos here.' : 'Add finished videos from the library.'}</span></div>
      {edit ? <div className="yv-pt2">
        <div className="yv-row"><span>Videos a day</span>{[1, 2].map((n) => <button key={n} className={'yv-chip' + (per === n ? ' yv-on' : '')} aria-pressed={per === n} onClick={() => setPer(n)}>{n}</button>)}</div>
        <div className="yv-row"><label>{per === 2 ? 'First time' : 'Time'} <input className="input" type="time" value={t1} onChange={(e) => setT1(e.target.value)} /></label>{per === 2 ? <label>Second time <input className="input" type="time" value={t2} onChange={(e) => setT2(e.target.value)} /></label> : null}</div>
        <div className="yv-sug"><b>{data.best.learned.length ? 'Best for your channel (from your own videos)' : 'Suggested times (Lagos)'}</b>
          {(data.best.learned.length ? data.best.learned.map((x) => ({ time: x.time, why: `${x.views} views per video on average (${x.videos} videos)` })) : data.best.start).map((x) => <button key={x.time} className="yv-tip" onClick={() => { if (per === 2 && t1 !== x.time) setT2(x.time); else setT1(x.time) }}><b>{x.time}</b><span>{x.why}</span></button>)}
          <small>{data.best.learned.length ? 'Worked out from the hour each video went up. It updates as you post more.' : `YouTube shows numbers per day, not per hour, so these are starting points for a tech and tools audience. Once you’ve posted at a few different times (${data.best.videos} of 8 videos so far), this switches to what works best on your own channel.`}</small></div>
        <div><button className="btn btn-green" disabled={!!busy} onClick={() => call({ action: 'posting-times', perDay: per, time: t1, time2: t2 }, 'Posting times saved.').then(() => setEdit(false))}>Save posting times</button></div>
      </div> : null}
      <div className="yv-vqs">
        {Q.todayDone ? <div className="yv-slot yv-done"><span className="yv-d">✓ Today</span><span className="yv-t">{Q.perDay === 2 ? `${Q.todayDone} of 2 out today` : 'Today’s video is out'}</span><span className="yv-s">{data.mode === 'scheduled' ? 'Public at its time' : 'Make it Public in Studio'}</span></div> : null}
        {Q.items.map((x, i) => <div key={x.id} className="yv-slot"><span className="yv-d">{dayName(x.day, Q.today)} · {x.time}</span><span className="yv-t">{label(x)} · {x.name}</span>
          <span className="yv-mv"><button aria-label="Earlier" disabled={!!busy || i === 0} onClick={() => call({ action: 'queue-move', id: x.id, dir: -1 }, 'Moved.')}>↑</button><button aria-label="Later" disabled={!!busy || i === Q.items.length - 1} onClick={() => call({ action: 'queue-move', id: x.id, dir: 1 }, 'Moved.')}>↓</button><button disabled={!!busy} onClick={() => call({ action: 'queue-remove', id: x.id }, 'Removed from the queue.')}>Remove</button></span></div>)}
        {Q.items.length < 4 ? <div className="yv-slot yv-empty">{Q.items.length ? 'Next free day' : 'Nothing queued yet'}<br />Add from the library</div> : null}
      </div>
    </section>

    <div className="yv-vf">
      <input className="input" type="search" placeholder="Search videos by title or site…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search videos" />
      {[['all', 'All'], ['ready', 'Ready'], ['queued', 'Queued'], ['youtube', 'On YouTube']].map(([k, l]) => <button key={k} className={'yv-chip' + (show === k ? ' yv-on' : '')} aria-pressed={show === k} onClick={() => setShow(k)}>{l} {counts[k]}</button>)}
      <select className="input" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort"><option value="newest">Newest</option><option value="views">Most views</option><option value="watched">Most watched</option></select>
      <select className="input" value={since} onChange={(e) => setSince(e.target.value)} aria-label="Date"><option value="any">Any date</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select>
    </div>

    {list.length ? <div className="yv-vg">{list.map((v) => { const s = stateOf(v); return <article key={v.id} className="yv-vc">
      <button className="yv-th" onClick={() => setPlay(v)} aria-label={'Play ' + (v.title || v.name)}>
        {v.thumb ? <img src={v.thumb} alt="" loading="lazy" /> : <video src={`/admin/api/youtube/video?id=${v.id}#t=1`} preload="metadata" muted playsInline />}
        <span className="yv-pt">{label(v).toUpperCase()}</span><span className="yv-play">▶</span>{v.seconds ? <span className="yv-len">{fmtLen(v.seconds)}</span> : null}
      </button>
      <div className="yv-vb">
        <span className={'yv-st yv-' + s}>{s === 'public' ? 'Public' : s === 'youtube' ? 'Private · on YouTube' : s === 'queued' ? 'Queued · ' + queueDay(v.id) : 'Ready'}{v.special ? ' · posted specially' : ''}</span>
        <b className="yv-vt">{v.title || v.name}</b>
        {s === 'public' || s === 'youtube' ? <div className="yv-stats"><span><b>{v.views ?? 0}</b> views</span>{v.watched ? <span><b>{Math.round(v.watched)}%</b> watched</span> : null}</div> : null}
        {s === 'ready' ? <div className="yv-act"><button className="yv-p" disabled={!!busy} onClick={() => call({ action: 'queue-add', id: v.id }, 'Added to the queue.')}>Add to queue</button><button disabled={!!busy} onClick={() => setConfirm(v)}>Post now…</button></div> : null}
        {s === 'queued' ? <div className="yv-act"><button disabled={!!busy} onClick={() => call({ action: 'queue-remove', id: v.id }, 'Removed from the queue.')}>Unqueue</button><button disabled={!!busy} onClick={() => setConfirm(v)}>Post now…</button></div> : null}
        <div className="yv-meta"><span>{s === 'public' || s === 'youtube' ? 'Up ' + when(v.uploadedAt) : 'Made ' + when(v.madeAt)}</span>{v.ytId ? <a href={'https://studio.youtube.com/video/' + v.ytId + '/edit'} target="_blank" rel="noopener noreferrer">Studio ↗</a> : <a href="/admin/youtube?view=scripts">Script</a>}</div>
      </div>
    </article> })}</div> : <p style={dim}>{data.videos.length ? 'No videos match these filters.' : 'No finished videos yet. Send an approved script to the factory from the Scripts tab.'}</p>}

    {play ? <div className="yv-ov" role="dialog" aria-modal="true" aria-label={play.title || play.name} onClick={() => setPlay(null)}><div className="yv-dl" onClick={(e) => e.stopPropagation()}>
      <b style={{ display: 'block', marginBottom: 10 }}>{label(play)} · {play.title || play.name}</b>
      {play.ytId ? <p style={{ margin: '0 0 12px', ...dim }}>This one is on YouTube. <a href={'https://youtube.com/shorts/' + play.ytId} target="_blank" rel="noopener noreferrer">Watch it there ↗</a></p>
        : <video src={`/admin/api/youtube/video?id=${play.id}`} controls autoPlay playsInline style={{ width: '100%', maxHeight: '70vh', borderRadius: 14, background: '#000' }} />}
      <div className="yv-bt"><button className="btn btn-line" onClick={() => setPlay(null)}>Close</button></div></div></div> : null}

    {confirm ? <div className="yv-ov" role="dialog" aria-modal="true" aria-label="Post now"><div className="yv-dl">
      <h3 style={{ margin: '0 0 8px' }}>Post “{confirm.name}” now?</h3>
      <p style={dim}>This skips the queue{Q.todayDone >= Q.perDay ? <>. Today’s {Q.perDay === 2 ? 'two videos have' : 'video has'} already gone out, so this would be an <b style={{ color: 'var(--paper)' }}>extra video today</b></> : ''}.</p>
      <p style={dim}>Use this only for something special. Everything else stays one a day.</p>
      <div className="yv-bt"><button className="btn btn-line" onClick={() => setConfirm(null)}>Cancel</button><button className="btn btn-green" disabled={!!busy} onClick={async () => { const v = confirm; setConfirm(null); await call({ action: 'post-now', id: v.id, confirm: true }, 'Posting now.') }}>Yes, post it now</button></div>
    </div></div> : null}

    <style>{`
.yv-vq{padding:18px;border-radius:20px;background:var(--raise);border:1px solid var(--line);margin-bottom:6px}.yv-vqh{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px;font-size:13.5px}.yv-vqh b{font-size:16.5px}
.yv-vqs{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(170px,1fr);gap:10px;overflow-x:auto;padding-bottom:4px}
.yv-slot{display:grid;gap:5px;align-content:start;padding:12px;border-radius:16px;border:1px solid var(--line);background:rgba(242,239,233,.03)}.yv-slot .yv-d{font-size:11.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--dim)}.yv-slot .yv-t{font-weight:700;font-size:14px;line-height:1.3}.yv-slot .yv-s{font-size:12px;color:var(--dim)}
.yv-slot.yv-done .yv-d{color:var(--green)}.yv-slot.yv-empty{border-style:dashed;place-content:center;text-align:center;font-size:13px;color:var(--dim)}
.yv-slot .yv-mv{display:flex;gap:6px;margin-top:4px}.yv-slot .yv-mv button{padding:4px 9px;border-radius:8px;border:1px solid var(--line);background:transparent;color:var(--paper);font:600 12px inherit;cursor:pointer}.yv-slot .yv-mv button:disabled{opacity:.35;cursor:default}
.yv-link{margin-left:8px;padding:3px 10px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--green);font:700 12.5px inherit;cursor:pointer}
.yv-pt2{display:grid;gap:12px;margin:0 0 14px;padding:14px;border-radius:16px;border:1px solid var(--line);background:rgba(242,239,233,.03)}.yv-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:14px}.yv-row label{display:grid;gap:6px;font-size:13px;color:var(--dim)}
.yv-sug{display:grid;gap:8px}.yv-sug>b{font-size:14px}.yv-sug small{color:var(--dim);font-size:12.5px;line-height:1.5}.yv-tip{display:grid;grid-template-columns:64px 1fr;gap:10px;align-items:center;text-align:left;padding:10px 12px;border-radius:12px;border:1px solid var(--line);background:transparent;color:var(--paper);cursor:pointer;font:inherit}.yv-tip b{font-size:16px;color:var(--green)}.yv-tip span{font-size:13px;color:var(--dim)}
.yv-vf{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:18px 0 14px}.yv-vf input{flex:1;min-width:200px}.yv-vf select{width:auto}
.yv-chip{padding:8px 14px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--dim);font:700 13.5px inherit;cursor:pointer}.yv-chip.yv-on{background:var(--paper);color:#111;border-color:var(--paper)}
.yv-vg{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px}
.yv-vc{display:flex;flex-direction:column;border-radius:18px;overflow:hidden;background:var(--raise);border:1px solid var(--line)}
.yv-vc .yv-th{position:relative;display:block;aspect-ratio:9/12;padding:0;border:0;background:linear-gradient(160deg,#1f2a1b,#0f140e);cursor:pointer;overflow:hidden}.yv-vc .yv-th img,.yv-vc .yv-th video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.yv-vc .yv-pt{position:absolute;top:10px;left:10px;padding:4px 9px;border-radius:8px;background:#ffc94d;color:#1a1300;font-weight:900;font-size:12px}.yv-vc .yv-play{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:46px;height:46px;border-radius:50%;background:rgba(0,0,0,.45);color:#fff;display:grid;place-items:center}.yv-vc .yv-len{position:absolute;bottom:8px;right:8px;font-size:11.5px;padding:2px 7px;border-radius:6px;background:rgba(0,0,0,.65);color:#fff}
.yv-vb{display:grid;gap:8px;padding:12px;flex:1;align-content:start}.yv-vt{font-size:14px;line-height:1.3}.yv-stats{display:flex;gap:10px;font-size:12.5px;color:var(--dim)}.yv-stats b{color:var(--paper)}
.yv-st{justify-self:start;padding:3px 9px;border-radius:999px;font-size:11.5px;font-weight:800}.yv-st.yv-ready{background:rgba(143,227,106,.15);color:var(--green)}.yv-st.yv-queued{background:rgba(255,201,77,.15);color:#ffc94d}.yv-st.yv-public{background:rgba(120,180,255,.15);color:#9cc8ff}.yv-st.yv-youtube{background:rgba(242,239,233,.08);color:var(--dim)}
.yv-act{display:flex;gap:6px}.yv-act button{flex:1;padding:9px 6px;border-radius:10px;border:1px solid var(--line);background:transparent;color:var(--paper);font:800 12.5px inherit;cursor:pointer}.yv-act .yv-p{background:var(--green);color:#111;border-color:var(--green)}.yv-act button:disabled{opacity:.5}
.yv-meta{display:flex;justify-content:space-between;margin-top:auto;font-size:12.5px;color:var(--dim)}.yv-meta a{color:var(--dim)}
.yv-ov{position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.6);display:grid;place-items:center;padding:16px}.yv-dl{width:min(94vw,480px);max-height:92vh;overflow:auto;padding:22px;border-radius:22px;background:var(--raise);border:1px solid var(--line)}.yv-dl p{font-size:14.5px;line-height:1.55;margin:0 0 10px}.yv-bt{display:flex;gap:10px;justify-content:flex-end;margin-top:14px}
`}</style>
  </>)
}
