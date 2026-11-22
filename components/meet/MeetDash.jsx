'use client'
// A Meet account's dashboard (Install B): plan, numbers, notices (with a bell), announcements, invoices, and help
// (Olex AI answers first; what it can't solve goes to the Olexweb team as a request). Old and new accounts alike.
import { useEffect, useState } from 'react'

const naira = (n) => '₦' + Math.round(n).toLocaleString('en-NG')
const day = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
async function post(body) {
  const r = await fetch('/api/meet/dash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'That didn’t work. Try again.')
  return j
}
export default function MeetDash({ user }) {
  const [d, setD] = useState(null), [err, setErr] = useState(''), [bell, setBell] = useState(false), [busy, setBusy] = useState(''), [paidMsg, setPaidMsg] = useState('')
  const [help, setHelp] = useState(null)                                    // null | { q, a, solved, phone, sent }
  async function load() { try { const r = await fetch('/api/meet/dash', { cache: 'no-store', credentials: 'same-origin' }); if (r.ok) setD(await r.json()) } catch {} }
  useEffect(() => {
    load()
    const p = new URLSearchParams(location.search).get('paid')
    if (p) { setPaidMsg(p === '1' ? 'Payment received. Thank you!' : 'The payment didn’t go through. Nothing was charged.'); history.replaceState(null, '', location.pathname + '#dashboard') }
  }, [])
  const [choose, setChoose] = useState(null)                                // more than one way to pay: they pick
  async function pay(body, via) {
    if (!via && d.payOptions.length > 1) { setChoose(body); return }
    setChoose(null); setBusy(body.kind + (body.invoiceId || '')); setErr('')
    try { const r = await post({ action: 'pay', ...body, via: via || d.payOptions[0].id }); if (r.url) location.assign(r.url); else { await load(); setBusy('') } } catch (e) { setErr(e.message); setBusy('') }
  }
  async function claim(ref) { setBusy('claim' + ref); try { await post({ action: 'claim', ref }); await load() } catch (e) { setErr(e.message) } finally { setBusy('') } }
  async function openBell() { setBell((b) => !b); if (d && d.unread) { await post({ action: 'read' }).catch(() => {}); setD({ ...d, unread: 0 }) } }
  async function ask(e) {
    e.preventDefault(); if (!help.q.trim()) return
    setBusy('help'); setErr('')
    try { const r = await post({ action: 'help', question: help.q }); setHelp({ ...help, a: r.answer, solved: r.solved }) } catch (x) { setErr(x.message) } finally { setBusy('') }
  }
  async function toTeam() {
    setBusy('ticket'); setErr('')
    try { await post({ action: 'ticket', question: help.q, aiAnswer: help.a || '', phone: help.phone || '' }); setHelp({ ...help, sent: true }); load() } catch (x) { setErr(x.message) } finally { setBusy('') }
  }
  if (!d) return null
  const p = d.pricing, due = d.invoices.filter((i) => !i.paid), s = d.stats
  return (<section className="md" id="dashboard" aria-label="Your dashboard">
    <div className="md-head">
      <h2>Hi {user.name ? user.name.split(' ')[0] : 'there'}</h2>
      <span className="md-bellwrap">
        <button className="md-bell" aria-expanded={bell} aria-label={d.unread ? `${d.unread} new notifications` : 'Notifications'} onClick={openBell}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2.2 2.2 0 0 0 4 0" /></svg>{d.unread ? <i>{d.unread > 9 ? '9+' : d.unread}</i> : null}</button>
        {bell ? <div className="md-pop" role="dialog" aria-label="Notifications">{d.notices.length ? d.notices.map((n) => <div key={n.id} className={'md-note' + (n.read ? '' : ' new')}><b>{n.title}</b>{n.body ? <p>{n.body}</p> : null}<small>{day(n.at)}</small></div>) : <p className="md-dim">Nothing yet.</p>}</div> : null}
      </span>
    </div>
    {paidMsg ? <p className="md-ok" role="status">{paidMsg}</p> : null}
    {err ? <p className="md-err" role="alert">{err}</p> : null}
    {choose ? <div className="md-due md-choose"><span><b>How would you like to pay?</b></span><div className="md-acts">{d.payOptions.map((o) => <button key={o.id} className="mh-btn mh-sm mh-go" onClick={() => pay(choose, o.id)}>{o.name}</button>)}<button className="mh-btn mh-sm mh-quiet" onClick={() => setChoose(null)}>Cancel</button></div></div> : null}
    {d.transfers.map((t) => <div key={t.ref} className="md-due md-bank"><span><b>Bank transfer: {naira(t.amount)}</b>{t.bank ? <> to <b>{t.bank.accountNumber}</b> · {t.bank.accountName}{t.bank.bankName ? ' · ' + t.bank.bankName : ''}</> : null}. Use <b>{t.ref}</b> as the narration.{t.bank && t.bank.note ? ' ' + t.bank.note : ''}
      {t.claimed ? ' Olexweb is checking it; you’ll be told here once it’s confirmed.' : ''}</span>
      {!t.claimed ? <button className="mh-btn mh-go mh-sm" disabled={!!busy} onClick={() => claim(t.ref)}>{busy === 'claim' + t.ref ? 'Sending…' : 'I’ve sent it'}</button> : null}</div>)}
    {due.map((i) => <div key={i.id} className="md-due"><span><b>Invoice: {naira(i.amount)}</b> for “{i.title}”: {i.people} extra {i.people === 1 ? 'person' : 'people'} past the free 100. New meetings wait until it’s paid.</span>
      {d.payReady ? <button className="mh-btn mh-go mh-sm" disabled={!!busy} onClick={() => pay({ kind: 'invoice', invoiceId: i.id })}>{busy === 'invoice' + i.id ? 'Opening…' : 'Pay now'}</button> : null}</div>)}

    <div className="md-grid">
      <div className="md-card md-plan">
        <span className="md-lab">Your plan</span>
        <b>{d.plan.pro ? 'Pro' : 'Free'}</b>
        <small>{d.plan.owner ? 'Everything, always.' : d.plan.pro ? `Until ${day(d.plan.proUntil)}` : 'Unlimited hours, audio and video up to 100 people, MP3 recording, AI notes, screen sharing.'}</small>
        {p.on && !d.plan.pro && d.payReady ? <div className="md-acts">
          <button className="mh-btn mh-go mh-sm" disabled={!!busy} onClick={() => pay({ kind: 'month' })}>{busy === 'month' ? 'Opening…' : `Pro ${naira(p.prices.month)}/month`}</button>
          <button className="mh-btn mh-sm" disabled={!!busy} onClick={() => pay({ kind: 'year' })}>{busy === 'year' ? 'Opening…' : `${naira(p.prices.year)}/year`}</button>
        </div> : null}
        {p.on && !d.plan.pro ? <small className="md-dim">Only need it once? Get Pro for a single meeting ({naira(p.prices.meeting)}) from inside the meeting.</small> : null}
      </div>
      <div className="md-card"><span className="md-lab">Meetings hosted</span><b>{s.meetings}</b><small>{s.people} joins</small></div>
      <div className="md-card"><span className="md-lab">Hours hosted</span><b>{Math.round((s.minutes / 60) * 10) / 10}</b><small>No time limit</small></div>
      <div className="md-card"><span className="md-lab">Rating</span><b>{s.rating ? '★ ' + s.rating : '–'}</b><small>{s.ratings ? `${s.ratings} rating${s.ratings === 1 ? '' : 's'} from guests` : 'Guests can rate after a meeting'}</small></div>
    </div>

    {d.news.length ? <div className="md-news"><span className="md-lab">What’s new</span>{d.news.slice(0, 3).map((n) => <div key={n.id} className="md-newsitem"><b>{n.title}</b>{n.body ? <p>{n.body}</p> : null}<small>{day(n.at)}</small></div>)}</div> : null}

    <Community />
    {p.on ? <Earn /> : null}

    <div className="md-help">
      {!help ? <button className="mh-btn mh-sm" onClick={() => setHelp({ q: '', phone: d.phone })}>Need help? Ask Olex AI</button>
        : help.sent ? <p className="md-ok">Sent to the Olexweb team. You’ll get the reply here and by email{help.phone ? ' or WhatsApp' : ''}.</p>
        : <form onSubmit={ask} className="md-ask">
          <label className="md-lab" htmlFor="md-q">What do you need help with?</label>
          <textarea id="md-q" className="md-in" rows={3} maxLength={1000} value={help.q} onChange={(e) => setHelp({ ...help, q: e.target.value, a: null })} placeholder="For example: how do I record only the sound?" />
          {help.a ? <div className="md-answer"><b>Olex AI</b><p>{help.a}</p></div> : null}
          {help.a && !help.solved ? <><label className="md-lab" htmlFor="md-ph">Your WhatsApp number (optional, for a faster reply)</label><input id="md-ph" className="md-in" type="tel" inputMode="tel" maxLength={30} value={help.phone || ''} onChange={(e) => setHelp({ ...help, phone: e.target.value })} placeholder="+234 801 234 5678" /></> : null}
          <div className="md-acts">
            {!help.a ? <button className="mh-btn mh-go mh-sm" disabled={busy === 'help'}>{busy === 'help' ? 'Thinking…' : 'Ask'}</button> : null}
            {help.a ? <button type="button" className={'mh-btn mh-sm' + (help.solved ? '' : ' mh-go')} disabled={busy === 'ticket'} onClick={toTeam}>{busy === 'ticket' ? 'Sending…' : help.solved ? 'Still stuck? Send to the team' : 'Send to the Olexweb team'}</button> : null}
            <button type="button" className="mh-btn mh-sm mh-quiet" onClick={() => setHelp(null)}>Close</button>
          </div>
        </form>}
      {d.tickets.length ? <div className="md-tickets">{d.tickets.slice(0, 3).map((t) => <div key={t.id} className="md-ticket"><small>{day(t.at)} · {t.status === 'open' ? 'Waiting for a reply' : t.status === 'replied' ? 'Replied' : 'Closed'}</small><p>{t.question}</p>{t.reply ? <p className="md-reply"><b>Olexweb:</b> {t.reply}</p> : null}</div>)}</div> : null}
    </div>
  </section>)
}

// the plans, shown on the Meet home only while pricing is on
export function MeetPricing({ pricing }) {
  if (!pricing || !pricing.on) return null
  const p = pricing.prices
  return (<section className="md-pricing" aria-labelledby="md-pr-h">
    <h2 id="md-pr-h">Free for real. Pro when you need more.</h2>
    <div className="md-plans">
      <div className="md-planbox md-free"><b>Free</b><strong>₦0</strong><ul><li>Unlimited hours</li><li>Audio and video meetings, up to 100 people</li><li>Free MP3 recordings</li><li>AI meeting notes</li><li>Screen sharing, chat, reactions</li></ul></div>
      <div className="md-planbox md-pro"><b>Pro</b><strong>{naira(p.month)}<small>/month</small></strong><span>or {naira(p.year)} a year, or {naira(p.meeting)} for one meeting</span><ul><li>Everything in Free</li><li>Video recording</li><li>All your past meetings and transcripts</li><li>More Pro tools coming</li></ul></div>
      <div className="md-planbox"><b>Big meetings</b><strong>{naira(p.extra)}<small>/person</small></strong><span>for every 30 minutes, only past 100 people</span><ul><li>The host chooses to let more in</li><li>Up to 500 people</li><li>One invoice when the meeting ends</li></ul></div>
    </div>
  </section>)
}

// achievements, streak, this month, invite link, public profile and the leaderboard (Install C)
function Community() {
  const [c, setC] = useState(null), [edit, setEdit] = useState(null), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  async function load() { try { const r = await fetch('/api/meet/community', { cache: 'no-store', credentials: 'same-origin' }); if (r.ok) setC(await r.json()) } catch {} }
  useEffect(() => { load() }, [])
  if (!c) return null
  const month = new Date(c.recap.month + '-01T12:00:00Z').toLocaleDateString(undefined, { month: 'long' })
  const recapText = `My ${month} on Olexweb Meet: ${c.recap.meetings} meeting${c.recap.meetings === 1 ? '' : 's'}, ${c.recap.people} people${c.recap.rating ? `, ${c.recap.rating}★` : ''}.${c.streak >= 2 ? ` ${c.streak} weeks in a row 🔥` : ''} Free audio and video meetings, no time limit: ${c.invite}`
  async function share(text) { try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); setMsg('Copied.') } } catch {} }
  async function save(e) {
    e.preventDefault(); setBusy(true); setMsg('')
    try { const r = await fetch('/api/meet/community', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action: 'profile', ...edit }) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'That didn’t work.'); setEdit(null); setMsg('Profile saved.'); load() }
    catch (x) { setMsg(x.message) } finally { setBusy(false) }
  }
  const top = (k) => (c.leaderboard[k] || [])[0]
  return (<div className="mc">
    <div className="mc-row"><span className="md-lab">Your {month}</span>{c.streak ? <b>{c.streak} week{c.streak === 1 ? '' : 's'} in a row 🔥</b> : <small className="md-dim">Host this week to start a streak</small>}</div>
    <div className="mc-row"><span>{c.recap.meetings} meetings · {c.recap.people} people{c.recap.rating ? ` · ${c.recap.rating}★` : ''}</span><button className="mh-btn mh-sm" onClick={() => share(recapText)}>Share my month</button></div>
    <div><span className="md-lab">Badges ({c.badges.filter((b) => b.earned).length} of {c.badges.length}) · every 5 badges = a month of Pro</span>
      <div className="pf-badges" style={{ marginTop: 8 }}>{c.badges.map((b) => <span key={b.id} className={'pf-badge' + (b.earned ? '' : ' off')} title={b.desc}>{b.earned ? '🏅' : '🔒'} {b.name}</span>)}</div></div>
    <div><span className="md-lab">Invite friends: when they host their first meeting, you both get a month of Pro</span>
      <div className="mc-invite" style={{ marginTop: 8 }}><input className="md-in" readOnly value={c.invite} onFocus={(e) => e.target.select()} /><button className="mh-btn mh-sm mh-go" onClick={() => share(`Free audio and video meetings with no time limit. Join me on Olexweb Meet: ${c.invite}`)}>Share invite</button></div></div>
    <div className="mc-row"><span><span className="md-lab">This month’s leaders</span><br /><small className="md-dim">{top('hours') ? `Most hours: ${top('hours').name}` : 'No leaders yet this month'}{top('rated') ? ` · Best rated: ${top('rated').name}` : ''}</small></span><a className="mh-btn mh-sm" href="/meet/leaders">Leaderboard</a></div>
    {!edit ? <div className="mc-row"><span><span className="md-lab">Public profile</span><br /><small className="md-dim">{c.public && c.handle ? <>Shown at <a href={'/meet/h/' + c.handle}>/meet/h/{c.handle}</a> · {c.followers} follower{c.followers === 1 ? '' : 's'}</> : 'Off: you’re not on the leaderboard and nobody can follow you.'}</small></span>
      <button className="mh-btn mh-sm" onClick={() => setEdit({ handle: c.handle, bio: c.bio, public: c.public })}>Edit</button></div>
      : <form onSubmit={save} className="md-ask">
        <label className="md-lab" htmlFor="mc-h">Profile name (your address: /meet/h/name)</label><input id="mc-h" className="md-in" maxLength={30} value={edit.handle} onChange={(e) => setEdit({ ...edit, handle: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} placeholder="e.g. ada-teaches" />
        <label className="md-lab" htmlFor="mc-b">About you (optional)</label><textarea id="mc-b" className="md-in" rows={2} maxLength={300} value={edit.bio} onChange={(e) => setEdit({ ...edit, bio: e.target.value })} />
        <label className="mt-consent"><input type="checkbox" checked={edit.public} onChange={(e) => setEdit({ ...edit, public: e.target.checked })} /><span>Show me publicly: my profile, ratings and reviews, the leaderboard, and people can follow me.</span></label>
        <div className="md-acts"><button className="mh-btn mh-go mh-sm" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button><button type="button" className="mh-btn mh-sm mh-quiet" onClick={() => setEdit(null)}>Cancel</button></div>
      </form>}
    {msg ? <small className="md-dim">{msg}</small> : null}
  </div>)
}

// earning on Meet (Install D): your bank, one-on-one sessions people book, and what you've sold
function Earn() {
  const [e, setE] = useState(null), [banks, setBanks] = useState(null), [pay, setPay] = useState(null), [bk, setBk] = useState(null), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  const call = async (body) => { const r = await fetch('/api/meet/earn', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'That didn’t work.'); return j }
  async function load() { try { const r = await fetch('/api/meet/earn', { cache: 'no-store', credentials: 'same-origin' }); if (r.ok) setE(await r.json()) } catch {} }
  useEffect(() => { load() }, [])
  async function run(fn, ok) { setBusy(true); setMsg(''); try { await fn(); setMsg(ok); await load(); return true } catch (x) { setMsg(x.message); return false } finally { setBusy(false) } }
  async function openPay() { setPay({ bankCode: '', accountNumber: '' }); if (!banks) { try { setBanks((await call({ action: 'banks' })).banks) } catch (x) { setMsg(x.message) } } }
  if (!e) return null
  const D = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [7, 'Sun']]
  return (<div className="mc">
    <div className="mc-row"><span className="md-lab">Earn on Meet · paid meetings and one-on-one sessions · Olexweb keeps {e.fee}%</span>{e.sales_n ? <b>{naira(e.net)} earned</b> : null}</div>
    {!pay ? <div className="mc-row"><span>{e.payout ? <>Payouts go to <b>{e.payout.accountName}</b> · {e.payout.bankName} ••{e.payout.last4}</> : 'Add your bank so ticket and session money reaches you.'}</span><button className="mh-btn mh-sm" onClick={openPay}>{e.payout ? 'Change bank' : 'Add my bank'}</button></div>
      : <form className="md-ask" onSubmit={(x) => { x.preventDefault(); run(() => call({ action: 'payout', ...pay }), 'Bank saved.').then((k) => k && setPay(null)) }}>
        <label className="md-lab" htmlFor="ea-b">Bank</label><select id="ea-b" className="md-in" value={pay.bankCode} onChange={(x) => setPay({ ...pay, bankCode: x.target.value })}><option value="">{banks ? 'Choose your bank' : 'Loading banks…'}</option>{(banks || []).map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}</select>
        <label className="md-lab" htmlFor="ea-n">Account number</label><input id="ea-n" className="md-in" inputMode="numeric" maxLength={10} value={pay.accountNumber} onChange={(x) => setPay({ ...pay, accountNumber: x.target.value.replace(/\D/g, '') })} />
        <div className="md-acts"><button className="mh-btn mh-go mh-sm" disabled={busy}>{busy ? 'Checking…' : 'Save'}</button><button type="button" className="mh-btn mh-sm mh-quiet" onClick={() => setPay(null)}>Cancel</button></div></form>}
    {!bk ? <div className="mc-row"><span>{e.booking.on ? <>One-on-one sessions are open: <a href={'/meet/h/' + e.handle + '/book'}>your booking page</a></> : 'One-on-one sessions (mentorship): let people book and pay for your time.'}</span><button className="mh-btn mh-sm" onClick={() => setBk({ ...e.booking })}>{e.booking.on ? 'Change' : 'Set up'}</button></div>
      : <form className="md-ask" onSubmit={(x) => { x.preventDefault(); run(() => call({ action: 'booking', ...bk }), 'Saved.').then((k) => k && setBk(null)) }}>
        <label className="md-lab" htmlFor="ea-t">What people book</label><input id="ea-t" className="md-in" maxLength={80} value={bk.title} onChange={(x) => setBk({ ...bk, title: x.target.value })} />
        <span className="md-lab">Days</span><div className="md-acts">{D.map(([d, l]) => <button key={d} type="button" className={'mh-btn mh-sm' + (bk.days.includes(d) ? ' mh-go' : '')} onClick={() => setBk({ ...bk, days: bk.days.includes(d) ? bk.days.filter((y) => y !== d) : [...bk.days, d] })}>{l}</button>)}</div>
        <div className="md-acts"><label className="md-lab">From <input className="md-in" type="time" value={bk.from} onChange={(x) => setBk({ ...bk, from: x.target.value })} /></label><label className="md-lab">To <input className="md-in" type="time" value={bk.to} onChange={(x) => setBk({ ...bk, to: x.target.value })} /></label>
          <label className="md-lab">Session <select className="md-in" value={bk.minutes} onChange={(x) => setBk({ ...bk, minutes: Number(x.target.value) })}>{[15, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}</select></label>
          <label className="md-lab">Price (₦, 0 = free) <input className="md-in" type="number" min={0} value={bk.price} onChange={(x) => setBk({ ...bk, price: x.target.value })} /></label></div>
        <small className="md-dim">Times are Lagos time. Booked sessions become private, encrypted meetings in your list.</small>
        <label className="mt-consent"><input type="checkbox" checked={!!bk.on} onChange={(x) => setBk({ ...bk, on: x.target.checked })} /><span>Open my booking page</span></label>
        <div className="md-acts"><button className="mh-btn mh-go mh-sm" disabled={busy}>Save</button><button type="button" className="mh-btn mh-sm mh-quiet" onClick={() => setBk(null)}>Cancel</button></div></form>}
    {e.upcoming.length ? <div><span className="md-lab">Coming sessions</span><ul className="pf-list" style={{ marginTop: 6 }}>{e.upcoming.map((u) => <li key={u.code}><b>{u.name}</b><span>{new Date(u.at).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span></li>)}</ul></div> : null}
    {msg ? <small className="md-dim">{msg}</small> : null}
  </div>)
}
