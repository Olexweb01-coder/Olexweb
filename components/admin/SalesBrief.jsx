'use client'
// Install 19: the pre-call brief, one page: the call, who they are, what they want, their worries, what to ask, what to show,
// the price (from the playbook), how to close, and the whole conversation underneath. "Print" for paper; "Write it again".
import { useState } from 'react'
const lagos = (d) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(d))
const MEET = 'https://meet.olexweb.com/'
export default function SalesBrief({ id, name, brief }) {
  const [B, setB] = useState(brief), [busy, setBusy] = useState(false), [err, setErr] = useState('')
  async function again() {
    setBusy(true); setErr('')
    try { const r = await fetch('/admin/api/sales', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'brief', id }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Try again.'); setB(j.brief) }
    catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const List = ({ title, items }) => items && items.length ? <section className="bf-card"><h2>{title}</h2><ul>{items.map((x, i) => <li key={i}>{x}</li>)}</ul></section> : null
  return (<div className="bf">
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <div className="bf-top"><a href="/admin/sales" className="bf-back">← Sales</a><div className="bf-acts"><button onClick={() => window.print()}>Print</button><button onClick={again} disabled={busy}>{busy ? 'Writing…' : B ? 'Write it again' : 'Write the brief'}</button></div></div>
    {err ? <p className="bf-err" role="alert">{err}</p> : null}
    {!B ? <section className="bf-card"><h1>{name}</h1><p className="bf-dim">No brief yet. It’s written by itself a few minutes after they book, or tap “Write the brief”.</p></section> : <>
      <header className="bf-hero">
        <span className="bf-eye">Call brief</span>
        <h1>{B.company.name}</h1>
        <p className="bf-sum">{B.summary}</p>
        <div className="bf-facts">
          {B.call ? <div><small>The call</small><b>{lagos(B.call.at)}</b><span>Lagos time · 30 minutes</span>{B.call.code ? <a className="bf-join" href={MEET + B.call.code}>Open the call</a> : null}</div> : null}
          {B.contact ? <div><small>With</small><b>{B.contact.name || B.contact.email}</b><span>{B.contact.email}</span></div> : null}
          <div><small>Business</small><b>{[B.company.category, B.company.city].filter(Boolean).join(', ') || '—'}</b>{B.company.website ? <a href={B.company.website} target="_blank" rel="noreferrer">{B.company.website.replace(/^https?:\/\//, '')}</a> : <span>No website</span>}</div>
        </div>
      </header>
      {B.call && B.call.note ? <section className="bf-card bf-note"><h2>What they wrote when booking</h2><p>“{B.call.note}”</p></section> : null}
      <div className="bf-grid">
        <List title="What they want" items={B.wants} />
        <List title="Their worries" items={B.worries} />
        <List title="Ask them" items={B.ask} />
        <List title="Show them" items={B.show} />
      </div>
      <section className="bf-card bf-price"><h2>The price</h2>
        <p><b>{B.level.label}</b> level{B.level.reasons && B.level.reasons.length ? <span className="bf-dim"> · {B.level.reasons.join(', ')}</span> : null}</p>
        {B.offer ? <p className="bf-offer">Suggest: <b>{B.offer.name}</b>, {B.offer.price}{B.offer.care ? <span className="bf-dim"> · care plan {B.offer.care}</span> : null}</p> : null}
        <details><summary>All prices at this level</summary><ul className="bf-prices">{B.prices.map((p) => <li key={p.name}><span>{p.name}</span><b>{p.price}</b></li>)}</ul></details>
      </section>
      <section className="bf-card bf-close"><h2>How to close</h2><p>{B.close}</p><a href="/admin/sales" className="bf-dim">Make the invoice on the Sales screen (Official documents).</a></section>
      {B.signals && B.signals.length ? <section className="bf-card"><h2>What the agent saw on their website</h2><ul>{B.signals.map((s, i) => <li key={i}><b>{s.label}</b>{s.evidence ? <span className="bf-dim"> · {s.evidence}</span> : null}</li>)}</ul></section> : null}
      <section className="bf-card"><h2>The conversation</h2>{B.thread.length ? <ol className="bf-thread">{B.thread.map((m, i) => <li key={i} className={m.who === 'us' ? 'us' : 'them'}><small>{m.who === 'us' ? 'You (the agent)' : 'Them'} · {new Date(m.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</small><p>{m.text}</p></li>)}</ol> : <p className="bf-dim">They booked straight from the first email.</p>}</section>
      {!B.ai ? <p className="bf-dim">The AI was busy, so this brief has the facts only. Tap “Write it again” for the rest.</p> : null}
    </>}
  </div>)
}
const CSS = `
.bf{max-width:860px;margin:0 auto;padding:18px 16px 60px;display:grid;gap:14px}
.bf-top{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.bf-back{color:var(--dim);text-decoration:none;font-weight:700}
.bf-acts{display:flex;gap:8px}.bf-acts button{min-height:44px;padding:0 18px;border-radius:999px;border:1px solid var(--line);background:var(--raise2);font-weight:800;cursor:pointer}.bf-acts button:last-child{background:var(--green);color:var(--ink);border:0}
.bf-hero{border-radius:24px;padding:22px;display:grid;gap:12px;background:linear-gradient(150deg,rgba(143,227,106,.18),rgba(143,227,106,.04));border:1px solid rgba(143,227,106,.35)}
.bf-eye{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--green)}
.bf h1{margin:0;font-family:var(--display);font-size:clamp(28px,6vw,40px);font-weight:900;font-stretch:88%;line-height:1.05}
.bf-sum{margin:0;font-size:17px;line-height:1.5;max-width:62ch}
.bf-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}.bf-facts div{display:grid;gap:2px;align-content:start;background:rgba(10,11,10,.35);border-radius:16px;padding:12px 14px;min-width:0}
.bf-facts small,.bf-card h2{font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);margin:0}
.bf-facts b{font-size:16px}.bf-facts span,.bf-facts a{font-size:14px;color:var(--dim);overflow-wrap:anywhere}.bf-facts a.bf-join{margin-top:6px;justify-self:start;background:var(--green);color:var(--ink);padding:8px 14px;border-radius:999px;font-weight:800;text-decoration:none}
.bf-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}
.bf-card{background:var(--raise);border:1px solid var(--line);border-radius:22px;padding:18px;display:grid;gap:10px;min-width:0}
.bf-card ul{margin:0;padding-left:18px;display:grid;gap:6px;line-height:1.5}.bf-card p{margin:0;line-height:1.55}
.bf-note p{font-size:16px}.bf-price .bf-offer{font-size:17px}.bf-close p{font-size:16px}
.bf-prices{list-style:none;padding:0!important;margin-top:8px!important}.bf-prices li{display:flex;justify-content:space-between;gap:12px;border-top:1px solid var(--line);padding-top:6px}
details summary{cursor:pointer;color:var(--dim);font-weight:700}
.bf-dim{color:var(--dim);font-size:14px}.bf-err{color:var(--bad);margin:0}
.bf-thread{list-style:none;margin:0;padding:0;display:grid;gap:10px}.bf-thread li{border-radius:16px;padding:12px 14px;background:var(--raise2);max-width:92%}.bf-thread li.us{justify-self:end;background:rgba(143,227,106,.1)}
.bf-thread small{color:var(--dim);font-weight:700}.bf-thread p{white-space:pre-wrap;overflow-wrap:anywhere;margin:4px 0 0;font-size:14.5px}
@media print{.bf-top{display:none}.bf{color:#000}.bf-card,.bf-hero{border:1px solid #ccc;background:#fff}.bf-thread li{background:#f4f4f4}}
`
