'use client'
// Admin → Olexweb Meet → Money and payouts (Install 58b): your Paystack balance, what's set aside for people (invite
// and ambassador rewards they earned), what's yours, every payout sent, and what Meet earned. No need to open Paystack.
import { useEffect, useState } from 'react'

const k = (x) => (x == null ? '–' : '₦' + (x / 100).toLocaleString('en-NG', { minimumFractionDigits: x % 100 ? 2 : 0, maximumFractionDigits: 2 }))
const KIND = { month: 'Pro, monthly', year: 'Pro, yearly', meeting: 'Pro for one meeting', invoice: 'Extra people (invoices)' }
async function act(body) {
  const r = await fetch('/admin/api/meetings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'That didn’t work.'); return j
}
function Prize({ now, done }) {
  const [v, setV] = useState(String(now ?? 5000)), [m, setM] = useState('')
  return (<div className="mm-row"><label className="mg-dim">Prize (₦) <input className="mg-in" style={{ width: 130 }} type="number" min={0} value={v} onChange={(e) => setV(e.target.value)} /></label>
    <button className="btn" onClick={async () => { try { await act({ action: 'ambassador-prize', naira: Number(v) }); setM('Saved.'); done() } catch (e) { setM(e.message) } }}>Save</button>{m ? <span className="mg-dim">{m}</span> : null}</div>)
}
// Install 58h: the Paystack collection limit while the business is a Starter business (before CAC)
function Limit({ l, done }) {
  const [v, setV] = useState(String(l.limit / 100)), [m, setM] = useState('')
  const save = async (body) => { try { await act({ action: 'ps-limit', ...body }); setM('Saved.'); done() } catch (e) { setM(e.message) } }
  if (l.registered) return (<section className="mg-box"><h2>Paystack limit</h2>
    <p>{l.auto ? 'Your Paystack account looks upgraded: more than the limit has come in and payments kept going through. ' : ''}Registered business: no collection limit. {k(l.collected)} collected so far.</p>
    <button className="btn" onClick={() => save({ registered: false })}>It’s not upgraded yet</button>{m ? <span className="mg-dim"> {m}</span> : null}</section>)
  const tone = l.hit || l.pct >= 90 ? '#e5533d' : l.pct >= 75 ? '#e9a23b' : '#3aa655'
  return (<section className="mg-box"><h2>Paystack limit</h2>
    <p className="mg-dim">Until your CAC registration is done, Paystack limits how much the account can collect. Every payment through your account is counted here, hosts’ sales too, since they pass through your account before they are split.</p>
    <div style={{ height: 12, borderRadius: 99, background: 'rgba(127,127,127,.2)', overflow: 'hidden', margin: '10px 0 6px' }}><div style={{ width: l.pct + '%', height: '100%', background: tone }} /></div>
    <p><b>{k(l.collected)}</b> of {k(l.limit)} collected ({l.pct}%) · {k(Math.max(0, l.limit - l.collected))} left</p>
    {l.hit ? <p className="mm-warn">Paystack refused a payment because of the limit ({new Date(l.hit).toLocaleString()}). Payments are paused until you upgrade: Paystack → Compliance → Profile → Business Type → Registered business.</p>
      : l.pct >= 75 ? <p className="mm-warn">You’ve used {l.pct}% of the limit. Upgrade soon so payments don’t pause: Paystack → Compliance → Profile → Business Type.</p> : null}
    <p className="mg-dim" style={{ fontSize: 13 }}>When you upgrade, this notices by itself once more than the limit has come in. You can also tell it now.</p>
    <div className="mm-row"><label className="mg-dim">Limit shown on Paystack (₦) <input className="mg-in" style={{ width: 150 }} type="number" min={100000} value={v} onChange={(e) => setV(e.target.value)} /></label>
      <button className="btn" onClick={() => save({ naira: Number(v) })}>Save</button><button className="btn" onClick={() => save({ registered: true })}>I’ve upgraded</button>{m ? <span className="mg-dim">{m}</span> : null}</div></section>)
}
export default function AdminMeetMoney() {
  const [d, setD] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [msg, setMsg] = useState('')
  const load = () => act({ action: 'money' }).then(setD, (e) => setErr(e.message))
  useEffect(() => { load() }, [])
  async function sendNow() {
    if (!confirm('Send everything that’s waiting now (only what your balance covers)?')) return
    setBusy(true); setMsg('')
    try { const r = await act({ action: 'payouts-now' }); setMsg(r.short ? `Sent ${r.sent}. ${k(r.short)} more is needed in your balance for the rest.` : `Sent ${r.sent}.`); load() } catch (e) { setMsg(e.message) } finally { setBusy(false) }
  }
  if (err) return <section className="mg-box"><p className="mg-dim">{err}</p></section>
  if (!d) return <section className="mg-box"><p className="mg-dim">Loading…</p></section>
  const i = d.income
  return (<>
    <section className="mg-box">
      <h2>Your money</h2>
      <div className="mm-grid">
        <div className="mc-kpi"><span>Paystack balance</span><b>{d.balance == null ? 'Not connected' : k(d.balance)}</b><small className="mg-dim">Right now, from Paystack</small></div>
        <div className="mc-kpi"><span>Set aside for people</span><b>{k(d.owed + d.owedFees)}</b><small className="mg-dim">{k(d.owed)} owed to {d.owedPeople} {d.owedPeople === 1 ? 'person' : 'people'} + {k(d.owedFees)} transfer fees</small></div>
        <div className="mc-kpi"><span>Yours</span><b className="mm-yours">{k(d.yours)}</b><small className="mg-dim">Balance minus what’s set aside</small></div>
      </div>
      {d.short ? <p className="mm-warn">Your balance is {k(d.short)} short of what people have earned. Nobody is half-paid: they wait until the balance covers them. Don’t withdraw until it does.</p>
        : <p className="mg-dim">Everyone who has earned a reward is covered. Only “Yours” is free to withdraw.</p>}
      <p className="mg-dim" style={{ fontSize: 13 }}>Hosts’ sales never pass through this balance: Paystack pays them straight to their banks. Rewards are only created from money Olexweb really received (30% of a real Pro payment from someone they invited; the ambassador prize from what invitees really paid), so they can’t put you at a loss.</p>
      <div className="mm-row"><button className="btn" disabled={busy || !d.owed} onClick={sendNow}>{busy ? 'Sending…' : 'Send what’s waiting now'}</button><span className="mg-dim">Otherwise it goes out on Monday, only what the balance covers. {k(d.min)} minimum per person.</span></div>
      {msg ? <p>{msg}</p> : null}
    </section>
    {d.limit ? <Limit l={d.limit} done={load} /> : null}
    <section className="mg-box">
      <h2>Ambassador of the month</h2>
      <p className="mg-dim">A fixed cash prize for the top inviter each month. It’s paid only when what Meet kept from their invitees that month is at least twice the prize, so it can never cost you more than half of what they brought in. Otherwise they get a week of Pro.</p>
      <Prize now={d.prize} done={load} />
    </section>
    <section className="mg-box">
      <h2>What Meet earned</h2>
      <div className="mm-grid">
        <div className="mc-kpi"><span>Plans (Pro, invoices)</span><b>{k(i.plans)}</b><small className="mg-dim">{k(i.plansMonth)} this month</small></div>
        <div className="mc-kpi"><span>Your share of hosts’ sales</span><b>{k(i.shares)}</b><small className="mg-dim">{k(i.sharesMonth)} this month</small></div>
        <div className="mc-kpi"><span>Rewards paid out</span><b>{k(i.paidOut)}</b><small className="mg-dim">Referral commission and ambassador</small></div>
      </div>
      {i.byKind.length ? <ul className="mc-list">{i.byKind.map((x) => <li key={x.kind}><span>{KIND[x.kind] || x.kind}</span><small className="mg-dim">{x.n} · {k(x.kobo)}</small></li>)}</ul> : null}
    </section>
    <section className="mg-box">
      <h2>Waiting to be paid</h2>
      {d.waiting.length ? <ul className="mc-list">{d.waiting.map((w, n) => <li key={n}><span><b>{w.name || w.email}</b>{w.bank ? '' : ' · no bank yet'}</span><small className="mg-dim">{k(w.kobo)}</small></li>)}</ul> : <p className="mg-dim">Nobody is waiting.</p>}
    </section>
    <section className="mg-box">
      <h2>Payouts sent</h2>
      {d.sent.length ? <ul className="mc-list">{d.sent.map((s) => <li key={s.ref}><span><b>{s.name || s.email}</b> · {s.at ? new Date(s.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span><small className="mg-dim">{k(s.kobo)} · {s.ref}</small></li>)}</ul> : <p className="mg-dim">No payouts yet.</p>}
    </section>
    <style>{'.mm-grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));margin:10px 0}.mm-yours{color:var(--green,#8fe36a)}.mm-warn{padding:10px 14px;border-radius:12px;background:rgba(239,122,106,.12);border:1px solid rgba(239,122,106,.35)}.mm-row{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:10px}'}</style>
  </>)
}

// Install 58i: what is connected on the live server, and what each piece unlocks (never shows a key)
export function AdminMeetSetup() {
  const [d, setD] = useState(null), [err, setErr] = useState('')
  useEffect(() => { act({ action: 'setup' }).then((r) => setD(r.items), (e) => setErr(e.message)) }, [])
  if (err) return <section className="mg-box"><p className="mg-dim">{err}</p></section>
  if (!d) return <section className="mg-box"><p className="mg-dim">Checking…</p></section>
  const off = d.filter((x) => !x.ok), must = off.filter((x) => x.need)
  return (<section className="mg-box"><h2>Setup check</h2>
    <p className={must.length ? 'mm-warn' : 'mg-dim'}>{must.length ? `${must.length} needed piece${must.length === 1 ? ' is' : 's are'} missing: ${must.map((x) => x.label).join(', ')}.` : off.length ? `Everything needed is connected. ${off.length} optional piece${off.length === 1 ? ' is' : 's are'} off.` : 'Everything is connected.'}</p>
    {[...new Set(d.map((x) => x.group))].map((g) => <div key={g}><h3 style={{ margin: '18px 0 6px', fontSize: 15 }}>{g}</h3><ul className="mc-list">{d.filter((x) => x.group === g).map((x) => (
      <li key={x.label} style={{ alignItems: 'flex-start' }}><span><b style={{ color: x.ok ? '#3aa655' : x.need ? '#e5533d' : '#c98a1b' }}>{x.ok ? '✓ ' : x.need ? '✗ ' : '○ '}</b><b>{x.label}</b><br /><small className="mg-dim">{x.unlocks}</small>{x.ok ? null : <><br /><small className="mg-dim">To turn on: {x.how}</small></>}</span><small className="mg-dim">{x.ok ? 'On' : x.need ? 'Needed' : 'Off'}</small></li>))}</ul></div>)}
  </section>)
}
