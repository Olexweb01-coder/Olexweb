'use client'
// Admin → Directory: what's live, what's waiting, quality reasons, views and leads, and the controls.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from './ui'

const dim = { color: 'var(--dim)' }
const ago = (d) => { const m = Math.round((Date.now() - new Date(d).getTime()) / 60e3); return m < 2 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago' }

export default function AdminDirectory({ data }) {
  const router = useRouter(), [tab, setTab] = useState('overview'), [busy, setBusy] = useState(''), [err, setErr] = useState(''), [show, setShow] = useState('all'), [per, setPer] = useState(data.settings.per_day), [auto, setAuto] = useState(data.settings.auto_publish)
  async function call(body, ok) {
    setBusy(body.action + (body.id || '')); setErr('')
    try { const r = await fetch('/admin/api/directory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })
      const j = await r.json().catch(() => ({})); if (r.status === 401) { window.location.assign('/admin/login'); return null }
      if (!r.ok) { setErr(j.error || 'Something went wrong.'); return null } if (ok) toast(typeof ok === 'function' ? ok(j) : ok); router.refresh(); return j }
    catch { setErr('No connection. Try again.'); return null } finally { setBusy('') }
  }
  const E = data.entries, live = E.filter((e) => e.status === 'live'), drafts = E.filter((e) => e.status !== 'live')
  const views = E.reduce((n, e) => n + e.views, 0), leads = E.reduce((n, e) => n + e.leads, 0), max = Math.max(1, ...data.week.map((w) => w.views))
  const list = E.filter((e) => show === 'all' || (show === 'live' ? e.status === 'live' : e.status !== 'live'))
  const T = [['overview', 'Overview'], ['pages', 'Pages', E.length], ['settings', 'Settings']]
  return (<>
    <div className="dd-top"><div><h1 className="d" style={{ margin: 0 }}>Directory</h1><p style={{ margin: '6px 0 0', ...dim }}>Every useful site your research finds becomes a checked page at <a href="/tools" target="_blank" rel="noopener" style={{ color: 'var(--green)' }}>olexweb.com/tools</a>.</p></div>
      <button className="btn btn-green" disabled={!!busy} onClick={() => call({ action: 'run' }, (j) => j.skipped ? 'Today’s limit is reached. Raise it in Settings.' : `Wrote ${j.wrote}, published ${j.live}.`)}>{busy === 'run' ? 'Writing… (up to a minute)' : 'Write the next pages now'}</button></div>
    <div className="dd-tabs" role="tablist">{T.map(([k, l, n]) => <button key={k} role="tab" aria-selected={tab === k} className={'dd-tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}{n != null ? <i>{n}</i> : null}</button>)}</div>
    {err ? <p className="err" role="alert">{err}</p> : null}

    {tab === 'overview' ? <>
      <div className="dd-nums"><div><b>{live.length}</b><span>pages live</span></div><div><b>{views}</b><span>views</span></div><div><b>{leads}</b><span>leads (taps on your offer)</span></div><div><b>{data.waiting}</b><span>good sites waiting to be written</span></div></div>
      <section className="dd-card"><h2>Views, last 14 days</h2>{data.week.length ? <div className="dd-chart" role="img" aria-label="Views per day">{data.week.map((w) => <div key={w.day} title={`${w.day}: ${w.views} views, ${w.leads} leads`}><i style={{ height: Math.max(3, (w.views / max) * 100) + '%' }} /><span>{w.day.slice(8)}</span></div>)}</div> : <p style={dim}>Views appear here as people find the pages.</p>}</section>
      <section className="dd-card"><h2>Best pages</h2>{[...live].sort((a, b) => b.views - a.views).slice(0, 8).map((e) => <a key={e.id} className="dd-row" href={'/tools/' + e.slug} target="_blank" rel="noopener"><b>{e.name}</b><span>{e.views} views · {e.leads} leads</span></a>)}{!live.length ? <p style={dim}>Nothing live yet. Tap “Write the next pages now”.</p> : null}</section>
      {(data.older || []).length ? <section className="dd-card"><h2>Add guide links to older Shorts</h2>
        <p style={{ margin: '0 0 10px', fontSize: 13.5, ...dim }}>New Shorts get their guide link automatically. For these, already on YouTube, paste the line at the top of the description (YouTube only lets your admin edit descriptions with a wider permission, which would affect your audit).</p>
        {data.older.map((v) => { const line = `Full guide (free): https://olexweb.com/tools/${v.slug}`; return <div key={v.id} className="dd-item"><div className="dd-ih"><b>{v.name}</b></div><code style={{ fontSize: 13, color: 'var(--green)' }}>{line}</code>
          <div className="dd-acts"><button className="btn btn-line" onClick={() => { navigator.clipboard.writeText(line); toast('Line copied. Paste it at the top of the description.') }}>Copy line</button>
            <a className="btn btn-line" href={'https://studio.youtube.com/video/' + v.yt_video_id + '/edit'} target="_blank" rel="noopener noreferrer">Open in Studio ↗</a>
            <button className="btn btn-green" disabled={!!busy} onClick={() => call({ action: 'linked', id: v.id }, 'Marked as done.')}>Done</button></div></div> })}</section> : null}
      <p style={{ fontSize: 13, ...dim }}>Search engines told: {data.settings.last_ping ? `${ago(data.settings.last_ping.at)} (${data.settings.last_ping.urls} page${data.settings.last_ping.urls === 1 ? '' : 's'}, answer ${data.settings.last_ping.status})` : 'not yet'}. New pages are announced instantly and listed in the sitemap.</p>
    </> : null}

    {tab === 'pages' ? <>
      <div className="dd-chips">{[['all', 'All', E.length], ['live', 'Live', live.length], ['draft', 'Needs review', drafts.length]].map(([k, l, n]) => <button key={k} className={show === k ? 'on' : ''} aria-pressed={show === k} onClick={() => setShow(k)}>{l} {n}</button>)}</div>
      <section className="dd-card">{list.map((e) => <div key={e.id} className="dd-item">
        <div className="dd-ih"><div><b>{e.name}</b><span className={'dd-st ' + e.status}>{e.status === 'live' ? 'Live' : e.status === 'blocked' ? 'Blocked (unsafe)' : 'Needs review'}</span>{e.quality && e.quality.score != null ? <span className="dd-q">Quality {e.quality.score}</span> : null}</div>
          <span style={{ fontSize: 13, ...dim }}>{e.views} views · {e.leads} leads · {e.published_at ? 'published ' + ago(e.published_at) : 'written ' + ago(e.created_at)}</span></div>
        {e.quality && (e.quality.problems || []).length ? <ul className="dd-why">{e.quality.problems.map((p, i) => <li key={i}>{p}</li>)}</ul> : null}
        <div className="dd-acts">{e.status === 'live' ? <a className="btn btn-line" href={'/tools/' + e.slug} target="_blank" rel="noopener">View ↗</a> : null}
          {e.status === 'live' ? <button className="btn btn-line" disabled={!!busy} onClick={() => call({ action: 'unpublish', id: e.id }, 'Taken offline.')}>Unpublish</button>
            : e.quality && e.quality.ok ? <button className="btn btn-green" disabled={!!busy} onClick={() => call({ action: 'publish', id: e.id }, 'Published.')}>Publish</button> : null}
          <button className="btn btn-line" disabled={!!busy} onClick={() => call({ action: 'rewrite', id: e.id }, (j) => j.live ? 'Rewritten and published.' : j.ok ? 'Rewritten.' : 'Rewritten, still needs review.')}>{busy === 'rewrite' + e.id ? 'Rewriting…' : 'Rewrite'}</button>
          <button className="btn btn-line" disabled={!!busy} onClick={() => { if (window.confirm('Delete this page? It may be written again later from the same site.')) call({ action: 'delete', id: e.id }, 'Deleted.') }}>Delete</button></div>
      </div>)}{!list.length ? <p style={dim}>Nothing here yet.</p> : null}</section>
    </> : null}

    {tab === 'settings' ? <section className="dd-card" style={{ maxWidth: 620, display: 'grid', gap: 14 }}>
      <label className="dd-l">New pages per day<input className="input" type="number" min={0} max={50} value={per} onChange={(e) => setPer(e.target.value)} style={{ maxWidth: 140 }} /><small style={dim}>Each page reads the site, is written under the rulebook and checked. 12 a day keeps quality high; raise it once you’re happy with the pages.</small></label>
      <label className="dd-tick"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />Publish pages automatically when they pass every check<small style={dim}>Off: everything waits in “Needs review” for you.</small></label>
      <div><button className="btn btn-green" disabled={!!busy} onClick={() => call({ action: 'settings', perDay: Number(per), autoPublish: auto }, 'Settings saved.')}>Save</button></div>
    </section> : null}

    <style dangerouslySetInnerHTML={{ __html: `
.dd-top{display:flex;justify-content:space-between;gap:14px;align-items:flex-end;flex-wrap:wrap;margin:4px 0 14px}
.dd-tabs{display:flex;gap:4px;overflow-x:auto;margin:0 0 16px;border-bottom:1px solid var(--line)}.dd-tab{flex:none;padding:10px 14px;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;background:none;color:var(--dim);font:700 14.5px inherit;cursor:pointer}.dd-tab.on{color:var(--paper);border-color:var(--green)}.dd-tab i{font-style:normal;margin-left:6px;padding:1px 7px;border-radius:99px;background:var(--raise);font-size:12px}
.dd-nums{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:14px}.dd-nums div{padding:16px;border-radius:20px;background:var(--raise);border:1px solid var(--line)}.dd-nums b{display:block;font-family:var(--display);font-stretch:80%;font-weight:900;font-size:38px;line-height:1}.dd-nums span{font-size:13.5px;color:var(--dim)}
.dd-card{padding:18px;border-radius:20px;background:var(--raise);border:1px solid var(--line);margin-bottom:14px}.dd-card h2{margin:0 0 12px;font-size:18px}
.dd-chart{display:flex;gap:6px;align-items:flex-end;height:140px}.dd-chart div{flex:1;display:grid;grid-template-rows:1fr auto;gap:4px;height:100%;text-align:center}.dd-chart i{align-self:end;display:block;border-radius:6px 6px 2px 2px;background:var(--green);animation:ddUp .6s cubic-bezier(.2,.8,.2,1)}.dd-chart span{font-size:11px;color:var(--dim)}@keyframes ddUp{from{transform:scaleY(0);transform-origin:bottom}}
.dd-row{display:flex;justify-content:space-between;gap:10px;padding:11px 2px;border-bottom:1px solid var(--line);text-decoration:none;color:var(--paper);font-size:14.5px}.dd-row span{color:var(--dim);font-size:13px}
.dd-chips{display:flex;gap:8px;margin-bottom:12px}.dd-chips button{padding:8px 14px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--dim);font:700 13.5px inherit;cursor:pointer}.dd-chips button.on{background:var(--paper);color:#111}
.dd-item{display:grid;gap:8px;padding:14px 2px;border-bottom:1px solid var(--line)}.dd-ih{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:baseline}.dd-ih>div{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.dd-ih b{font-size:16px}
.dd-st{padding:3px 9px;border-radius:999px;font-size:11.5px;font-weight:800;background:rgba(242,239,233,.08);color:var(--dim)}.dd-st.live{background:rgba(143,227,106,.15);color:var(--green)}.dd-st.blocked{background:rgba(255,138,138,.12);color:#ff8a8a}.dd-q{font-size:12px;color:var(--dim)}
.dd-why{margin:0;padding-left:18px;font-size:13.5px;color:var(--dim);line-height:1.5}.dd-acts{display:flex;gap:8px;flex-wrap:wrap}
.dd-l{display:grid;gap:6px;font-size:14px}.dd-tick{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;align-items:center;font-size:14px}.dd-tick small{grid-column:2}.dd-tick input{width:18px;height:18px;accent-color:var(--green)}
` }} />
  </>)
}
