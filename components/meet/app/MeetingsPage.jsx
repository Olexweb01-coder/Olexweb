'use client'
// Meetings (Install 58): what's coming and what's ended, scheduling (with tickets, members-only, certificates), invites,
// flyers, AI notes and attendance. The same actions as before, in the new design.
import { useEffect, useState } from 'react'
import { FormSettings, Attendance, formFrom, NotesPanel } from '../Guests'
import { notesAudio } from '../recorder'
import { I } from './icons'
import { api, pathFor, linkFor, copyText, Sheet, Field, Empty, naira, split, kobo } from './ui'

const tzName = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, ' ') } catch { return 'your time' } }
const fmt = (iso) => new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
const fmtLong = (iso) => new Date(iso).toLocaleString(undefined, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })
const pad = (n) => String(n).padStart(2, '0')
function nextSlot() { const d = new Date(Date.now() + 90 * 60e3); d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0); return [`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, `${pad(d.getHours())}:${pad(d.getMinutes())}`] }
function calLinks(m) {
  const z = (x) => new Date(x).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''), t = new Date(m.startsAt).getTime(), url = linkFor(m.code)
  return { google: 'https://calendar.google.com/calendar/render?' + new URLSearchParams({ action: 'TEMPLATE', text: m.title, dates: `${z(t)}/${z(t + (m.minutes || 60) * 60e3)}`, details: 'Join the meeting: ' + url, location: url }), ics: '/api/meet?calendar=1&code=' + m.code }
}
export default function MeetingsPage({ ctx, notes = false }) {
  const { list, refresh, setToast, h, pricing, morePast } = ctx
  const [sheet, setSheet] = useState(null), [busy, setBusy] = useState(''), [att, setAtt] = useState(null), [notesFor, setNotesFor] = useState(null), [local, setLocal] = useState({}), [ready, setReady] = useState(false)
  const membersOn = !!(h && h.me && h.me.membersOn)
  useEffect(() => {
    setReady(true); notesAudio().then(setLocal).catch(() => {})
    const s = () => openSchedule(); window.addEventListener('meet:schedule', s); return () => window.removeEventListener('meet:schedule', s)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const upcoming = list.filter((m) => !m.endedAt), past = list.filter((m) => m.endedAt)
  function openSchedule(m = null) {
    const [d, t] = m && m.startsAt ? (() => { const x = new Date(m.startsAt); return [`${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`, `${pad(x.getHours())}:${pad(x.getMinutes())}`] })() : nextSlot()
    setSheet({ edit: m, title: m ? m.title : '', date: d, time: t, minutes: m ? m.minutes || 60 : 60, speakers: m ? m.speakers : 'everyone', form: formFrom(m && m.form), done: null, price: m && m.price ? m.price : '', membersOnly: !!(m && m.membersOnly) })
  }
  async function earn(body) { return api('/api/meet/earn', body) }
  async function save(e) {
    e.preventDefault(); const s = sheet, startsAt = new Date(`${s.date}T${s.time}:00`)
    if (!Number.isFinite(startsAt.getTime())) { setToast('Choose a date and time.'); return }
    setBusy('schedule')
    try {
      const body = { title: s.title, startsAt: startsAt.toISOString(), minutes: s.minutes, speakers: s.speakers, ...(s.edit ? {} : { mode: s.mode || 'video', private: !!s.private, certs: !!s.certs, followup: !!s.followup }), form: s.form && s.form.on ? s.form : { on: false } }
      const r = s.edit ? await api('/api/meet/mine', { action: 'update', code: s.edit.code, ...body }) : await api('/api/meet/mine', { action: 'create', ...body })
      const code = s.edit ? s.edit.code : r.code, m = { code, title: s.title || 'Meeting', startsAt: startsAt.toISOString(), minutes: s.minutes }
      const warn = []
      if (pricing && pricing.on && String(s.price) !== String((s.edit && s.edit.price) || '')) await earn({ action: 'price', code, price: Number(s.price) || 0 }).catch((x) => warn.push(x.message))
      if (s.membersOnly !== !!(s.edit && s.edit.membersOnly)) await earn({ action: 'members-only', code, on: s.membersOnly }).catch((x) => warn.push(x.message))
      if (warn.length) setToast(warn.join(' '))
      setSheet({ ...s, done: m }); refresh()
    } catch (err) { setToast(err.message) } finally { setBusy('') }
  }
  async function act(m, action) {
    if (action === 'end' && !confirm(`End “${m.title}” for everyone? The link stops working.`)) return
    if (action === 'delete' && !confirm(`Delete “${m.title}”? This can’t be undone.`)) return
    setBusy(action + m.code); try { await api('/api/meet/mine', { action, code: m.code }); await refresh(); setToast(action === 'end' ? 'Meeting ended.' : 'Deleted.') } catch (e) { setToast(e.message) } finally { setBusy('') }
  }
  async function copy(m) {
    const text = m.startsAt ? `You’re invited: ${m.title}\n${fmtLong(m.startsAt)} (${tzName()} time)\nJoin: ${linkFor(m.code)}` : `Join my meeting: ${linkFor(m.code)}`
    await copyText(text); setToast(m.startsAt ? 'Invite copied.' : 'Link copied.')
  }
  const tick = sheet && pricing && pricing.on && Number(sheet.price) >= 100 ? split(sheet.price, 'ticket') : null
  return (<div className="wrap">
    <div className="pghead"><div><h1>{notes ? 'Recordings and notes' : 'Meetings'}</h1><p className="dim">{notes ? 'AI notes from your meetings, and recordings saved on this device.' : 'Start, schedule and share. Guests never need an account.'}</p></div>
      {!notes ? <button className="btn go" onClick={() => openSchedule()}><I n="cal" />Schedule</button> : null}</div>
    {!notes ? <section className="card"><div className="ch"><h3>Coming up</h3></div>
      {upcoming.length ? upcoming.map((m) => <div key={m.code} className="mrow wrap-sm">
        <div className={'when' + (m.startedAt ? ' live' : '')}>{m.startedAt ? <><b>●</b><small>Live</small></> : m.startsAt ? <><b>{new Date(m.startsAt).getDate()}</b><small>{new Date(m.startsAt).toLocaleDateString(undefined, { month: 'short' })}</small></> : <><b>–</b><small>Any</small></>}</div>
        <div className="t"><b>{m.title}</b><span>{ready ? (m.startedAt ? 'Happening now' : m.startsAt ? fmt(m.startsAt) : 'Ready when you are') : ' '}{m.price ? ` · ${naira(m.price)} ticket` : ''}{m.membersOnly ? ' · members only' : ''}{m.form ? ' · asks for details' : ''}</span></div>
        <div className="acts"><a className="btn go sm" href={pathFor(m.code)}>{m.startedAt ? 'Join' : 'Start'}</a><button className="btn sm" onClick={() => copy(m)}>{m.startsAt ? 'Copy invite' : 'Copy link'}</button>
          {m.startsAt ? <a className="btn sm" href={`/api/meet/flyer/${m.code}?download`} download>Flyer</a> : null}
          {!m.startedAt ? <button className="btn sm" onClick={() => openSchedule(m)}>{m.startsAt ? 'Change' : 'Schedule'}</button> : null}
          <button className="btn sm quiet" disabled={!!busy} onClick={() => act(m, 'end')}>End</button></div></div>)
        : <Empty icon="cal" title="No meetings yet">Start one now, or schedule one and share the invite.</Empty>}</section> : null}
    <section className="card"><div className="ch"><h3>{notes ? 'Your meetings' : 'Ended'}</h3></div>
      {past.length ? past.slice(0, notes ? 40 : 12).map((m) => <div key={m.code} className="mrow wrap-sm"><div className="when"><b>{new Date(m.endedAt).getDate()}</b><small>{new Date(m.endedAt).toLocaleDateString(undefined, { month: 'short' })}</small></div>
        <div className="t"><b>{m.title}</b><span>{ready ? 'Ended ' + fmt(m.endedAt) : ' '}{m.joins ? `, ${m.joins} join${m.joins === 1 ? '' : 's'}` : ''}</span></div>
        <div className="acts">{local[m.code] && local[m.code].length ? <button className="btn sm go" onClick={() => setNotesFor({ m, make: true })}>Make AI notes</button> : null}{m.notesAt ? <button className="btn sm" onClick={() => setNotesFor({ m, make: false })}>Notes</button> : null}
          {m.form ? <button className="btn sm" onClick={() => setAtt(m.code)}>Attendance</button> : null}<button className="btn sm quiet" disabled={!!busy} onClick={() => act(m, 'delete')}>Delete</button></div></div>)
        : <Empty icon="spark" title="Nothing here yet">Ended meetings, their AI notes and attendance lists show here.</Empty>}
      {morePast ? <p className="dim">{morePast} older meeting{morePast === 1 ? '' : 's'} and {morePast === 1 ? 'its transcript' : 'their transcripts'} are kept for you. Pro shows them all.</p> : null}</section>

    {sheet ? <Sheet title={sheet.done ? (sheet.edit ? 'Meeting updated' : 'Meeting scheduled') : sheet.edit ? 'Change the meeting' : 'Schedule a meeting'} onClose={() => setSheet(null)} wide>
      {sheet.done ? <div className="stack">
        <p><b>{sheet.done.title}</b><br />{fmtLong(sheet.done.startsAt)} ({tzName()} time)</p>
        <div className="linkbox"><code>{linkFor(sheet.done.code)}</code></div>
        <div className="row-btns"><button className="btn go" onClick={() => copy(sheet.done)}>Copy invite</button><a className="btn" href={calLinks(sheet.done).google} target="_blank" rel="noopener">Google Calendar</a><a className="btn" href={calLinks(sheet.done).ics} download="meeting.ics">Apple or Outlook</a></div>
        <p className="dim">Guests can add it to their calendar from the link too, with reminders built in.</p>
      </div> : <form onSubmit={save} className="stack">
        <Field label="Name"><input className="in" value={sheet.title} maxLength={80} onChange={(e) => setSheet({ ...sheet, title: e.target.value })} placeholder="Team catch-up" /></Field>
        <div className="grid3"><Field label="Date"><input className="in" type="date" value={sheet.date} onChange={(e) => setSheet({ ...sheet, date: e.target.value })} /></Field>
          <Field label={`Time (${ready ? tzName() : 'your time'})`}><input className="in" type="time" value={sheet.time} step={300} onChange={(e) => setSheet({ ...sheet, time: e.target.value })} /></Field>
          <Field label="Length"><select className="in" value={sheet.minutes} onChange={(e) => setSheet({ ...sheet, minutes: Number(e.target.value) })}>{[15, 30, 45, 60, 90, 120, 180].map((m) => <option key={m} value={m}>{m < 60 ? m + ' minutes' : m === 60 ? '1 hour' : m / 60 + ' hours'}</option>)}</select></Field></div>
        {!sheet.edit ? <div className="seg" role="group" aria-label="Meeting type"><button type="button" aria-pressed={(sheet.mode || 'video') === 'video'} onClick={() => setSheet({ ...sheet, mode: 'video' })}>Video meeting</button><button type="button" aria-pressed={sheet.mode === 'audio'} onClick={() => setSheet({ ...sheet, mode: 'audio' })}>Audio call</button></div> : null}
        <div className="seg" role="group" aria-label="Who can speak"><button type="button" aria-pressed={sheet.speakers === 'everyone'} onClick={() => setSheet({ ...sheet, speakers: 'everyone' })}>Everyone can speak</button><button type="button" aria-pressed={sheet.speakers === 'invited'} onClick={() => setSheet({ ...sheet, speakers: 'invited' })}>Only people I let speak</button></div>
        {!sheet.edit ? <><label className="check"><input type="checkbox" checked={!!sheet.certs} onChange={(e) => setSheet({ ...sheet, certs: e.target.checked })} /><span>Certificates: everyone who stays at least half the meeting gets one, with its own code anyone can check{pricing && pricing.on ? ' (Pro)' : ''}. Set a price and the design in Earn.</span></label>
          <label className="check"><input type="checkbox" checked={!!sheet.followup} onChange={(e) => setSheet({ ...sheet, followup: e.target.checked })} /><span>AI follow-up: once you make AI notes, everyone who signed up gets the summary and next steps by email{pricing && pricing.on ? ' (Pro)' : ''}.</span></label>
          <label className="check"><input type="checkbox" checked={!!sheet.private} onChange={(e) => setSheet({ ...sheet, private: e.target.checked })} /><span>End-to-end encrypted: only people in the meeting can see and hear it, not even our servers.</span></label></> : null}
        {membersOn ? <label className="check"><input type="checkbox" checked={!!sheet.membersOnly} onChange={(e) => setSheet({ ...sheet, membersOnly: e.target.checked })} /><span>Members only: only members of your community can join. It counts towards your monthly promise.</span></label> : null}
        <FormSettings value={sheet.form} onChange={(f) => setSheet({ ...sheet, form: f })} />
        {pricing && pricing.on && !sheet.membersOnly ? <Field label="Ticket price (₦, empty = free)" hint={tick ? null : 'People pay before they join. Add your bank in Earn first.'}><input className="in" type="number" min={0} inputMode="numeric" value={sheet.price} onChange={(e) => setSheet({ ...sheet, price: e.target.value })} placeholder="Free" /></Field> : null}
        {tick ? <div className="fees sm"><div><span>Ticket</span><b>{kobo(tick.price)}</b></div><div><span>Paystack’s fee (you pay it)</span><b>− {kobo(tick.paystack)}</b></div><div><span>Olexweb ({tick.pct}%)</span><b>− {kobo(tick.olexweb)}</b></div><div className="t"><span>You get, per ticket</span><b>{kobo(tick.host)}</b></div></div> : null}
        <div className="row-btns"><button className="btn go" disabled={busy === 'schedule'}>{busy === 'schedule' ? 'Saving…' : sheet.edit ? 'Save' : 'Schedule'}</button><button type="button" className="btn quiet" onClick={() => setSheet(null)}>Cancel</button></div>
      </form>}
    </Sheet> : null}
    {notesFor ? <NotesPanel code={notesFor.m.code} title={notesFor.m.title} make={notesFor.make} onClose={() => { setNotesFor(null); notesAudio().then(setLocal).catch(() => {}); refresh() }} /> : null}
    {att ? <Attendance code={att} onClose={() => setAtt(null)} onDeleted={() => setToast('The attendance list was deleted.')} /> : null}
  </div>)
}
