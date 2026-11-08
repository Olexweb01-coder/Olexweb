'use client'
// An official Olexweb document (Install 18): a rate card or an invoice, on paper-white for printing, with the brand at the top.
// "Save as PDF" uses the browser's own print dialog.
const SYM = { USD: '$', GBP: '£', EUR: '€' }
const money = (n, cur) => (SYM[cur] || '') + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const day = (d) => d ? new Date(d + (d.length === 10 ? 'T12:00:00Z' : '')).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''

export default function DocPage({ d }) {
  const D = d.data || {}, inv = d.kind === 'invoice'
  return (<main className="od">
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <div className="od-bar"><button onClick={() => window.print()}>Save as PDF</button></div>
    <article className="od-sheet">
      <header className="od-head">
        <div className="od-brand"><img className="od-mark" src="/studio/mark.png" alt="" width="35" height="40" /><div><b>Olexweb</b><small>Websites, web apps and the systems behind them</small></div></div>
        <div className="od-title"><h1>{inv ? 'Invoice' : 'Rate card'}</h1><span>{d.number}</span></div>
      </header>
      <section className="od-meta">
        {inv ? <>
          <div><small>Billed to</small><b>{D.client.name}</b>{D.client.company ? <span>{D.client.company}</span> : null}{D.client.email ? <span>{D.client.email}</span> : null}{D.client.address ? <span>{D.client.address}</span> : null}</div>
          <div><small>From</small><b>Olexweb · {D.from && D.from.name}</b>{D.from && D.from.address ? <span>{D.from.address}</span> : null}<span>info@olexweb.com · olexweb.com</span></div>
          <div><small>Issued</small><b>{day(D.issued)}</b><small>Due</small><b>{day(D.due)}</b></div>
        </> : <>
          <div><small>Prepared for</small><b>{D.client || 'You'}</b><span>Level: {D.tierLabel} · prices in {D.currency}</span></div>
          <div><small>Valid until</small><b>{day(D.validUntil)}</b><span>Olaitan Adebayo · info@olexweb.com · olexweb.com</span></div>
        </>}
      </section>
      {inv ? <>
        <table className="od-table"><thead><tr><th>Item</th><th>Qty</th><th>Amount</th><th>Total</th></tr></thead>
          <tbody>{D.items.map((x, i) => <tr key={i}><td>{x.desc}</td><td>{x.qty}</td><td>{money(x.amount, D.currency)}</td><td>{money(x.qty * x.amount, D.currency)}</td></tr>)}</tbody>
          <tfoot><tr><td colSpan={3}>Total due</td><td>{money(D.total, D.currency)}</td></tr></tfoot></table>
        <section className="od-bank"><h2>How to pay</h2><p>By bank transfer, quoting <b>{d.number}</b> as the reference.</p>
          <dl>{[['Account name', D.bank.account_name], ['Bank', D.bank.bank_name], ['Account number', D.bank.account_number], ['Sort code', D.bank.sort_code], ['IBAN', D.bank.iban], ['SWIFT / BIC', D.bank.swift]].filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          {D.bank.notes ? <p className="od-note">{D.bank.notes}</p> : null}</section>
        {D.notes ? <p className="od-note">{D.notes}</p> : null}
      </> : <>
        <p className="od-lede">{D.positioning}</p>
        <div className="od-rates">{D.items.map((x) => <div key={x.key} className="od-rate"><div><b>{x.name}</b><p>{x.what}</p></div><div className="od-price"><b>{x.price}</b><small>{x.time}</small></div></div>)}</div>
        <section className="od-proof"><h2>Recent work</h2><ul>{(D.proof || []).map((p) => <li key={p}>{p}</li>)}</ul></section>
        <p className="od-note">Every project is quoted after a short call, from these prices. Bigger or unusual builds are priced to fit. Payment is by bank transfer.</p>
      </>}
      <footer className="od-foot"><span>Olexweb · Olaitan Adebayo</span><span>olexweb.com · info@olexweb.com</span></footer>
    </article>
  </main>)
}
const CSS = `
.od{min-height:100vh;background:#e9e6df;padding:24px 16px 48px;font-family:var(--font-mona),system-ui,sans-serif;color:#0a0b0a}
.od-bar{max-width:820px;margin:0 auto 14px;display:flex;justify-content:flex-end}.od-bar button{min-height:44px;padding:0 20px;border-radius:999px;border:0;background:#0a0b0a;color:#f2efe9;font:800 15px inherit;cursor:pointer}
.od-sheet{max-width:820px;margin:0 auto;background:#fff;border-radius:18px;padding:clamp(22px,5vw,56px);box-shadow:0 30px 60px -40px rgba(0,0,0,.35);display:grid;gap:28px}
.od-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;padding-bottom:22px;border-bottom:2px solid #0a0b0a}
.od-brand{display:flex;gap:12px;align-items:center}.od-brand b{display:block;font-family:var(--font-hubot),system-ui;font-weight:900;font-size:26px;letter-spacing:-.02em}.od-brand small{color:rgba(10,11,10,.6);font-size:13px}
.od-mark{width:35px;height:40px;object-fit:contain;flex:none}
.od-title{text-align:right}.od-title h1{margin:0;font-family:var(--font-hubot),system-ui;font-weight:900;font-size:clamp(30px,6vw,44px);line-height:1}.od-title span{color:rgba(10,11,10,.6);font-weight:700}
.od-meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:18px}.od-meta div{display:grid;gap:3px;align-content:start}.od-meta small{font-size:11.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:rgba(10,11,10,.5)}
.od-meta b{font-size:16px}.od-meta span{font-size:14px;color:rgba(10,11,10,.7)}
.od-table{width:100%;border-collapse:collapse;font-size:15px}.od-table th{text-align:left;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:rgba(10,11,10,.55);padding:10px 8px;border-bottom:1px solid rgba(10,11,10,.15)}
.od-table td{padding:14px 8px;border-bottom:1px solid rgba(10,11,10,.08)}.od-table td:not(:first-child),.od-table th:not(:first-child){text-align:right;white-space:nowrap}
.od-table tfoot td{font-weight:900;font-size:18px;border:0;padding-top:18px}
.od-bank{background:#f4f2ec;border-radius:14px;padding:18px}.od-bank h2,.od-proof h2{margin:0 0 6px;font-size:16px}.od-bank p{margin:0 0 10px;font-size:14.5px}
.od-bank dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin:0}.od-bank dt{font-size:11.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:rgba(10,11,10,.5)}.od-bank dd{margin:2px 0 0;font-weight:800;font-size:15.5px}
.od-lede{margin:0;font-size:17px;line-height:1.55;max-width:60ch}
.od-rates{display:grid;gap:10px}.od-rate{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;padding:16px;border-radius:14px;border:1px solid rgba(10,11,10,.1)}
.od-rate b{font-size:16.5px}.od-rate p{margin:4px 0 0;font-size:14px;line-height:1.45;color:rgba(10,11,10,.7)}.od-price{text-align:right;display:grid;align-content:start;gap:2px}.od-price b{font-size:17px;white-space:nowrap}.od-price small{color:rgba(10,11,10,.55);font-size:12.5px}
.od-proof ul{margin:0;padding-left:18px;font-size:14px;line-height:1.6;color:rgba(10,11,10,.75)}
.od-note{margin:0;font-size:13.5px;color:rgba(10,11,10,.65);line-height:1.5}
.od-foot{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;padding-top:18px;border-top:1px solid rgba(10,11,10,.12);font-size:13px;color:rgba(10,11,10,.6)}
@media (max-width:560px){.od-rate{grid-template-columns:1fr}.od-price{text-align:left}.od-title{text-align:left}}
@media print{.od{background:#fff;padding:0}.od-bar{display:none}.od-sheet{box-shadow:none;border-radius:0;padding:0;max-width:none}}
`
