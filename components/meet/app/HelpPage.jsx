'use client'
// Help (Olex AI first, then the Olexweb team) and Settings (plan, payments, invoices, look, account). Install 58.
import { useState } from 'react'
import { I } from './icons'
import { api, naira, day, when, Field, Empty, Sheet } from './ui'
import { PRO_LIST } from './ProLock'
import { InstallButton } from './Install'

export default function HelpPage({ ctx }) {
  const { h, setToast, reload } = ctx
  const [help, setHelp] = useState({ q: '', a: null, solved: false, phone: '', sent: false }), [busy, setBusy] = useState('')
  async function ask(e) {
    e.preventDefault(); if (!help.q.trim()) return; setBusy('help')
    try { const r = await api('/api/meet/dash', { action: 'help', question: help.q }); setHelp({ ...help, a: r.answer, solved: r.solved }) } catch (x) { setToast(x.message) } finally { setBusy('') }
  }
  async function toTeam() {
    setBusy('ticket')
    try { await api('/api/meet/dash', { action: 'ticket', question: help.q, aiAnswer: help.a || '', phone: help.phone || (h && h.dash.phone) || '' }); setHelp({ ...help, sent: true }); reload() } catch (x) { setToast(x.message) } finally { setBusy('') }
  }
  const tickets = h ? h.dash.tickets : []
  return (<div className="wrap">
    <div className="pghead"><div><h1>Help</h1><p className="dim">Olex AI answers straight away. If it can’t solve it, the Olexweb team replies here and by email.</p></div></div>
    <section className="card">{help.sent ? <p className="okmsg">Sent to the Olexweb team. You’ll get the reply here and by email{help.phone ? ' or WhatsApp' : ''}.</p>
      : <form className="stack" onSubmit={ask}>
        <Field label="What do you need help with?"><textarea className="in" rows={3} maxLength={1000} value={help.q} onChange={(e) => setHelp({ ...help, q: e.target.value, a: null })} placeholder="For example: how do I record only the sound?" /></Field>
        {help.a ? <div className="answer"><b>Olex AI</b><p>{help.a}</p></div> : null}
        {help.a && !help.solved ? <Field label="Your WhatsApp number (optional, for a faster reply)"><input className="in" type="tel" inputMode="tel" maxLength={30} value={help.phone} onChange={(e) => setHelp({ ...help, phone: e.target.value })} placeholder="+234 801 234 5678" /></Field> : null}
        <div className="row-btns">{!help.a ? <button className="btn go" disabled={busy === 'help'}>{busy === 'help' ? 'Thinking…' : 'Ask'}</button> : null}
          {help.a ? <button type="button" className={'btn' + (help.solved ? '' : ' go')} disabled={busy === 'ticket'} onClick={toTeam}>{busy === 'ticket' ? 'Sending…' : help.solved ? 'Still stuck? Send to the team' : 'Send to the Olexweb team'}</button> : null}</div>
      </form>}</section>
    <section className="card"><div className="ch"><h3>Your requests</h3></div>{tickets.length ? tickets.map((t) => <div key={t.id} className="ticket"><small className="dim">{day(t.at)} · {t.status === 'open' ? 'Waiting for a reply' : t.status === 'replied' ? 'Replied' : 'Closed'}</small><p>{t.question}</p>{t.reply ? <p className="reply"><b>Olexweb:</b> {t.reply}</p> : null}</div>)
      : <Empty icon="help" title="No requests">Questions you send to the team show here with their replies.</Empty>}</section>
    <section className="card"><div className="ch"><h3>Rules and policies</h3></div><div className="row-btns"><a className="btn sm" href="/meet/legal/earnings">Earnings and payouts</a><a className="btn sm" href="/meet/legal/refunds">Refunds</a><a className="btn sm" href="/meet/legal/community">Community rules</a><a className="btn sm" href="https://olexweb.com/terms">Terms</a><a className="btn sm" href="https://olexweb.com/privacy">Privacy</a></div></section>
  </div>)
}

export function SettingsPage({ ctx }) {
  const { h, setToast, reload, theme, toggleTheme, signOut, user, list = [], nav } = ctx
  const [busy, setBusy] = useState(''), [choose, setChoose] = useState(null), [one, setOne] = useState(false)   // one: choosing the meeting for Pro for one meeting (Install 61)
  if (!h) return <div className="wrap" />
  const d = h.dash, p = d.pricing, due = d.invoices.filter((i) => !i.paid)
  async function pay(body, via) {
    if (!via && d.payOptions.length > 1) { setChoose(body); return }
    setChoose(null); setBusy(body.kind + (body.invoiceId || ''))
    try { const r = await api('/api/meet/dash', { action: 'pay', ...body, via: via || d.payOptions[0].id }); if (r.url) location.assign(r.url); else { await reload(); setBusy('') } } catch (e) { setToast(e.message); setBusy('') }
  }
  async function claim(ref) { setBusy('claim' + ref); try { await api('/api/meet/dash', { action: 'claim', ref }); await reload() } catch (e) { setToast(e.message) } finally { setBusy('') } }
  return (<div className="wrap">
    <div className="pghead"><div><h1>Settings</h1><p className="dim">{user.email || ''}</p></div></div>
    <section className="card"><div className="ch"><h3>Your plan</h3></div>
      <div className="plan"><b className="big">{d.plan.pro ? 'Pro' : 'Free'}</b><p className="dim">{d.plan.owner ? 'Everything, always.' : d.plan.pro ? `Pro until ${day(d.plan.proUntil)}.` : 'Unlimited hours, audio and video up to 100 people, MP3 recording, AI notes, screen sharing.'}</p></div>
      {p.on && !d.plan.pro && d.payReady ? <div className="row-btns"><button className="btn go" disabled={!!busy} onClick={() => pay({ kind: 'month' })}>{busy === 'month' ? 'Opening…' : `Pro ${naira(p.prices.month)}/month`}</button><button className="btn" disabled={!!busy} onClick={() => pay({ kind: 'year' })}>{busy === 'year' ? 'Opening…' : `${naira(p.prices.year)}/year`}</button>
        <button className="btn" disabled={!!busy} onClick={() => setOne(true)}>{busy === 'meeting' ? 'Opening…' : `Pro for one meeting ${naira(p.prices.meeting)}`}</button></div> : null}
      {d.plan.pro && !d.plan.owner ? <p className="dim sm">Pro doesn’t renew by itself and your card is never charged again without you. It simply ends on {day(d.plan.proUntil)}, so there’s nothing to cancel. Pay again any time to add more time.</p> : null}
      {p.on && !d.plan.pro ? <ul className="plist">{PRO_LIST.map((x) => <li key={x}><I n="lock" /><s>{x}</s></li>)}</ul> : null}
      {p.on && !d.plan.pro ? <p className="dim sm">Your Free plan keeps everything you use now. Only need Pro once? Pro for one meeting is {naira(p.prices.meeting)}, paid once, for a meeting you choose.</p> : null}
      {choose ? <div className="row-btns"><span className="dim">How would you like to pay?</span>{d.payOptions.map((o) => <button key={o.id} className="btn sm go" onClick={() => pay(choose, o.id)}>{o.name}</button>)}<button className="btn sm quiet" onClick={() => setChoose(null)}>Cancel</button></div> : null}</section>
    {d.transfers.length || due.length ? <section className="card"><div className="ch"><h3>Payments due</h3></div>
      {d.transfers.map((t) => <div key={t.ref} className="due"><span><b>Bank transfer: {naira(t.amount)}</b>{t.bank ? <> to <b>{t.bank.accountNumber}</b> · {t.bank.accountName}{t.bank.bankName ? ' · ' + t.bank.bankName : ''}</> : null}. Use <b>{t.ref}</b> as the narration.{t.bank && t.bank.note ? ' ' + t.bank.note : ''}{t.claimed ? ' Olexweb is checking it.' : ''}</span>
        {!t.claimed ? <button className="btn go sm" disabled={!!busy} onClick={() => claim(t.ref)}>{busy === 'claim' + t.ref ? 'Sending…' : 'I’ve sent it'}</button> : null}</div>)}
      {due.map((i) => <div key={i.id} className="due"><span><b>Invoice: {naira(i.amount)}</b> for “{i.title}”: {i.people} extra {i.people === 1 ? 'person' : 'people'} past the free 100. New meetings wait until it’s paid.</span>
        {d.payReady ? <button className="btn go sm" disabled={!!busy} onClick={() => pay({ kind: 'invoice', invoiceId: i.id })}>{busy === 'invoice' + i.id ? 'Opening…' : 'Pay now'}</button> : null}</div>)}</section> : null}
    <section className="card"><div className="ch"><h3>Look</h3></div><div className="row-btns"><button className="btn" onClick={toggleTheme}><I n="sun" />{theme === 'dark' ? 'Switch to light' : 'Switch to dark'}</button>
      <InstallButton big /></div></section>
    <section className="card"><div className="ch"><h3>Account</h3></div><div className="row-btns">{user.role === 'owner' ? <a className="btn" href="https://olexweb.com/admin">Open the admin</a> : null}<button className="btn quiet" onClick={signOut}>Sign out</button></div></section>
      {one ? <Sheet title="Pro for one meeting" onClose={() => setOne(false)}><OneMeeting list={list} price={p.prices.meeting} onPick={(code) => { setOne(false); pay({ kind: 'meeting', code }) }} onSchedule={() => { setOne(false); nav('meetings'); setTimeout(() => window.dispatchEvent(new Event('meet:schedule')), 50) }} /></Sheet> : null}
  </div>)
}

// Install 61: which meeting gets Pro. Only their own meetings that haven't ended and don't have Pro yet.
function OneMeeting({ list, price, onPick, onSchedule }) {
  const open = list.filter((m) => !m.endedAt && !m.pro)
  return (<div className="one-pick">
    <p className="dim" style={{ marginTop: 0 }}>{naira(price)}, paid once. That meeting gets video recording, certificates, email reminders and AI notes emailed to guests. No subscription.</p>
    {open.length ? <div className="one-list">{open.map((m) => <button key={m.code} className="opt" onClick={() => onPick(m.code)}><span><b>{m.title}</b><br /><small className="dim">{m.startedAt ? 'Happening now' : m.startsAt ? when(m.startsAt) : 'Not started yet'}</small></span><span className="btn sm go">Choose</span></button>)}</div>
      : <><p>You have no upcoming meetings yet. Schedule one, then come back here to give it Pro.</p><button className="btn go" onClick={onSchedule}>Schedule a meeting</button></>}
  </div>)
}
