'use client'
// Meetings: create a meeting, copy its link, start it (opens the room in a new tab), end it, delete old ones,
// and AI notes: made from a recording kept on this device (components/meet/notes.js), then read, copied or downloaded.
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast, Sheet } from './ui'
import { makeNotes, notesAudio, dropNotesAudio, notesText, download } from '@/components/meet/notes'

const when = (iso) => new Date(iso).toLocaleString('en-GB', { timeZone: 'Africa/Lagos', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const link = (code) => `${typeof window === 'undefined' ? 'https://olexweb.com' : window.location.origin}/meet/${code}`

export default function AdminMeetings({ data }) {
  const router = useRouter(), [title, setTitle] = useState(''), [speakers, setSpeakers] = useState('everyone'), [busy, setBusy] = useState(''), [fresh, setFresh] = useState(null)
  const [local, setLocal] = useState({}), [job, setJob] = useState(null), [view, setView] = useState(null), [focus, setFocus] = useState('')
  const refreshLocal = useCallback(() => notesAudio().then(setLocal).catch(() => {}), [])
  useEffect(() => {
    refreshLocal()
    const m = /^#notes-([a-z-]{12})$/.exec(window.location.hash)                   // arrived from a meeting's "Make AI notes"
    if (m) { setFocus(m[1]); setTimeout(() => { const el = document.getElementById('mg-' + m[1]); if (el) el.scrollIntoView({ block: 'center' }) }, 50) }
  }, [refreshLocal])
  const closeView = useCallback(() => setView(null), [])
  async function notes(m) {
    if (job) return
    setJob({ code: m.code, step: 'Getting ready…' })
    try {
      const r = await makeNotes(m.code, (step) => setJob({ code: m.code, step }))
      setView({ code: m.code, title: m.title, notes: r.notes, by: r.by, at: new Date().toISOString(), transcript: r.transcript }); toast('Notes ready.')
      router.refresh()
    } catch (e) { toast(e.message || 'The notes couldn’t be made. Try again.') }
    finally { setJob(null); refreshLocal() }
  }
  async function openNotes(m) {
    const j = await act({ action: 'get-notes', code: m.code }); if (j) setView({ code: m.code, ...j })
  }
  async function dropAudio(m) { if (!window.confirm('Delete the recording audio kept on this device for notes? Your downloaded recording isn’t affected.')) return; await dropNotesAudio(m.code).catch(() => {}); refreshLocal() }
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
  const noteBits = (m) => { const parts = (local[m.code] || []).length, working = job && job.code === m.code
    return <>
      {working ? <span className="mg-job" role="status"><i aria-hidden="true" />{job.step}</span> : null}
      {parts && !working ? <button className="btn btn-green" disabled={!!job} onClick={() => notes(m)}>{m.notesAt ? 'Make notes again' : 'Make AI notes'}</button> : null}
      {m.notesAt && !working ? <button className="btn btn-line" onClick={() => openNotes(m)}>Notes</button> : null}
      {parts && !working ? <button className="btn btn-line mg-quiet" onClick={() => dropAudio(m)} title="Delete the audio kept on this device">Delete audio</button> : null}
    </> }
  const noteLine = (m) => { const parts = (local[m.code] || []).length
    return parts && !m.notesAt ? <span className="mg-dim">A recording on this device is ready for AI notes.</span> : m.notesAt ? <span className="mg-dim">Notes made {when(m.notesAt)}</span> : null }

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
      {open.length ? <ul className="mg-list">{open.map((m) => <li key={m.code} id={'mg-' + m.code} className={fresh === m.code || focus === m.code ? 'mg-fresh' : ''}>
        <div className="mg-main">
          <b>{m.title}</b>
          <span className="mg-dim">{m.startedAt ? `Started ${when(m.startedAt)}` : `Created ${when(m.createdAt)}, not started`}{m.speakers === 'invited' ? '. Only people you let speak' : ''}{m.joins ? `. ${m.joins} join${m.joins === 1 ? '' : 's'}` : ''}</span>
          <span className="mg-url">{link(m.code).replace(/^https?:\/\//, '')}</span>
          {noteLine(m)}
        </div>
        <div className="mg-acts">
          {noteBits(m)}
          <a className="btn btn-green" href={'/meet/' + m.code} target="_blank" rel="noopener">{m.startedAt ? 'Join' : 'Start'}</a>
          <button className="btn btn-line" onClick={() => copy(m.code)}>Copy link</button>
          <button className="btn btn-bad" disabled={!!busy} onClick={() => { if (window.confirm(`End “${m.title}” for everyone? The link stops working.`)) act({ action: 'end', code: m.code }, 'Meeting ended.') }}>End</button>
        </div>
      </li>)}</ul> : <p className="mg-dim">No open meetings. Create one above and share its link.</p>}
    </section>

    {ended.length ? <section className="mg-box">
      <h2>Ended</h2>
      <ul className="mg-list mg-ended">{ended.map((m) => <li key={m.code} id={'mg-' + m.code} className={focus === m.code ? 'mg-fresh' : ''}>
        <div className="mg-main"><b>{m.title}</b><span className="mg-dim">Ended {when(m.endedAt)}{m.joins ? `. ${m.joins} join${m.joins === 1 ? '' : 's'}` : ''}</span>{noteLine(m)}</div>
        <div className="mg-acts">{noteBits(m)}<button className="btn btn-line" disabled={!!busy} onClick={() => { if (window.confirm(`Delete “${m.title}”?`)) act({ action: 'delete', code: m.code }, 'Meeting deleted.') }}>Delete</button></div>
      </li>)}</ul>
    </section> : null}

    {view ? <Sheet title={'Notes: ' + view.title} onClose={closeView} foot={<>
      <button className="btn btn-green" onClick={async () => { try { await navigator.clipboard.writeText(notesText(view.title, view.notes, view.at)); toast('Notes copied.') } catch { toast('Copy didn’t work here. Use Download.') } }}>Copy notes</button>
      <button className="btn btn-line" onClick={() => download(`${view.title} notes.md`, notesText(view.title, view.notes, view.at))}>Download</button>
      {view.transcript ? <button className="btn btn-line" onClick={() => download(`${view.title} transcript.txt`, view.transcript, 'text/plain')}>Transcript</button> : null}
    </>}>
      <div className="mg-notes">
        <p className="mg-summary">{view.notes.summary}</p>
        {[['Main points', view.notes.points], ['Decisions', view.notes.decisions], ['Open questions', view.notes.questions]].map(([h, items]) => items && items.length ? <section key={h}><h3>{h}</h3><ul>{items.map((x, i) => <li key={i}>{x}</li>)}</ul></section> : null)}
        {view.notes.actions && view.notes.actions.length ? <section><h3>Action items</h3><ul className="mg-actions">{view.notes.actions.map((a, i) => <li key={i}><b>{a.what}</b>{a.who || a.when ? <span>{[a.who, a.when].filter(Boolean).join(', ')}</span> : null}</li>)}</ul></section> : null}
        <p className="mg-dim mg-by">Written by {view.by || 'Olex AI'} from the recording. Check names and numbers before sharing.</p>
      </div>
    </Sheet> : null}

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
.mg-acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.mg-acts .btn{padding:9px 15px;font-size:14px}
.mg-quiet{border-color:transparent;color:var(--dim)}
.mg-job{display:inline-flex;align-items:center;gap:9px;font-size:13.5px;color:var(--paper);padding:6px 4px}
.mg-job i{width:14px;height:14px;border-radius:50%;border:2px solid rgba(143,227,106,.25);border-top-color:var(--green);animation:mg-spin .8s linear infinite}
@keyframes mg-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.mg-job i{animation:none}}
.mg-notes{display:grid;gap:18px;max-width:62ch}
.mg-summary{margin:0;font-size:16px;line-height:1.65}
.mg-notes h3{margin:0 0 8px;font-size:14px;font-weight:800;color:var(--green)}
.mg-notes ul{margin:0;padding-left:18px;display:grid;gap:6px;font-size:14.5px;line-height:1.55}
.mg-actions{list-style:none;padding-left:0!important}
.mg-actions li{display:grid;gap:2px;padding:10px 12px;border-radius:12px;background:var(--raise);border:1px solid var(--line)}
.mg-actions span{font-size:13px;color:var(--dim)}
.mg-by{margin:0}
`}</style>
  </div>)
}
