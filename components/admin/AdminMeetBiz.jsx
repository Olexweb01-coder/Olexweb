'use client'
// Admin → Meetings → Business (Install B): the pricing switch and prices, announcements for every Meet user, support
// requests Olex AI couldn't solve (reply by email and in their dashboard, or open WhatsApp), invoices, and gifting Pro.
import { useEffect, useState } from 'react'

const naira = (n) => '₦' + Math.round(n || 0).toLocaleString('en-NG')
const when = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')
async function act(body) {
  const r = await fetch('/admin/api/meetings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'That didn’t work.')
  return j
}
const wa = (phone, text) => 'https://wa.me/' + String(phone || '').replace(/[^\d]/g, '').replace(/^0/, '234') + '?text=' + encodeURIComponent(text)

export default function AdminMeetBiz() {
  const [d, setD] = useState(null), [err, setErr] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState('')
  const [bank, setBank] = useState(null), [prices, setPrices] = useState(null), [news, setNews] = useState({ title: '', body: '' }), [replies, setReplies] = useState({}), [gift, setGift] = useState({ email: '', days: 30 })
  async function load() { try { const j = await act({ action: 'biz' }); setD(j); setPrices(j.pricing.prices); setBank((b) => b || { on: false, bankName: '', accountName: '', accountNumber: '', note: '', ...j.bank }) } catch (e) { setErr(e.message) } }
  useEffect(() => { load() }, [])
  async function run(key, body, done) {
    setBusy(key); setErr(''); setMsg('')
    try { const j = await act(body); if (done) setMsg(typeof done === 'function' ? done(j) : done); await load(); return true } catch (e) { setErr(e.message); return false } finally { setBusy('') }
  }
  if (!d) return <section className="mg-box"><p className="mg-dim">{err || 'Loading…'}</p></section>
  const open = d.tickets.filter((t) => t.status === 'open'), due = d.invoices.filter((i) => !i.paid_at)
  return (<div className="mb">
    {err ? <p className="mb-err" role="alert">{err}</p> : null}{msg ? <p className="mb-ok" role="status">{msg}</p> : null}

    <section className="mg-box">
      <div className="mb-row"><h2>Pricing</h2><button className={'btn ' + (d.pricing.on ? '' : 'btn-green')} disabled={!!busy} onClick={() => run('sw', { action: 'pricing', on: !d.pricing.on, prices }, d.pricing.on ? 'Pricing is off: everything is free again.' : 'Pricing is on.')}>{busy === 'sw' ? '…' : d.pricing.on ? 'Turn pricing off' : 'Turn pricing on'}</button></div>
      <p className="mg-dim">{d.pricing.on ? 'On: the plans show on the Meet home page, video recording and past meetings beyond the last 3 are Pro, and hosts can let more than 100 people in for a fee.' : 'Off: everything in Meet is free and nobody sees prices. Turning it on changes the Meet home page and the paid features at once; turning it off puts everything back.'}
        {!d.payReady && !(d.bank && d.bank.on) ? ' To take payments, add PAYSTACK_SECRET_KEY in Vercel or turn on bank transfer below.' : ''}</p>
      <div className="mb-prices">{[['month', 'Pro a month'], ['year', 'Pro a year'], ['meeting', 'Pro for one meeting'], ['extra', 'Each extra person, per 30 minutes']].map(([k, l]) =>
        <label key={k}><span className="mg-lab">{l} (₦)</span><input className="input" type="number" min={10} value={prices[k]} onChange={(e) => setPrices({ ...prices, [k]: e.target.value })} /></label>)}</div>
      <button className="btn btn-line" disabled={!!busy} onClick={() => run('pr', { action: 'pricing', on: d.pricing.on, prices }, 'Prices saved.')}>Save prices</button>
      <p className="mg-dim">This month: {naira(d.month.total)} from {d.month.n} payment{d.month.n === 1 ? '' : 's'} · {d.proUsers} on Pro.</p>
    </section>

    <section className="mg-box">
      <div className="mb-row"><h2>Bank transfer</h2><span className="mg-dim">{bank.on ? 'On' : 'Off'}</span></div>
      <p className="mg-dim">A way to pay that you control, for when Paystack isn’t set up or isn’t working. People see these details, send the money, tap “I’ve sent it”, and you confirm here after checking your bank. More payment platforms can be added later the same way as Paystack.</p>
      <div className="mb-prices">{[['bankName', 'Bank'], ['accountName', 'Account name'], ['accountNumber', 'Account number']].map(([k, l]) =>
        <label key={k}><span className="mg-lab">{l}</span><input className="input" inputMode={k === 'accountNumber' ? 'numeric' : undefined} value={bank[k] || ''} onChange={(e) => setBank({ ...bank, [k]: e.target.value })} /></label>)}</div>
      <input className="input" maxLength={300} value={bank.note || ''} onChange={(e) => setBank({ ...bank, note: e.target.value })} placeholder="A note for payers (optional), e.g. Confirmed within a few hours" />
      <div className="mb-acts"><button className={'btn ' + (bank.on ? 'btn-line' : 'btn-green')} disabled={!!busy} onClick={() => run('bk', { action: 'bank', ...bank, on: !bank.on }, bank.on ? 'Bank transfer is off.' : 'Bank transfer is on.').then((ok) => ok && setBank({ ...bank, on: !bank.on }))}>{bank.on ? 'Turn off' : 'Save and turn on'}</button>
        {bank.on ? <button className="btn btn-line" disabled={!!busy} onClick={() => run('bs', { action: 'bank', ...bank }, 'Saved.')}>Save changes</button> : null}</div>
      {d.transfers.length ? <ul className="mb-list">{d.transfers.map((t) => <li key={t.id}><span><b>{naira(t.amount)}</b> · ref <b>{t.ref}</b> · {t.name || t.email || 'Meet user'} · {t.kind} · {when(t.created_at)} · {t.status === 'claimed' ? 'says it’s sent' : 'not sent yet'}</span>
        <span className="mb-acts"><button className="btn btn-green" disabled={!!busy} onClick={() => run('t' + t.id, { action: 'transfer', id: t.id, yes: true }, 'Confirmed. It’s applied and they’ve been told.')}>Received</button><button className="btn btn-line" disabled={!!busy} onClick={() => run('x' + t.id, { action: 'transfer', id: t.id, yes: false }, 'Declined. They’ve been told.')}>Not received</button></span></li>)}</ul> : null}
    </section>

    <section className="mg-box" id="business">
      <h2>Support requests {open.length ? <span className="mb-pill">{open.length} waiting</span> : null}</h2>
      {d.tickets.length ? d.tickets.map((t) => <div key={t.id} className={'mb-ticket' + (t.status === 'open' ? ' open' : '')}>
        <div className="mb-row"><b>{t.name || 'Meet user'}</b><small className="mg-dim">{when(t.created_at)} · {t.status}</small></div>
        <p>{t.question}</p>
        {t.ai_answer ? <p className="mg-dim">Olex AI said: {t.ai_answer}</p> : null}
        {t.reply ? <p className="mb-reply">You replied: {t.reply}</p> : null}
        {t.status !== 'closed' ? <>
          <textarea className="input" rows={2} value={replies[t.id] || ''} onChange={(e) => setReplies({ ...replies, [t.id]: e.target.value })} placeholder="Your reply (goes to their dashboard and email)" />
          <div className="mb-acts">
            <button className="btn btn-green" disabled={!!busy || !(replies[t.id] || '').trim()} onClick={() => run('r' + t.id, { action: 'ticket-reply', id: t.id, reply: replies[t.id] }, (j) => j.emailed ? 'Reply sent by email and in their dashboard.' : 'Reply is in their dashboard (email didn’t go).')}>Send reply</button>
            {t.phone ? <a className="btn btn-line" href={wa(t.phone, `Hi${t.name ? ' ' + t.name.split(' ')[0] : ''}, this is Olaitan from Olexweb Meet about your question: “${t.question.slice(0, 120)}”\n\n${replies[t.id] || ''}`)} target="_blank" rel="noopener">WhatsApp {t.phone}</a> : null}
            {t.email ? <a className="btn btn-line" href={`mailto:${t.email}`}>Email</a> : null}
            <button className="btn btn-line" disabled={!!busy} onClick={() => run('c' + t.id, { action: 'ticket-close', id: t.id })}>Close</button>
          </div></> : null}
      </div>) : <p className="mg-dim">No requests yet. Olex AI answers the simple ones itself.</p>}
    </section>

    <section className="mg-box">
      <h2>Invoices {due.length ? <span className="mb-pill">{due.length} unpaid</span> : null}</h2>
      {d.invoices.length ? <ul className="mb-list">{d.invoices.map((i) => <li key={i.id}><span><b>{naira(i.amount)}</b> · {i.title} · {i.name || i.email || 'host'} · {i.people} extra people · {when(i.created_at)}</span>
        {i.paid_at ? <small className="mg-dim">Paid ({i.paid_how})</small> : <button className="btn btn-line" disabled={!!busy} onClick={() => run('i' + i.id, { action: 'invoice-paid', id: i.id }, 'Marked as paid. They can start meetings again.')}>Mark as paid</button>}</li>)}</ul>
        : <p className="mg-dim">No invoices. They appear when a meeting goes past 100 people with pricing on.</p>}
    </section>

    <section className="mg-box">
      <h2>Announcements</h2>
      <p className="mg-dim">Shows in every Meet user’s dashboard under “What’s new”.</p>
      <input className="input" maxLength={120} value={news.title} onChange={(e) => setNews({ ...news, title: e.target.value })} placeholder="Title, e.g. Audio calls are here" />
      <textarea className="input" rows={3} maxLength={2000} value={news.body} onChange={(e) => setNews({ ...news, body: e.target.value })} placeholder="A few lines about it" />
      <button className="btn btn-green" disabled={!!busy || !news.title.trim()} onClick={() => run('n', { action: 'news', ...news }, 'Posted.').then((ok) => ok && setNews({ title: '', body: '' }))}>Post</button>
      {d.news.length ? <ul className="mb-list">{d.news.map((n) => <li key={n.id}><span><b>{n.title}</b> · {when(n.created_at)}</span><button className="btn btn-line" disabled={!!busy} onClick={() => run('nd' + n.id, { action: 'news-delete', id: n.id })}>Delete</button></li>)}</ul> : null}
    </section>

    <section className="mg-box">
      <h2>Give Pro</h2>
      <p className="mg-dim">A gift or a thank-you: type an email, or <b>all</b> for every Meet account.</p>
      <div className="mb-prices"><label><span className="mg-lab">Email (or all)</span><input className="input" value={gift.email} onChange={(e) => setGift({ ...gift, email: e.target.value })} /></label>
        <label><span className="mg-lab">Days</span><input className="input" type="number" min={1} value={gift.days} onChange={(e) => setGift({ ...gift, days: e.target.value })} /></label></div>
      <button className="btn btn-line" disabled={!!busy || !gift.email.trim()} onClick={() => run('g', { action: 'give-pro', ...gift }, (j) => `Pro given to ${j.people} account${j.people === 1 ? '' : 's'}. They were told in their dashboard.`)}>Give Pro</button>
    </section>
    <style dangerouslySetInnerHTML={{ __html: `.mb{display:grid;gap:16px}.mb h2{margin:0 0 8px;display:flex;align-items:center;gap:10px}.mb-row{display:flex;align-items:center;justify-content:space-between;gap:10px}
.mb-prices{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:10px 0}.mb-prices label{display:grid;gap:4px}
.mb-pill{font-size:12px;padding:3px 9px;border-radius:999px;background:rgba(239,122,106,.15);color:#ef7a6a}
.mb-ticket{display:grid;gap:6px;padding:12px;border:1px solid var(--line);border-radius:12px;margin-bottom:8px}.mb-ticket.open{border-color:rgba(240,179,94,.5)}.mb-ticket p{margin:0}
.mb-reply{color:var(--green)}.mb-acts{display:flex;flex-wrap:wrap;gap:8px}.mb-list{list-style:none;padding:0;margin:8px 0 0;display:grid;gap:8px}
.mb-list li{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px;border:1px solid var(--line);border-radius:10px}.mb-err{color:#ef7a6a}.mb-ok{color:var(--green)}
.mb input.input,.mb textarea.input{width:100%;box-sizing:border-box;margin-bottom:8px}` }} />
  </div>)
}
