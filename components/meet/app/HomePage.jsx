'use client'
// Home (Install 58): a greeting with your level and next meeting, quick actions, what's coming, your streak, next
// steps that earn XP, the spotlight and What's new.
import { useEffect, useState } from 'react'
import { I } from './icons'
import { pathFor, linkFor, copyText, Avatar, day, JoinBox } from './ui'
import { ProLocked } from './ProLock'

function Countdown({ at }) {
  const [t, setT] = useState(null)
  useEffect(() => { const f = () => setT(Math.max(0, new Date(at).getTime() - Date.now())); f(); const i = setInterval(f, 1000); return () => clearInterval(i) }, [at])
  if (t == null) return <span className="cd">&nbsp;</span>
  const s = Math.floor(t / 1000), p = (n) => String(n).padStart(2, '0')
  return <span className="cd">{s > 86400 ? `${Math.floor(s / 86400)}d ${p(Math.floor((s % 86400) / 3600))}h` : `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`}</span>
}
export default function HomePage({ ctx }) {
  const { h, list, me, startNow, openRoom, nav, setToast } = ctx
  const [hello, setHello] = useState('Hello')
  useEffect(() => { const hr = new Date().getHours(); setHello(hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening') }, [])
  if (!h) return <div className="wrap"><div className="hello skel" style={{ height: 220 }} /><div className="tiles4">{[1, 2, 3, 4].map((i) => <div key={i} className="tile skel" />)}</div></div>
  const lvl = h.level, comm = h.community, s = h.dash.stats
  const upcoming = list.filter((m) => !m.endedAt).sort((a, b) => (a.startedAt ? -1 : b.startedAt ? 1 : 0) || new Date(a.startsAt || 8.64e15) - new Date(b.startsAt || 8.64e15))
  const next = upcoming.find((m) => m.startedAt || m.startsAt)
  const first = (me.name || '').split(' ')[0] || 'there'
  const line = comm.streak >= 2 ? `${comm.streak} weeks in a row. ` : ''
  const quests = [
    { done: s.meetings > 0, t: 'Host your first meeting', d: 'Any length. Start one now.', xp: 50, go: () => startNow('video') },
    { done: comm.public && !!comm.handle, t: 'Show your profile', d: 'Join the leaderboard and let people follow you.', xp: 100, go: () => nav('profile') },
    { done: comm.badges.filter((b) => b.earned && b.id !== 'public').length >= 10, t: 'Earn 10 badges', d: `${Math.min(10, comm.badges.filter((b) => b.earned && b.id !== 'public').length)} of 10. 10 badges earn you a free Pro meeting.`, xp: 0, pct: Math.min(100, comm.badges.filter((b) => b.earned && b.id !== 'public').length * 10), go: () => nav('profile') },
    { done: false, t: 'Invite a friend', d: 'Earn 15% of their Pro payments for 6 months.', xp: 0, go: async () => { await copyText(comm.invite); setToast('Invite link copied.') } },
  ]
  const winners = comm.spotlight ? Object.values(comm.spotlight.winners || {}) : []
  return (<div className="wrap">
    <JoinBox className="search joinm" />
    <section className="hello"><div style={{ position: 'relative', zIndex: 1, minWidth: 0 }}>
      <h1>{hello}, {first}</h1>
      <p>{line}{lvl.toNext ? `${lvl.toNext.toLocaleString()} XP to level ${lvl.level + 1}.` : 'You’re at the top level.'} {s.meetings ? `${s.meetings} meeting${s.meetings === 1 ? '' : 's'} hosted so far.` : 'Your first meeting is one tap away.'}</p>
      {next ? <div className="next"><span className="ni bg-o" style={{ width: 44, height: 44, borderRadius: 14, display: 'grid', placeItems: 'center' }}><I n="video" /></span>
        <div className="t"><b>{next.title}</b><small>{next.startedAt ? 'Happening now' : <>Starts in <Countdown at={next.startsAt} /></>}</small></div>
        <a className="btn w sm" href={pathFor(next.code)} style={{ marginLeft: 'auto' }}>{next.startedAt ? 'Join' : 'Open room'}</a></div> : null}
      <div className="lvmini"><b>Lv {lvl.level}</b><div className="xbar"><i style={{ width: lvl.pct + '%' }} /></div><small>{lvl.pct}%</small></div></div>
      <div className="bigring" style={{ '--p': lvl.pct }}><div><small>LEVEL</small><b>{lvl.level}</b><small>{lvl.title} · {lvl.pct}%</small></div></div></section>

    <div className="tiles4">
      <button className="tile t1" onClick={() => startNow('video')}><span className="ti"><I n="video" /></span><span><b>New meeting</b><small>Start now, get a link</small></span></button>
      <button className="tile t2" onClick={() => { location.hash = 'meetings'; setTimeout(() => window.dispatchEvent(new Event('meet:schedule')), 50) }}><span className="ti"><I n="cal" /></span><span><b>Schedule</b><small>Pick a time, share the invite</small></span></button>
      <button className="tile t3" onClick={openRoom}><span className="ti"><I n="door" /></span><span><b>My room</b><small>Your link that never changes</small></span></button>
      <button className="tile t4" onClick={() => nav('earn')}><span className="ti"><I n="wallet" /></span><span><b>Earn</b><small>Paid meetings, members, mentoring</small></span></button>
    </div>

    <ProLocked h={h} nav={nav} />
    <div className="two">
      <section className="card"><div className="ch"><h3>Coming up</h3><a href="#meetings">All meetings</a></div>
        {upcoming.length ? upcoming.slice(0, 5).map((m) => { const d = m.startsAt ? new Date(m.startsAt) : null
          return (<div key={m.code} className="mrow"><div className={'when' + (m.startedAt ? ' live' : '')}>{m.startedAt ? <><b>●</b><small>Live</small></> : d ? <><b>{d.getDate()}</b><small>{d.toLocaleDateString(undefined, { month: 'short' })}</small></> : <><b>–</b><small>Any</small></>}</div>
            <div className="t"><b>{m.title}</b><span>{m.startedAt ? 'Happening now' : d ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : 'Ready when you are'}</span></div>
            <a className="btn sm go" href={pathFor(m.code)}>{m.startedAt ? 'Join' : 'Start'}</a><button className="btn sm hide-sm" onClick={async () => { await copyText(linkFor(m.code)); setToast('Link copied.') }}>Copy link</button></div>) })
          : <p className="dim">Nothing scheduled. Start a meeting or schedule one, and it shows here.</p>}</section>
      <section className="card streak"><div className="flame"><I n="flame" /></div><b className="n">{comm.streak}</b><span className="dim">week{comm.streak === 1 ? '' : 's'} in a row</span>
        <div className="days" aria-label="The last 8 weeks">{h.heat.slice(-8).map((n, i) => <span key={i} title={`${n} meeting${n === 1 ? '' : 's'}`} className={(n ? 'on' : '') + (i === 7 ? ' today' : '')}>{n || ''}</span>)}</div>
        <small className="dim">The last 8 weeks</small>
        <small className="dim">{comm.streak ? 'Host at least once a week to keep it. 4 weeks in a row earns a day of Pro.' : 'Host this week to start a streak.'}</small></section>
    </div>

    <div className="two">
      <section className="card"><div className="ch"><h3>Next steps</h3><small className="dim">{lvl.xp.toLocaleString()} XP</small></div>
        {quests.map((q) => <button key={q.t} className={'quest' + (q.done ? ' done' : '')} onClick={q.done ? undefined : q.go} disabled={q.done}>
          <span className={'qi ' + (q.done ? 'bg-g' : 'bg-b')}><I n={q.done ? 'check' : 'spark'} /></span><span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}><b>{q.t}</b><small>{q.d}</small>{q.pct != null && !q.done ? <div className="qbar"><i style={{ width: q.pct + '%' }} /></div> : null}</span>
          {q.xp ? <span className="xpchip">+{q.xp} XP</span> : null}</button>)}</section>
      <section className="card"><div className="ch"><h3>Spotlight</h3><a href="#leaders">Leaderboard</a></div>
        {winners.length || h.spots.length ? <>{h.spots.map((x) => <a key={'s' + x.handle} className="spot" href={'/meet/h/' + x.handle} style={{ marginBottom: 8 }}><Avatar name={x.name} picture={x.picture} size={54} /><span><b>{x.name}</b><br /><small className="dim">{x.reason}</small></span></a>)}
          {winners.map((w) => <a key={w.label} className="spot" href={'/meet/h/' + w.handle} style={{ marginBottom: 8 }}><Avatar name={w.name} picture={w.picture} size={54} /><span><b>{w.name}</b><br /><small className="dim">{w.label}</small></span></a>)}</>
          : <p className="dim">This month’s top hosts appear here on the 1st. Could it be you?</p>}</section>
    </div>

    {h.dash.news.length ? <section className="card"><div className="ch"><h3>What’s new</h3></div>{h.dash.news.slice(0, 3).map((n) => <div key={n.id} className="newsitem"><b>{n.title}</b>{n.body ? <p>{n.body}</p> : null}<small className="dim">{day(n.at)}</small></div>)}</section> : null}
  </div>)
}
