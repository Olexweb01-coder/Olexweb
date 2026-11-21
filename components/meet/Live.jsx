'use client'
// Live tools inside a meeting (Install D): polls and quizzes, and Q&A for webinars. Everything travels as small messages
// between the people in the room (no server storage). The host's (or a co-host's) device keeps the count and sends the
// current state to anyone who joins late. One vote per person; a quiz shows who got it right, fastest first.
import { useCallback, useEffect, useRef, useState } from 'react'

const enc = (o) => new TextEncoder().encode(JSON.stringify(o))
const rid = () => Math.random().toString(36).slice(2, 10)
const clean = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n)

export function useLive({ roomRef, boss, toast }) {
  const [poll, setPoll] = useState(null), [qa, setQa] = useState([]), [, setTick] = useState(0)
  const votes = useRef(new Map()), pollRef = useRef(null), qaRef = useRef([]), bossRef = useRef(boss), sendT = useRef(0)
  useEffect(() => { bossRef.current = boss }, [boss])
  useEffect(() => { pollRef.current = poll }, [poll])
  useEffect(() => { qaRef.current = qa }, [qa])
  const send = useCallback((topic, o, to) => { const r = roomRef.current; if (r) r.localParticipant.publishData(enc(o), { reliable: true, topic, ...(to ? { destinationIdentities: to } : {}) }).catch(() => {}) }, [roomRef])
  const tally = () => { const p = pollRef.current; if (!p) return []; const c = p.opts.map(() => 0); for (const v of votes.current.values()) if (c[v.i] != null) c[v.i]++; return c }
  const pushTally = useCallback(() => {                                     // at most once a second, so a big room isn't flooded
    clearTimeout(sendT.current)
    sendT.current = setTimeout(() => { const p = pollRef.current; if (!p || p.closed) return; const counts = tally(); setPoll((x) => (x ? { ...x, counts } : x)); send('poll', { t: 'tally', id: p.id, counts }) }, 800)
  }, [send])
  // ---------- messages from others ----------
  const onData = useCallback((topic, m, from) => {
    if (!m || typeof m !== 'object') return
    const fromBoss = from && from.isBoss
    if (topic === 'poll') {
      if (m.t === 'open' && fromBoss && Array.isArray(m.opts)) { votes.current = new Map(); setPoll({ id: m.id, q: clean(m.q, 200), opts: m.opts.slice(0, 6).map((o) => clean(o, 80)), quiz: !!m.quiz, counts: m.opts.map(() => 0), closed: false, mine: null }) }
      if (m.t === 'tally' && fromBoss) setPoll((p) => (p && p.id === m.id ? { ...p, counts: m.counts } : p))
      if (m.t === 'close' && fromBoss) setPoll((p) => (p && p.id === m.id ? { ...p, counts: m.counts, closed: true, answer: m.answer, winners: m.winners || [] } : p))
      if (m.t === 'state' && fromBoss && m.poll) setPoll({ ...m.poll, mine: null })
      if (m.t === 'vote' && bossRef.current) { const p = pollRef.current; if (p && p.id === m.id && !p.closed && Number.isInteger(m.i) && m.i >= 0 && m.i < p.opts.length && !votes.current.has(from.identity)) { votes.current.set(from.identity, { i: m.i, at: Date.now(), name: from.name }); pushTally() } }
    }
    if (topic === 'qa') {
      if (m.t === 'ask') { const text = clean(m.text, 300); if (text) setQa((l) => (l.some((x) => x.id === m.id) || l.length > 300 ? l : [...l, { id: String(m.id).slice(0, 12), text, by: clean(from.name, 40) || 'Someone', who: from.identity, up: [], done: false }])) }
      if (m.t === 'up') setQa((l) => l.map((x) => (x.id === m.id && !x.up.includes(from.identity) ? { ...x, up: [...x.up, from.identity] } : x)))
      if (m.t === 'done' && fromBoss) setQa((l) => l.map((x) => (x.id === m.id ? { ...x, done: true } : x)))
      if (m.t === 'sync' && fromBoss && Array.isArray(m.list)) setQa((l) => (l.length ? l : m.list.slice(0, 300)))
    }
  }, [pushTally])
  // someone joined late: the host's device sends them the poll and questions so far
  const onJoin = useCallback((p) => {
    if (!bossRef.current || !p) return
    const pl = pollRef.current
    if (pl) send('poll', { t: 'state', poll: { ...pl, counts: pl.closed ? pl.counts : tally(), mine: undefined } }, [p.identity])
    if (qaRef.current.length) send('qa', { t: 'sync', list: qaRef.current.slice(-100) }, [p.identity])
  }, [send])
  // ---------- my actions ----------
  const openPoll = (q, opts, quiz, answer) => {
    const id = rid(), o = { t: 'open', id, q: clean(q, 200), opts: opts.map((x) => clean(x, 80)).filter(Boolean).slice(0, 6), quiz: !!quiz }
    if (!o.q || o.opts.length < 2) { toast('Write a question and at least two answers.'); return false }
    votes.current = new Map(); setPoll({ ...o, counts: o.opts.map(() => 0), closed: false, mine: null, answer: quiz ? answer : undefined, own: true }); send('poll', o); return true
  }
  const vote = (i) => {
    const p = pollRef.current; if (!p || p.closed || p.mine != null) return
    setPoll({ ...p, mine: i }); const r = roomRef.current
    if (bossRef.current && r) { votes.current.set(r.localParticipant.identity, { i, at: Date.now(), name: r.localParticipant.name }); pushTally() } else send('poll', { t: 'vote', id: p.id, i })
  }
  const closePoll = () => {
    const p = pollRef.current; if (!p) return
    const counts = tally(), winners = p.quiz && p.answer != null ? [...votes.current.values()].filter((v) => v.i === p.answer).sort((a, b) => a.at - b.at).slice(0, 5).map((v) => v.name || 'Someone') : []
    setPoll({ ...p, counts, closed: true, winners }); send('poll', { t: 'close', id: p.id, counts, answer: p.quiz ? p.answer : undefined, winners })
  }
  const ask = (text) => { const t = clean(text, 300), r = roomRef.current; if (!t || !r) return; const id = rid(); setQa((l) => [...l, { id, text: t, by: r.localParticipant.name || 'You', who: r.localParticipant.identity, up: [], done: false }]); send('qa', { t: 'ask', id, text: t }) }
  const up = (id) => { const r = roomRef.current; if (!r) return; setQa((l) => l.map((x) => (x.id === id && !x.up.includes(r.localParticipant.identity) ? { ...x, up: [...x.up, r.localParticipant.identity] } : x))); send('qa', { t: 'up', id }) }
  const done = (id) => { setQa((l) => l.map((x) => (x.id === id ? { ...x, done: true } : x))); send('qa', { t: 'done', id }) }
  return { poll, setPoll, qa, onData, onJoin, openPoll, vote, closePoll, ask, up, done, bump: () => setTick((t) => t + 1) }
}

// the poll card everyone sees on the stage
export function PollCard({ live, boss }) {
  const p = live.poll; if (!p) return null
  const total = p.counts.reduce((a, b) => a + b, 0), show = p.closed || p.mine != null || boss
  return (<div className="lv-poll" role="dialog" aria-label={p.quiz ? 'Quiz' : 'Poll'}>
    <div className="lv-ph"><b>{p.quiz ? 'Quiz' : 'Poll'}{p.closed ? ' · closed' : ''}</b>{boss || p.closed ? <button className="mt-x" aria-label="Hide" onClick={() => live.setPoll(null)}>×</button> : null}</div>
    <p className="lv-q">{p.q}</p>
    <div className="lv-opts">{p.opts.map((o, i) => { const pct = total ? Math.round((p.counts[i] / total) * 100) : 0, right = p.closed && p.quiz && p.answer === i
      return <button key={i} type="button" className={'lv-opt' + (p.mine === i ? ' mine' : '') + (right ? ' right' : '')} disabled={p.closed || p.mine != null} onClick={() => live.vote(i)}>
        {show ? <i style={{ width: pct + '%' }} /> : null}<span>{o}</span>{show ? <small>{pct}%</small> : null}</button> })}</div>
    <small className="lv-foot">{total} vote{total === 1 ? '' : 's'}{p.closed && p.winners && p.winners.length ? ` · First right: ${p.winners.join(', ')}` : ''}</small>
    {boss && !p.closed ? <button className="mt-btn mt-sm" onClick={live.closePoll}>{p.quiz ? 'Close and show the answer' : 'Close the poll'}</button> : null}
  </div>)
}
// the host's form to start a poll or quiz
export function PollMaker({ live, onClose }) {
  const [q, setQ] = useState(''), [opts, setOpts] = useState(['', '']), [quiz, setQuiz] = useState(false), [answer, setAnswer] = useState(0)
  return (<div className="mt-modal" role="dialog" aria-modal="true" aria-labelledby="lv-h" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
    <form className="mt-card mt-dialog lv-make" onSubmit={(e) => { e.preventDefault(); if (live.openPoll(q, opts, quiz, answer)) onClose() }}>
      <h2 className="mt-h2" id="lv-h">{quiz ? 'Start a quiz' : 'Start a poll'}</h2>
      <div className="mt-seg" role="group" aria-label="Poll or quiz"><button type="button" aria-pressed={!quiz} onClick={() => setQuiz(false)}>Poll</button><button type="button" aria-pressed={quiz} onClick={() => setQuiz(true)}>Quiz</button></div>
      <input className="mt-in" maxLength={200} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Your question" autoFocus />
      {opts.map((o, i) => <div key={i} className="lv-row">{quiz ? <input type="radio" name="lv-ans" checked={answer === i} onChange={() => setAnswer(i)} aria-label={'Correct answer ' + (i + 1)} /> : null}
        <input className="mt-in" maxLength={80} value={o} onChange={(e) => setOpts(opts.map((x, j) => (j === i ? e.target.value : x)))} placeholder={'Answer ' + (i + 1)} />
        {opts.length > 2 ? <button type="button" className="mt-x" aria-label="Remove" onClick={() => { setOpts(opts.filter((_, j) => j !== i)); if (answer >= opts.length - 1) setAnswer(0) }}>×</button> : null}</div>)}
      {opts.length < 6 ? <button type="button" className="mt-link" onClick={() => setOpts([...opts, ''])}>+ Add an answer</button> : null}
      {quiz ? <p className="mt-hint">Tick the right answer. When you close it, everyone sees it and who got it right first.</p> : null}
      <div className="mt-col"><button className="mt-btn mt-go">Start</button><button type="button" className="mt-btn mt-ghost" onClick={onClose}>Cancel</button></div>
    </form></div>)
}
// Q&A (webinars): ask, vote questions up, the host marks them answered
export function QAPanel({ live, boss, myId }) {
  const [t, setT] = useState('')
  const list = [...live.qa].sort((a, b) => (a.done - b.done) || (b.up.length - a.up.length))
  return (<div className="lv-qa">
    <form onSubmit={(e) => { e.preventDefault(); live.ask(t); setT('') }} className="lv-ask"><input className="mt-in" maxLength={300} value={t} onChange={(e) => setT(e.target.value)} placeholder="Ask the speaker a question" /><button className="mt-btn mt-sm mt-go" disabled={!t.trim()}>Ask</button></form>
    {list.length ? <ul>{list.map((x) => <li key={x.id} className={x.done ? 'done' : ''}>
      <div><b>{x.by}</b><p>{x.text}</p></div>
      <div className="lv-qacts"><button className={'lv-up' + (x.up.includes(myId) ? ' on' : '')} disabled={x.up.includes(myId) || x.who === myId} onClick={() => live.up(x.id)} aria-label="Vote this question up">▲ {x.up.length}</button>
        {boss && !x.done ? <button className="mt-link" onClick={() => live.done(x.id)}>Answered</button> : x.done ? <small>Answered</small> : null}</div></li>)}</ul>
      : <p className="mt-hint">No questions yet. Ask one: the most voted rise to the top.</p>}
  </div>)
}
// (its styles are in app/meet/meet.css)
