'use client'
// Choosing a time for a one-on-one session (times shown in the visitor's own time zone)
import { useMemo, useState } from 'react'
export default function Booker({ data, signedIn, home }) {
  const [pick, setPick] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState(''), [done, setDone] = useState(null)
  const days = useMemo(() => { const g = new Map(); for (const s of data.slots) { const k = new Date(s).toDateString(); if (!g.has(k)) g.set(k, []); g.get(k).push(s) } return [...g.entries()] }, [data.slots])
  const naira = (n) => '₦' + Math.round(n).toLocaleString('en-NG')
  async function go() {
    setBusy(true); setErr('')
    try { const r = await fetch('/api/meet/earn', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action: 'book', handle: data.mentor.handle, startsAt: pick }) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'That didn’t work.'); if (j.url) location.assign(j.url); else setDone(j) }
    catch (e) { setErr(e.message); setBusy(false) }
  }
  if (done) return <section className="md-card"><h1 className="pf-h1">You’re booked</h1><p>{new Date(pick).toLocaleString(undefined, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })} with {data.mentor.name}. It’s in your notifications, with the link.</p><a className="mh-btn mh-go" href={home + '#dashboard'}>Go to my dashboard</a></section>
  return (<>
    <div className="pf-head">{data.mentor.picture ? <img src={data.mentor.picture} alt="" width="84" height="84" referrerPolicy="no-referrer" /> : <i>{data.mentor.name.slice(0, 1)}</i>}
      <div><h1>{data.title}</h1><p>With {data.mentor.name} · {data.minutes} minutes, one on one · {data.price ? naira(data.price) : 'Free'}</p>{data.mentor.bio ? <small>{data.mentor.bio}</small> : null}</div></div>
    {days.length ? <div className="bk-days">{days.map(([k, list]) => <section key={k} className="bk-day"><b>{new Date(list[0]).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}</b>
      <div className="bk-times">{list.map((s) => <button key={s} type="button" className={'bk-t' + (pick === s ? ' on' : '')} onClick={() => setPick(s)}>{new Date(s).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</button>)}</div></section>)}</div>
      : <p className="md-dim">No free times in the next two weeks. Check back soon.</p>}
    {err ? <p className="md-err" role="alert">{err}</p> : null}
    {pick ? (signedIn ? <button className="mh-btn mh-go" disabled={busy} onClick={go}>{busy ? 'Booking…' : data.price ? `Book and pay ${naira(data.price)}` : 'Book this time'}</button>
      : <a className="mh-btn mh-go" href={home}>Sign in to book (free, 10 seconds)</a>) : null}
  </>)
}
