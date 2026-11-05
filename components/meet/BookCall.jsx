'use client'
// "Book a call with Olaitan": the open times in the visitor's own time zone, then name, email, company, note.
import { useEffect, useMemo, useState } from 'react'

export default function BookCall({ token = '' }) {
  const [slots, setSlots] = useState(null), [day, setDay] = useState(null), [slot, setSlot] = useState(null), [f, setF] = useState({ name: '', email: '', company: '', note: '', website: '' })
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [done, setDone] = useState(null)
  const [tz, setTz] = useState('')                                         // the visitor's time zone: only known in their browser
  useEffect(() => { setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'); fetch('/api/meet/book', { cache: 'no-store' }).then((r) => r.json()).then((j) => setSlots(j.slots || [])).catch(() => setSlots([])) }, [])
  const days = useMemo(() => {
    const g = new Map(); for (const s of slots || []) { const k = new Date(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz }); if (!g.has(k)) g.set(k, []); g.get(k).push(s) }
    return [...g.entries()]
  }, [slots, tz])
  useEffect(() => { if (days.length && !day) setDay(days[0][0]) }, [days, day])
  const time = (s) => new Date(s).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('')
    try {
      const r = await fetch('/api/meet/book', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, slot, t: token, tz }) })
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'That didn’t work. Try again.'); setDone(j)
    } catch (x) { setErr(x.message); if (/taken/.test(x.message)) { setSlot(null); fetch('/api/meet/book', { cache: 'no-store' }).then((r) => r.json()).then((j) => setSlots(j.slots || [])) } }
    setBusy(false)
  }
  return (<div className="mh"><main className="bk"><div className="bk-card">
    <p className="bk-brand">Olexweb <span>Meet</span></p>
    {done ? <><h1>You’re booked</h1><p className="bk-lead"><b>{done.when}</b>. A confirmation with the join link and a calendar invite is on its way to your email.</p>
      <a className="mh-btn mh-go" href={done.link}>Open the meeting link</a></> : <>
      <h1>Book a call with Olaitan</h1>
      <p className="bk-lead">A 30-minute video call about your website or booking system, on Olexweb Meet in your browser. {tz ? `Times are shown in your time zone (${tz.replace(/_/g, ' ')}).` : ''}</p>
      {!slots || !tz ? <p className="bk-dim">Loading times…</p> : !slots.length ? <p className="bk-dim">No times are open right now. Please check back soon, or reply to the email you received.</p> : <>
        <div className="bk-days" role="tablist">{days.map(([k]) => <button key={k} type="button" aria-pressed={day === k} onClick={() => { setDay(k); setSlot(null) }}>{k}</button>)}</div>
        <div className="bk-times">{(days.find(([k]) => k === day) || [null, []])[1].map((s) => <button key={s} type="button" aria-pressed={slot === s} onClick={() => setSlot(s)}>{time(s)}</button>)}</div>
        {slot ? <form className="bk-form" onSubmit={submit}>
          <p className="bk-pick">{new Date(slot).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz })}</p>
          <label className="mh-f"><span>Your name</span><input autoComplete="name" maxLength={80} value={f.name} onChange={set('name')} required /></label>
          <label className="mh-f"><span>Email</span><input type="email" autoComplete="email" value={f.email} onChange={set('email')} required /></label>
          <label className="mh-f"><span>Business (optional)</span><input autoComplete="organization" maxLength={120} value={f.company} onChange={set('company')} /></label>
          <label className="mh-f"><span>Anything to know first? (optional)</span><textarea rows={3} maxLength={500} value={f.note} onChange={set('note')} /></label>
          <label className="bk-trap" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} /></label>
          <button className="mh-btn mh-go bk-wide" disabled={busy}>{busy ? 'Booking…' : 'Book this time'}</button>
        </form> : null}</>}
      {err ? <p className="es-err" role="alert">{err}</p> : null}</>}
  </div></main></div>)
}
