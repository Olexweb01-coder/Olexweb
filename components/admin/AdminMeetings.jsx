'use client'
// Meetings: create a meeting, copy its link, start it (opens the room in a new tab), end it, delete old ones,
// and AI notes: made from a recording kept on this device (components/meet/notes.js), then read, copied or downloaded.
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast, Sheet } from './ui'
import { makeNotes, notesAudio, dropNotesAudio, notesText, download } from '@/components/meet/notes'

// Dates are formatted here, not by the system's date library: the server's and the browser's disagree on punctuation
// ("Tue 3 Nov" vs "Tue, 3 Nov"), which made React redraw the page. Lagos is UTC+1 all year (no daylight saving).
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const parts = (iso) => { const d = new Date(new Date(iso).getTime() + 3600e3); return { wd: d.getUTCDay(), day: d.getUTCDate(), mon: d.getUTCMonth(), h: d.getUTCHours(), mi: String(d.getUTCMinutes()).padStart(2, '0') } }
const when = (iso) => { const p = parts(iso); return `${DAYS[p.wd].slice(0, 3)} ${p.day} ${MONTHS[p.mon].slice(0, 3)}, ${String(p.h).padStart(2, '0')}:${p.mi}` }
// scheduling, in Lagos time (UTC+1 all year)
const lagosNow = () => new Date(Date.now() + 3600e3).toISOString()
function nextSlot() { const d = new Date(Date.now() + 3600e3 + 90 * 60e3); d.setUTCMinutes(d.getUTCMinutes() < 30 ? 30 : 60, 0, 0); return d.toISOString() }
const toIso = (date, time) => (date && time ? new Date(`${date}T${time}:00+01:00`).toISOString() : null)
const lagosParts = (iso) => { const x = new Date(new Date(iso).getTime() + 3600e3).toISOString(); return [x.slice(0, 10), x.slice(11, 16)] }
const longWhen = (iso) => { const p = parts(iso); return `${DAYS[p.wd]} ${p.day} ${MONTHS[p.mon]}, ${p.h % 12 || 12}:${p.mi} ${p.h < 12 ? 'am' : 'pm'}` }
function smart(iso) { if (!iso) return []; const lead = (new Date(iso).getTime() - Date.now()) / 60e3; const r = [1440, 60, 30].filter((m) => m <= lead - 2); if (!r.length && lead > 7) r.push(lead > 20 ? 10 : 5); return r }
const words = (m) => { if (m % 1440 === 0) return m === 1440 ? '1 day' : `${m / 1440} days`; const h = Math.floor(m / 60), r = m % 60; return [h && `${h} hour${h === 1 ? '' : 's'}`, r && `${r} min`].filter(Boolean).join(' ') }
const listWords = (r) => (r.length ? r.map(words).join(', ').replace(/, ([^,]*)$/, ' and $1') + ' before' : 'none')
const fromNow = (iso) => { const m = Math.round((new Date(iso).getTime() - Date.now()) / 60e3); if (m <= 0) return m > -60 ? 'due now' : 'was due'; const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60); return 'in ' + (d ? `${d} day${d === 1 ? '' : 's'}${h ? ` ${h} h` : ''}` : h ? `${h} h ${m % 60} min` : `${m} min`) }
const PRESETS = [5, 10, 15, 30, 60, 120, 180, 1440, 2880, 10080]
// the reminders for one meeting: smart (follows the time) or your own
function Reminders({ start, value, onChange }) {
  const list = value || smart(start), [add, setAdd] = useState('')
  return (<div className="mg-rem">
    <p className="mg-lab">Reminders to your phone {value ? '' : <span className="mg-dim">(smart: they follow the meeting’s time)</span>}</p>
    <div className="mg-chips">{list.length ? list.map((m) => <span key={m} className="mg-chip">{words(m)} before<button type="button" aria-label={`Remove the ${words(m)} reminder`} onClick={() => onChange(list.filter((x) => x !== m))}>×</button></span>) : <span className="mg-dim">No reminders. You’ll still get one when it starts.</span>}</div>
    <div className="mg-addrem">
      <select className="input" value={add} onChange={(e) => { const v = Number(e.target.value); setAdd(''); if (v && !list.includes(v)) onChange([...list, v].sort((a, b) => b - a)) }} aria-label="Add a reminder">
        <option value="">Add a reminder…</option>{PRESETS.filter((m) => !list.includes(m)).map((m) => <option key={m} value={m}>{words(m)} before</option>)}
      </select>
      {value ? <button type="button" className="btn btn-line mg-quiet" onClick={() => onChange(null)}>Use smart reminders</button> : null}
    </div>
  </div>)
}
function When({ when, setWhen, date, setDate, time, setTime, minutes, setMinutes, rem, setRem, allowNone }) {
  return (<div className="mg-sched">
    <p className="mg-lab">When</p>
    <div className="seg" role="group" aria-label="When">
      <button type="button" aria-pressed={when === 'now'} onClick={() => setWhen('now')}>{allowNone ? 'No set time' : 'Start now'}</button>
      <button type="button" aria-pressed={when === 'later'} onClick={() => setWhen('later')}>Schedule</button>
    </div>
    {when === 'later' ? <>
      <div className="mg-dt">
        <label><span className="mg-lab">Date</span><input className="input" type="date" value={date} min={lagosNow().slice(0, 10)} onChange={(e) => setDate(e.target.value)} /></label>
        <label><span className="mg-lab">Time (Lagos)</span><input className="input" type="time" value={time} step={300} onChange={(e) => setTime(e.target.value)} /></label>
        <label><span className="mg-lab">Length</span><select className="input" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>{[15, 30, 45, 60, 90, 120, 180].map((m) => <option key={m} value={m}>{words(m).replace(' min', ' minutes')}</option>)}</select></label>
      </div>
      <Reminders start={toIso(date, time)} value={rem} onChange={setRem} />
    </> : null}
  </div>)
}

// dates in words and "in 2 days" depend on the minute and on how each system formats time: shown only in the browser,
// so the server's page and the browser's never mismatch (React hydration)
function InBrowser({ children }) { const [on, setOn] = useState(false); useEffect(() => setOn(true), []); return on ? children : null }

let BASE = null                                                           // the Meet app's address, once MEET_ORIGIN is set
const link = (code) => (BASE ? `${BASE}/${code}` : `${typeof window === 'undefined' ? 'https://olexweb.com' : window.location.origin}/meet/${code}`)

export default function AdminMeetings({ data }) {
  BASE = data.base || null
  const router = useRouter(), [title, setTitle] = useState(''), [speakers, setSpeakers] = useState('everyone'), [busy, setBusy] = useState(''), [fresh, setFresh] = useState(null)
  const [local, setLocal] = useState({}), [job, setJob] = useState(null), [view, setView] = useState(null), [focus, setFocus] = useState('')
  const [first] = useState(() => lagosParts(nextSlot())), [sched, setSched] = useState('now'), [date, setDate] = useState(first[0]), [time, setTime] = useState(first[1]), [minutes, setMinutes] = useState(60), [rem, setRem] = useState(null)
  const [edit, setEdit] = useState(null)
  const refreshLocal = useCallback(() => notesAudio().then(setLocal).catch(() => {}), [])
  useEffect(() => {
    refreshLocal()
    const m = /^#(?:notes|meet)-([a-z-]{12})$/.exec(window.location.hash)          // arrived from "Make AI notes" or a reminder
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
    const later = sched === 'later', startsAt = later ? toIso(date, time) : null
    if (later && !startsAt) { toast('Choose a date and time.'); return }
    const j = await act({ action: 'create', title, speakers, ...(later ? { startsAt, minutes, ...(rem ? { reminders: rem } : {}) } : {}) }, later ? 'Meeting scheduled.' : 'Meeting created.')
    if (j && j.code) { setFresh(j.code); setTitle(''); setRem(null) }
  }
  async function invite(m) {
    const text = `You’re invited: ${m.title}\n${longWhen(m.startsAt)} (Lagos time)\nJoin here: ${link(m.code)}\nYou can add it to your calendar from that page.`
    try { await navigator.clipboard.writeText(text); toast('Invite copied. Paste it into WhatsApp or anywhere.') } catch { window.prompt('Copy the invite:', text) }
  }
  function openEdit(m) { const [d, t] = lagosParts(m.startsAt || nextSlot()); setEdit({ m, title: m.title, speakers: m.speakers, when: m.startsAt ? 'later' : 'now', date: d, time: t, minutes: m.minutes || 60, rem: m.startsAt && !m.remindersAuto ? m.reminders : null }) }
  async function saveEdit() {
    const e = edit, later = e.when === 'later', startsAt = later ? toIso(e.date, e.time) : null
    if (later && !startsAt) { toast('Choose a date and time.'); return }
    const moved = (startsAt || null) !== (e.m.startsAt ? new Date(e.m.startsAt).toISOString() : null)
    const j = await act({ action: 'update', code: e.m.code, title: e.title, speakers: e.speakers, minutes: e.minutes, ...(moved ? { startsAt } : {}), reminders: e.rem ? e.rem : 'smart' }, 'Meeting updated.')
    if (j) setEdit(null)
  }
  const closeEdit = useCallback(() => setEdit(null), [])
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
      <When when={sched} setWhen={setSched} date={date} setDate={setDate} time={time} setTime={setTime} minutes={minutes} setMinutes={setMinutes} rem={rem} setRem={setRem} />
      <button className="btn btn-green" disabled={!!busy}>{busy === 'create' ? 'Saving…' : sched === 'later' ? 'Schedule meeting' : 'Create meeting'}</button>
    </form>

    <section className="mg-box">
      <h2>Open meetings</h2>
      {open.length ? <ul className="mg-list">{open.map((m) => <li key={m.code} id={'mg-' + m.code} className={fresh === m.code || focus === m.code ? 'mg-fresh' : ''}>
        <div className="mg-main">
          <b>{m.title}</b>
          {m.startsAt && !m.startedAt ? <span className="mg-at"><b>{longWhen(m.startsAt)}</b> <span className="mg-dim"><InBrowser>{fromNow(m.startsAt) + '. '}</InBrowser>Reminders: {listWords(m.reminders)}{m.remindersAuto ? ' (smart)' : ''}</span></span> : null}
          <span className="mg-dim">{m.startedAt ? `Started ${when(m.startedAt)}` : m.startsAt ? `${m.minutes} minutes` : `Created ${when(m.createdAt)}, not started`}{m.speakers === 'invited' ? '. Only people you let speak' : ''}{m.joins ? `. ${m.joins} join${m.joins === 1 ? '' : 's'}` : ''}</span>
          <span className="mg-url"><InBrowser>{link(m.code).replace(/^https?:\/\//, '')}</InBrowser></span>
          {noteLine(m)}
        </div>
        <div className="mg-acts">
          {noteBits(m)}
          <a className="btn btn-green" href={'/meet/' + m.code} target="_blank" rel="noopener">{m.startedAt ? 'Join' : 'Start'}</a>
          {m.startsAt && !m.startedAt ? <button className="btn btn-line" onClick={() => invite(m)}>Copy invite</button> : <button className="btn btn-line" onClick={() => copy(m.code)}>Copy link</button>}
          {!m.startedAt ? <button className="btn btn-line" onClick={() => openEdit(m)}>Edit</button> : null}
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

    {edit ? <Sheet title={'Edit: ' + edit.m.title} onClose={closeEdit} foot={<><button className="btn btn-green" disabled={!!busy} onClick={saveEdit}>{busy === 'update' + edit.m.code ? 'Saving…' : 'Save'}</button><button className="btn btn-line" onClick={closeEdit}>Cancel</button></>}>
      <div className="mg-edit">
        <label className="mg-lab" htmlFor="mg-etitle">Name</label>
        <input id="mg-etitle" className="input" maxLength={80} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
        <p className="mg-lab">Who can speak</p>
        <div className="seg" role="group" aria-label="Who can speak"><button type="button" aria-pressed={edit.speakers === 'everyone'} onClick={() => setEdit({ ...edit, speakers: 'everyone' })}>Everyone</button><button type="button" aria-pressed={edit.speakers === 'invited'} onClick={() => setEdit({ ...edit, speakers: 'invited' })}>Only people I let speak</button></div>
        <When allowNone when={edit.when} setWhen={(v) => setEdit({ ...edit, when: v })} date={edit.date} setDate={(v) => setEdit({ ...edit, date: v })} time={edit.time} setTime={(v) => setEdit({ ...edit, time: v })} minutes={edit.minutes} setMinutes={(v) => setEdit({ ...edit, minutes: v })} rem={edit.rem} setRem={(v) => setEdit({ ...edit, rem: v })} />
        <p className="mg-dim">Moving the time resets the reminders, so each goes out once at its new time. Guests who added it to their calendar keep the old time: send them the new invite.</p>
      </div>
    </Sheet> : null}

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
.mg-sched{display:grid;gap:8px;margin:6px 0 14px;justify-items:start;width:100%}
.mg-dt{display:grid;grid-template-columns:repeat(3,minmax(0,170px));gap:10px;width:100%}.mg-dt label{display:grid;gap:6px}.mg-dt .mg-lab{margin:0}
.mg-rem{display:grid;gap:8px;width:100%}.mg-chips{display:flex;flex-wrap:wrap;gap:6px}
.mg-chip{display:inline-flex;align-items:center;gap:4px;padding:5px 6px 5px 12px;border-radius:999px;background:rgba(143,227,106,.12);font-size:13.5px;font-weight:600}
.mg-chip button{appearance:none;border:0;background:none;color:var(--dim);font-size:17px;line-height:1;width:24px;height:24px;border-radius:50%;cursor:pointer}.mg-chip button:hover{background:rgba(242,239,233,.08);color:var(--paper)}
.mg-addrem{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.mg-addrem select.input{width:auto;max-width:240px}
.mg-at{display:grid;gap:2px}.mg-at b{font-size:14.5px}
.mg-edit{display:grid;gap:8px;max-width:560px;justify-items:start}.mg-edit .input{max-width:460px}
@media (max-width:640px){.mg-dt{grid-template-columns:1fr 1fr}.mg-dt label:last-child{grid-column:1/-1}}
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
