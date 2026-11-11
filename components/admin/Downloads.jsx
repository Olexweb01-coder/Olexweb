'use client'
// Admin → Downloads (lib/site/apps.js): who asked for your private apps (approve, decline, ban), and new versions.
import { useState, useEffect, useRef } from 'react'
import { toast } from './ui'

async function call(body) {
  try {
    const r = await fetch('/admin/api/downloads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' })
    const j = await r.json().catch(() => ({})); if (r.status === 401) window.location.assign('/admin/login')
    return r.ok ? j : { error: j.error || 'Something went wrong. Try again.' }
  } catch { return { error: 'No connection. Try again.' } }
}
const ago = (iso) => { if (!iso) return ''; const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago' }
const mb = (n) => (n / 1048576).toFixed(1) + ' MB'
const TABS = [['waiting', 'Waiting'], ['approved', 'Approved'], ['banned', 'Banned'], ['declined', 'Declined']]

export default function DownloadsBoard({ initial }) {
  const [data, setData] = useState(initial), [tab, setTab] = useState('waiting'), [busy, setBusy] = useState(0), [up, setUp] = useState(null)
  const [fail, setFail] = useState('')
  // closing or refreshing during an upload: the browser asks first (it can carry on afterwards from the same file)
  useEffect(() => { if (!up) return; const h = (e) => { e.preventDefault(); e.returnValue = '' }; window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h) }, [up])
  const file = useRef(null), [version, setVersion] = useState(''), [picked, setPicked] = useState(null)
  const secs = (n) => n < 60 ? Math.max(1, Math.round(n)) + ' s' : Math.round(n / 60) + ' min'
  async function load() { const j = await call({ action: 'data' }); if (!j.error) setData(j) }
  useEffect(() => { const t = setInterval(load, 15000); return () => clearInterval(t) }, [])
  async function decide(p, action, msg) { setBusy(p.id); const j = await call({ action, id: p.id }); setBusy(0); if (j.error) toast(j.error); else { toast(msg, true); load() } }
  async function upload(app) {
    const f = file.current && file.current.files[0]; if (!f) { toast('Choose the installer first.'); return }
    const t0 = Date.now(); setFail('')
    setUp({ app, done: 0, total: 1, note: 'Starting…' })
    const s = await call({ action: 'start', app, filename: f.name, size: f.size, version })
    if (s.error) { setUp(null); setFail(s.error); return }
    const have = new Set(s.got || [])
    if (s.resumed) toast(`Carrying on: ${have.size} of ${s.pieces} pieces were already up.`, true)
    for (let n = 0; n < s.pieces; n++) {
      if (have.has(n)) continue
      const part = f.slice(n * s.pieceSize, Math.min(f.size, (n + 1) * s.pieceSize))
      let ok = false, err = ''
      for (let tryN = 0; tryN < 3 && !ok; tryN++) {
        try {
          const r = await fetch(`/admin/api/downloads/piece?id=${s.id}&n=${n}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: part, credentials: 'same-origin' })
          const txt = await r.text(); let j = {}; try { j = JSON.parse(txt) } catch {}
          ok = r.ok; if (!ok) err = j.error || `the server answered ${r.status}${r.statusText ? ' ' + r.statusText : ''}${txt && !j.error ? ': ' + txt.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140) : ''}`
          if (r.status === 401 || r.status === 403 || r.status === 410 || r.status === 400) break                          // no point trying again
        } catch (e) { err = 'the connection dropped (' + (e && e.message ? e.message : 'no connection') + ')' }
        if (!ok) await new Promise((res) => setTimeout(res, 1500 * (tryN + 1)))
      }
      if (!ok) { setUp(null); setFail(`Piece ${n + 1} of ${s.pieces} didn’t go up: ${err}. Choose the same file and tap Upload to carry on from piece ${n + 1}.`); load(); return }
      const sent = Math.min(f.size, (n + 1) * s.pieceSize), fresh = sent - have.size * s.pieceSize, rate = Math.max(1, fresh) / Math.max(0.5, (Date.now() - t0) / 1000)       // bytes a second so far
      setUp({ app, done: n + 1, total: s.pieces, note: `${Math.round(100 * sent / f.size)}% · ${mb(sent)} of ${mb(f.size)} · ${mb(rate)}/s · about ${secs((f.size - sent) / rate)} left` })
    }
    setUp({ app, done: s.pieces, total: s.pieces, note: 'Checking…' })
    const fin = await call({ action: 'finish', id: s.id }); setUp(null)
    if (fin.error) setFail(fin.error); else { toast('Uploaded. Approved people now get this version.', true); setVersion(''); setPicked(null); if (file.current) file.current.value = ''; load() }
  }
  return (<>
    <div className="top"><h1 className="d">Downloads</h1></div>
    <p className="note" style={{ marginTop: -6 }}>Private apps only people you approve can download. Their page: shared with your church, never a public file.</p>
    {data.apps.map((a) => {
      const list = a.people.filter((p) => p.status === tab), count = (s) => a.people.filter((p) => p.status === s).length
      return (<section key={a.slug} className="dl-app">
        <div className="dl-head"><div><b className="d">{a.name}</b><span>{a.release ? `Version ${a.release.version} · ${a.release.filename} · ${mb(a.release.size)} · uploaded ${ago(a.release.live_at)}` : 'No installer uploaded yet: nobody can download until you upload it.'}</span></div>
          <a className="btn btn-line" href={'/tools/' + a.slug} target="_blank" rel="noopener">See the page ↗</a></div>
        <div className="dl-up">
          <label className="btn btn-line dl-file">Choose installer<input ref={file} type="file" accept=".exe,.msi,.zip" onChange={(e) => { const f = e.target.files[0]; setPicked(f ? { name: f.name, size: f.size } : null); const v = f && f.name.match(/(\d{4}\.\d{1,2}\.\d+|\d+\.\d+\.\d+)/); if (v && !version) setVersion(v[1]) }} /></label>
          <input className="input" placeholder="Version (optional), e.g. 2026.11.616" value={version} maxLength={40} onChange={(e) => setVersion(e.target.value)} />
          <button className="btn btn-green" disabled={!!up} onClick={() => upload(a.slug)}>{a.release ? 'Upload new version' : 'Upload'}</button>
        </div>
        {fail ? <p className="dl-fail" role="alert">{fail}</p> : null}
        {a.uploading && !up ? <p className="note" style={{ margin: 0 }}>Paused upload: <b>{a.uploading.filename}</b> · {a.uploading.got} of {a.uploading.pieces} pieces are up. Choose the same file and tap Upload to carry on.</p> : null}
        {picked && !up ? <p className="note" style={{ margin: 0 }}>Chosen: <b>{picked.name}</b> · {mb(picked.size)} · goes up in {Math.ceil(picked.size / 4194304)} pieces. On a good connection that’s about {secs(picked.size / 1.5e6)}; on mobile data it can take a few times longer. Keep this page open while it uploads.</p> : null}
        {up && up.app === a.slug ? <div className="dl-bar" role="progressbar" aria-valuenow={Math.round(100 * up.done / up.total)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: (100 * up.done / up.total) + '%' }} /><span>{up.note} · keep this page open</span></div> : null}
        <div className="seg" role="group" aria-label="Show">{TABS.map(([k, l]) => <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}{count(k) ? ` (${count(k)})` : ''}</button>)}</div>
        {!list.length ? <div className="empty">{tab === 'waiting' ? 'Nobody is waiting. When someone taps Request download, they appear here and you get a notification.' : 'Nobody here.'}</div>
          : list.map((p) => (<article className="dl-row" key={p.id}>
            <div><b>{p.name}</b><span>{p.email}{p.phone ? ' · ' + p.phone : ''}</span>
              <small>Asked {ago(p.created_at)}{p.downloads ? ` · downloaded ${p.downloads}× (last ${ago(p.last_download_at)})` : p.status === 'approved' ? ' · not downloaded yet' : ''}</small></div>
            <span className="acts">
              {p.status === 'waiting' ? <><button className="btn btn-bad" disabled={busy === p.id} onClick={() => decide(p, 'decline', 'Declined.')}>Decline</button><button className="btn btn-green" disabled={busy === p.id} onClick={() => decide(p, 'approve', `Approved. ${p.name.split(' ')[0]}’s download starts now.`)}>Approve</button></> : null}
              {p.status === 'approved' ? <button className="btn btn-bad" disabled={busy === p.id} onClick={() => decide(p, 'ban', `${p.name.split(' ')[0]} is banned: no more downloads.`)}>Ban</button> : null}
              {p.status === 'banned' ? <button className="btn btn-line" disabled={busy === p.id} onClick={() => decide(p, 'unban', 'Unbanned.')}>Unban</button> : null}
              {p.status === 'declined' ? <><button className="btn btn-line" disabled={busy === p.id} onClick={() => decide(p, 'approve', 'Approved.')}>Approve after all</button><button className="btn btn-line" disabled={busy === p.id} onClick={() => decide(p, 'forget', 'Removed.')}>Remove</button></> : null}
            </span>
          </article>))}
      </section>)
    })}
    <style>{`.dl-app{margin-top:18px;padding:18px;border:1px solid var(--line);border-radius:20px;background:var(--raise,transparent);display:grid;gap:14px}
.dl-head{display:flex;gap:12px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap}.dl-head b{display:block;font-size:20px}.dl-head span{color:var(--dim);font-size:14px}
.dl-up{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.dl-up .input{flex:1 1 200px;min-width:0}.dl-file{position:relative;overflow:hidden}.dl-file input{position:absolute;inset:0;opacity:0;cursor:pointer}
.dl-bar{position:relative;min-height:34px;border-radius:12px;background:var(--line);overflow:hidden}.dl-bar i{position:absolute;inset:0 auto 0 0;background:var(--green);opacity:.35;transition:width .3s}.dl-bar span{position:relative;display:block;padding:8px 12px;font-size:13.5px;font-weight:600}
.dl-fail{margin:0;padding:12px 14px;border-radius:12px;background:rgba(255,90,70,.12);border:1px solid rgba(255,90,70,.4);color:#ffb4a8;font-size:14px;line-height:1.45}
.dl-row{display:flex;gap:12px;justify-content:space-between;align-items:center;flex-wrap:wrap;padding:12px 0;border-top:1px solid var(--line)}.dl-row b{display:block}.dl-row span,.dl-row small{display:block;color:var(--dim);font-size:13.5px}`}</style>
  </>)
}
