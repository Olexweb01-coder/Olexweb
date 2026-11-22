'use client'
// Choosing a time for a one-on-one session (times shown in the visitor's own time zone)
import { useMemo, useState } from 'react'
export default function Booker({ data, signedIn, home, via = null }) {
  const [pick, setPick] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState(''), [done, setDone] = useState(null)
  const days = useMemo(() => { const g = new Map(); for (const s of data.slots) { const k = new Date(s).toDateString(); if (!g.has(k)) g.set(k, []); g.get(k).push(s) } return [...g.entries()] }, [data.slots])
  const naira = (n) => '₦' + Math.round(n).toLocaleString('en-NG')
  async function go() {
    setBusy(true); setErr('')
    try { const r = await fetch('/api/meet/earn', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action: 'book', handle: data.mentor.handle, startsAt: pick, via }) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'That didn’t work.'); if (j.url) location.assign(j.url); else setDone(j) }
    catch (e) { setErr(e.message); setBusy(false) }
  }
  if (done) return <section className="pb-card pb-stack"><div className="pb-ok"><b>✓</b><div><h1 className="pb-h2" style={{ margin: 0 }}>You’re booked</h1></div></div><p>{new Date(pick).toLocaleString(undefined, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })} with {data.mentor.name}. It’s in your notifications, with the link.</p><a className="pb-btn pb-go" href={home + '#meetings'}>Go to my meetings</a></section>
  return (<>
    <div className="pb-row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>{data.mentor.picture ? <img className="pb-av" src={data.mentor.picture} alt="" referrerPolicy="no-referrer" /> : <span className="pb-av">{data.mentor.name.slice(0, 1)}</span>}
      <div style={{ minWidth: 0 }}><span className="pb-pill">One-on-one · private and encrypted</span><h1 className="pb-h1" style={{ marginTop: 8 }}>{data.title}</h1><p className="pb-dim" style={{ margin: '4px 0 0' }}>With {data.mentor.name} · {data.minutes} minutes, one on one · {data.price ? naira(data.price) : 'Free'}</p>{data.mentor.bio ? <p style={{ margin: '6px 0 0' }}>{data.mentor.bio}</p> : null}</div></div>
    <p className="pb-faint" style={{ margin: 0 }}>Times are shown in your own time zone. Pick one:</p>
    {days.length ? <div className="bk2-days">{days.map(([k, list]) => <section key={k} className="pb-card bk2-day"><b>{new Date(list[0]).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}</b>
      <div className="bk2-times">{list.map((s) => <button key={s} type="button" className={'bk2-t' + (pick === s ? ' on' : '')} aria-pressed={pick === s} onClick={() => setPick(s)}>{new Date(s).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</button>)}</div></section>)}</div>
      : <p className="pb-card pb-dim">No free times in the next two weeks. Check back soon.</p>}
    {err ? <p className="pb-err" role="alert">{err}</p> : null}
    {pick ? (signedIn ? <button className="pb-btn pb-go bk2-go" disabled={busy} onClick={go}>{busy ? 'Booking…' : data.price ? `Book and pay ${naira(data.price)}` : 'Book this time'}</button>
      : <a className="pb-btn pb-go bk2-go" href={`${home}?next=${encodeURIComponent('/meet/h/' + data.mentor.handle + '/book')}#signin`}>Sign in to book (free, 10 seconds)</a>) : null}
  </>)
}
