'use client'
// Leaderboard (Install 58): this month's leaders on each board, a podium, where you stand, and how to move up.
import { useEffect, useState } from 'react'
import { I } from './icons'
import { api, Avatar, Empty } from './ui'

const BOARDS = [['hours', 'Most hours', ' h'], ['biggest', 'Biggest meeting', ' people'], ['rated', 'Best rated', '★'], ['loved', 'Most 5-star reviews', '']]
export default function LeadersPage({ ctx }) {
  const { h, nav } = ctx
  const [lb, setLb] = useState(null), [k, setK] = useState('hours')
  useEffect(() => { api('/api/meet/community?board=10').then((c) => setLb(c.leaderboard)).catch(() => setLb(h ? h.community.leaderboard : null)) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const rows = (lb && lb[k]) || [], unit = BOARDS.find((b) => b[0] === k)[2], me = h ? h.me : null
  const month = new Date().toLocaleDateString(undefined, { month: 'long' })
  const pod = [rows[1], rows[0], rows[2]]
  return (<div className="wrap">
    <section className="lbhero"><h1 style={{ fontSize: 'clamp(24px,3.4vw,34px)' }}>{month} leaderboard</h1><p style={{ margin: '6px 0 0', opacity: .8 }}>Top hosts on the 1st get 3 days of Pro, a badge and the spotlight.</p>
      <div className="tabs">{BOARDS.map(([id, l]) => <button key={id} className={k === id ? 'on' : ''} aria-pressed={k === id} onClick={() => setK(id)}>{l}</button>)}</div>
      {rows.length ? <div className="podium">{pod.map((x, i) => x ? <div key={x.handle} className={'pd ' + ['second', 'first', 'third'][i]}>{i === 1 ? <I n="trophy" className="i crown" /> : null}<Avatar name={x.name} picture={x.picture} size={i === 1 ? 78 : 58} />
        <b>{x.name}</b><small>{x.value}{unit}</small><div className="stand">{[2, 1, 3][i]}</div></div> : <div key={i} />)}</div> : <div style={{ paddingBottom: 22 }}><p style={{ opacity: .8 }}>No leaders yet this month. Host a meeting to be the first.</p></div>}</section>
    {h && h.rank ? <div className="nudge"><span className="ni bg-y"><I n="trophy" /></span><div><b>You’re #{h.rank.rank} for hours this month</b><br /><small className="dim">{h.rank.gap ? `${h.rank.gap} more hour${h.rank.gap === 1 ? '' : 's'} passes the person above you.` : 'You’re at the top. Keep it up.'}</small></div></div>
      : me && !me.public ? <div className="nudge"><span className="ni bg-b"><I n="user" /></span><div style={{ flex: 1 }}><b>You’re not on the leaderboard</b><br /><small className="dim">Only public profiles appear. Turn yours on to take part.</small></div><button className="btn sm go" onClick={() => nav('profile')}>Edit profile</button></div> : null}
    <section className="card">{rows.length ? rows.map((x, i) => <a key={x.handle} href={'/meet/h/' + x.handle} className={'lbrow' + (me && x.handle === me.handle ? ' me' : '')}><span className="rk">{i + 1}</span><Avatar name={x.name} picture={x.picture} size={40} /><b>{x.name}</b><span className="v">{x.value}{unit}</span></a>)
      : <Empty icon="trophy" title="The board is empty">Be the first this month.</Empty>}</section>
    <p className="dim sm">Only people who turned on their public profile appear here. Numbers are counted by Olexweb Meet.</p>
  </div>)
}
