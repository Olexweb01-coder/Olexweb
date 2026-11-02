'use client'
// Meetings: create a meeting, copy its link, start it (opens the room in a new tab), end it, delete old ones.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from './ui'

const when = (iso) => new Date(iso).toLocaleString('en-GB', { timeZone: 'Africa/Lagos', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const link = (code) => `${typeof window === 'undefined' ? 'https://olexweb.com' : window.location.origin}/meet/${code}`

export default function AdminMeetings({ data }) {
  const router = useRouter(), [title, setTitle] = useState(''), [speakers, setSpeakers] = useState('everyone'), [busy, setBusy] = useState(''), [fresh, setFresh] = useState(null)
  async function act(body, ok) {
    setBusy(body.action + (body.code || ''))
    try {
      const r = await fetch('/admin/api/meetings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })
      const j = await r.json().catch(() => ({})); if (r.status === 401) { window.location.assign('/admin/login'); return null }
      if (!r.ok) { toast(j.error || 'That didn’t work. Try again.'); return null }
      if (ok) toast(ok); router.refresh(); return j
    } catch { toast('No connection. Try again.'); return null } finally { setBusy('') }
  }
  async function create(e) {
    e.preventDefault()
    const j = await act({ action: 'create', title, speakers }, 'Meeting created.')
    if (j && j.code) { setFresh(j.code); setTitle('') }
  }
  async function copy(code) { try { await navigator.clipboard.writeText(link(code)); toast('Link copied.') } catch { window.prompt('Copy the meeting link:', link(code)) } }
  const open = data.meetings.filter((m) => !m.endedAt), ended = data.meetings.filter((m) => m.endedAt)

  return (<div className="mg">
    <div className="top"><h1 className="d">Meetings</h1></div>
    {!data.ready ? <section className="mg-box mg-setup">
      <h2>Connect the video service</h2>
      <p>Meetings run on LiveKit. Create a free project at cloud.livekit.io, open Settings → Keys, then add these three in Vercel → Settings → Environment Variables and redeploy:</p>
      <ul><li><code>LIVEKIT_URL</code> the project URL that starts with wss://</li><li><code>LIVEKIT_API_KEY</code></li><li><code>LIVEKIT_API_SECRET</code></li></ul>
      <p className="mg-dim">You can still create meetings now; people can join once these are added.</p>
    </section> : null}

    <form className="mg-box mg-new" onSubmit={create}>
      <h2>New meeting</h2>
      <label className="mg-lab" htmlFor="mg-title">Name</label>
      <input id="mg-title" className="input" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Meeting with Olaitan" />
      <p className="mg-lab" id="mg-who">Who can speak</p>
      <div className="seg" role="group" aria-labelledby="mg-who">
        <button type="button" aria-pressed={speakers === 'everyone'} onClick={() => setSpeakers('everyone')}>Everyone</button>
        <button type="button" aria-pressed={speakers === 'invited'} onClick={() => setSpeakers('invited')}>Only people I let speak</button>
      </div>
      <p className="mg-dim">{speakers === 'everyone' ? 'Good for calls and small meetings. Cameras start off for guests to save data.' : 'Good for classes and big meetings. Guests listen, chat and raise a hand; you let them speak.'}</p>
      <button className="btn btn-green" disabled={!!busy}>{busy === 'create' ? 'Creating…' : 'Create meeting'}</button>
    </form>

    <section className="mg-box">
      <h2>Open meetings</h2>
      {open.length ? <ul className="mg-list">{open.map((m) => <li key={m.code} className={fresh === m.code ? 'mg-fresh' : ''}>
        <div className="mg-main">
          <b>{m.title}</b>
          <span className="mg-dim">{m.startedAt ? `Started ${when(m.startedAt)}` : `Created ${when(m.createdAt)}, not started`}{m.speakers === 'invited' ? '. Only people you let speak' : ''}{m.joins ? `. ${m.joins} join${m.joins === 1 ? '' : 's'}` : ''}</span>
          <span className="mg-url">{link(m.code).replace(/^https?:\/\//, '')}</span>
        </div>
        <div className="mg-acts">
          <a className="btn btn-green" href={'/meet/' + m.code} target="_blank" rel="noopener">{m.startedAt ? 'Join' : 'Start'}</a>
          <button className="btn btn-line" onClick={() => copy(m.code)}>Copy link</button>
          <button className="btn btn-bad" disabled={!!busy} onClick={() => { if (window.confirm(`End “${m.title}” for everyone? The link stops working.`)) act({ action: 'end', code: m.code }, 'Meeting ended.') }}>End</button>
        </div>
      </li>)}</ul> : <p className="mg-dim">No open meetings. Create one above and share its link.</p>}
    </section>

    {ended.length ? <section className="mg-box">
      <h2>Ended</h2>
      <ul className="mg-list mg-ended">{ended.map((m) => <li key={m.code}>
        <div className="mg-main"><b>{m.title}</b><span className="mg-dim">Ended {when(m.endedAt)}{m.joins ? `. ${m.joins} join${m.joins === 1 ? '' : 's'}` : ''}</span></div>
        <div className="mg-acts"><button className="btn btn-line" disabled={!!busy} onClick={() => { if (window.confirm(`Delete “${m.title}”?`)) act({ action: 'delete', code: m.code }, 'Meeting deleted.') }}>Delete</button></div>
      </li>)}</ul>
    </section> : null}

    <style>{`
.mg{display:grid;gap:14px;max-width:880px}
.mg-box{padding:18px;border-radius:20px;border:1px solid var(--line);background:var(--raise)}
.mg-box h2{margin:0 0 12px;font-size:17px;font-weight:800}
.mg-box p{margin:0 0 12px;font-size:14.5px;line-height:1.6}
.mg-setup ul{margin:0 0 12px;padding-left:18px;font-size:14.5px;line-height:1.8}.mg-setup code{color:var(--green)}
.mg-new{display:grid;justify-items:start}.mg-new .input{max-width:460px;margin-bottom:14px}.mg-new .seg{margin-bottom:8px}
.mg-lab{font-size:13.5px;font-weight:600;color:var(--dim);margin:0 0 6px}
.mg-dim{color:var(--dim);font-size:13.5px}
.mg-list{list-style:none;margin:0;padding:0}
.mg-list li{display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:14px 0;border-top:1px solid var(--line)}
.mg-list li:first-child{border-top:0;padding-top:2px}
.mg-list li.mg-fresh{background:linear-gradient(90deg,rgba(143,227,106,.08),transparent);border-radius:14px;padding-left:12px;padding-right:12px}
.mg-main{display:grid;gap:3px;min-width:0;flex:1 1 260px}.mg-main b{font-size:15.5px}
.mg-url{font-size:13.5px;color:var(--green);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.mg-acts{display:flex;gap:8px;flex-wrap:wrap}.mg-acts .btn{padding:9px 15px;font-size:14px}
`}</style>
  </div>)
}
