'use client'
// Admin → Sales, the simple view (Install 18): is the agent working, where the leads stand, who's worth your time (with the
// agent's read: level, offer, price), and official documents (rate card, invoice) in one tap. The detailed view is one tap away.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from './ui'
import { SIMPLE_CSS } from './AutomationSimple'
import { YS_CSS } from './YouTubeSimple'
import { showDetails } from './SimpleSwitch'

const FLAG = { GB: 'UK', US: 'US', FR: 'France' }
const CUR = { GB: 'GBP', US: 'USD', FR: 'EUR' }
const STATUS = { qualified: 'Ready to email', drafted: 'Email written', contacted: 'Emailed', replied: 'Talking', booked: 'Call booked', nurture: 'Later (kept warm)' }
const KIND_NAME = (k) => ({ dentist: 'dentists', clinic: 'clinics', salon: 'salons', trades: 'trades', law: 'law firms', accounting: 'accountants', consulting: 'consultants', restaurant: 'restaurants', cafe: 'cafés', shop: 'shops', agency: 'agencies' })[k] || k
const when = (d) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(d))

async function post(body) {
  const r = await fetch('/admin/api/sales', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })
  if (r.status === 401) { window.location.assign('/admin/login'); return null }
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'That didn’t work. Try again.'); return j
}

export default function SalesSimple({ data }) {
  const router = useRouter(), D = data, [busy, setBusy] = useState(''), [doc, setDoc] = useState(null)
  const [rc, setRc] = useState({ country: 'US', tier: 'starter', client: '' })
  const [inv, setInv] = useState({ name: '', email: '', company: '', desc: '', amount: '', currency: 'USD', dueDays: 7 })
  const [bank, setBank] = useState(D.bank || { account_name: '', bank_name: '', account_number: '', swift: '', iban: '', sort_code: '', notes: '' })
  async function act(key, body, ok, keep) {
    setBusy(key)
    try { const j = await post(body); if (j) { toast(typeof ok === 'function' ? ok(j) : ok); if (keep) keep(j); router.refresh() } }
    catch (e) { toast(e.message === 'Failed to fetch' ? 'No connection. Try again.' : e.message) } finally { setBusy('') }
  }
  const working = D.enabled && !D.blocked && !D.paused
  const state = D.paused ? 'needs' : working ? 'ok' : D.enabled ? 'low' : 'off'
  const title = D.paused ? 'The agent paused itself.' : working ? 'The agent is working.' : D.enabled ? 'The agent is on, but can’t send yet.' : 'The agent is off.'
  const sub = D.paused || (working ? `${D.sentToday} of ${D.capToday} emails sent today. ${D.autoSend ? 'It sends without asking you.' : 'Each email waits for your OK.'}` : D.blocked || 'Turn it on below.')
  const toggleCountry = (c) => { const next = D.countries.includes(c) ? D.countries.filter((x) => x !== c) : [...D.countries, c]; act('c' + c, { action: 'countries', list: next }, `${FLAG[c]} ${D.countries.includes(c) ? 'off' : 'on'}.`) }
  const field = (o, set, k, label, type = 'text', props = {}) => <label className="ss-f"><span>{label}</span><input className="input" type={type} value={o[k] ?? ''} onChange={(e) => set({ ...o, [k]: e.target.value })} {...props} /></label>
  return (<div className="sm">
    <h1 className="d" style={{ margin: 0 }}>Sales</h1>
    <section className={'sm-hero sm-' + state} aria-label="Status">
      <div className="sm-hrow"><div className="sm-big" aria-hidden="true">{state === 'ok' ? '✓' : state === 'off' ? '–' : '!'}</div>
        <div><b className="sm-t">{title}</b><span className="sm-s">{sub}</span></div></div>
      <div className="ss-stages">{D.stages.map((s) => <div key={s.key} className="sm-chip"><b>{s.n}</b>{s.label}</div>)}</div>
    </section>

    {(D.needs || []).length ? <section className="sm-card ss-needs" aria-label="Needs you">
      <h2>Needs you</h2>
      <p className="sm-note">The agent handles conversations by itself. These ones are yours: starting a project, payment, or something it shouldn’t answer alone.</p>
      {D.needs.map((n) => <div key={n.id} className="ss-need">
        <b>{n.name}</b><span>{n.handover.why}</span>
        {n.said ? <q className="ss-dim">{String(n.said).slice(0, 220)}{String(n.said).length > 220 ? '…' : ''}</q> : null}
        <div className="ss-row">
          {n.draft ? <a className="btn btn-green" href="/admin/sales#outbox" onClick={showDetails}>See its suggested reply</a> : <a className="btn btn-green" href="/admin/sales#replies" onClick={showDetails}>See the conversation</a>}
          <button className="btn btn-line" disabled={!!busy} onClick={() => act('h' + n.id, { action: 'handover-done', id: n.id }, 'Done. The agent takes it from here.')}>{busy === 'h' + n.id ? 'Saving…' : 'I’ve dealt with it'}</button>
        </div></div>)}
    </section> : null}

    {(D.calls || []).length ? <section className="sm-card" aria-label="Your calls">
      <h2>Your calls</h2>
      {D.calls.map((c) => <div key={c.meeting_code} className="ss-call">
        <div><b>{c.company}</b><span>{when(c.starts_at)} · Lagos time · with {c.name}</span></div>
        <a className={'btn ' + (c.brief ? 'btn-green' : 'btn-line')} href={'/admin/sales/brief/' + c.id}>{c.brief ? 'Read the brief' : 'Brief (being written)'}</a>
      </div>)}
    </section> : null}

    {D.replies ? <a className="ys-link sm-need-soft" href="/admin/sales#replies" onClick={showDetails}><span><b>{D.replies} repl{D.replies === 1 ? 'y' : 'ies'} to look at</b>Someone answered: see what they said and what the agent did</span><em aria-hidden="true">→</em></a> : null}
    {D.waiting && !D.autoSend ? <a className="ys-link sm-need-soft" href="/admin/sales#outbox" onClick={showDetails}><span><b>{D.waiting} email{D.waiting === 1 ? '' : 's'} waiting for your OK</b>Written and checked; they go out when you approve</span><em aria-hidden="true">→</em></a> : null}

    <div className="sm-grid"><div>
      <section className="sm-card" aria-label="Worth your time">
        <h2>Worth your time</h2>
        {D.leads.length ? D.leads.map((l) => <div key={l.id} className="ss-lead">
          <div className="ss-lh"><b>{l.name}</b><span className={'ss-tier ss-' + l.plan.tier}>{l.plan.tierLabel}</span></div>
          <span>{FLAG[l.country]} · {STATUS[l.status] || l.status} · {l.plan.offerName}, {l.plan.price}</span>
          {l.plan.angle ? <span className="ss-dim">{l.plan.angle}</span> : null}
          <span className="ss-dim">Why this level: {(l.plan.reasons || []).join(', ')}</span></div>)
          : <p className="sm-note">No businesses researched yet. Turn the agent on and add where to look (Detailed → Find).</p>}
      </section>

      <section className="sm-card" aria-label="Documents">
        <h2>Official documents</h2>
        <div className="ss-doc">
          <b>Rate card</b>
          <div className="ss-row">
            <label className="ss-f"><span>For</span><select className="input" value={rc.country} onChange={(e) => setRc({ ...rc, country: e.target.value })}>{Object.entries(FLAG).map(([k, v]) => <option key={k} value={k}>{v} ({CUR[k]})</option>)}</select></label>
            <label className="ss-f"><span>Level</span><select className="input" value={rc.tier} onChange={(e) => setRc({ ...rc, tier: e.target.value })}><option value="starter">Starter</option><option value="growth">Growth</option><option value="premium">Premium</option></select></label>
          </div>
          {field(rc, setRc, 'client', 'Prepared for (optional)')}
          <button className="sm-btn sm-line" disabled={!!busy} onClick={() => act('rc', { action: 'doc-ratecard', ...rc }, (j) => `Rate card ${j.number} is ready.`, setDoc)}>{busy === 'rc' ? 'Making…' : 'Make a rate card'}</button>
        </div>
        <div className="ss-doc">
          <b>Invoice</b>
          {!D.bankSet ? <p className="sm-note">Add your bank details below first: they go on every invoice.</p> : null}
          <div className="ss-row">{field(inv, setInv, 'name', 'Client name')}{field(inv, setInv, 'company', 'Company')}</div>
          {field(inv, setInv, 'email', 'Client email', 'email')}
          <div className="ss-row">{field(inv, setInv, 'desc', 'What for')}{field(inv, setInv, 'amount', 'Amount', 'number', { min: 0, step: '0.01' })}</div>
          <div className="ss-row"><label className="ss-f"><span>Currency</span><select className="input" value={inv.currency} onChange={(e) => setInv({ ...inv, currency: e.target.value })}><option>USD</option><option>GBP</option><option>EUR</option></select></label>{field(inv, setInv, 'dueDays', 'Due in (days)', 'number', { min: 0, max: 90 })}</div>
          <button className="sm-btn sm-line" disabled={!!busy || !D.bankSet} onClick={() => act('inv', { action: 'doc-invoice', client: { name: inv.name, email: inv.email, company: inv.company }, items: [{ desc: inv.desc, qty: 1, amount: Number(inv.amount) }], currency: inv.currency, dueDays: Number(inv.dueDays) }, (j) => `Invoice ${j.number} is ready.`, setDoc)}>{busy === 'inv' ? 'Making…' : 'Make an invoice'}</button>
        </div>
        {doc ? <a className="ys-link" href={doc.path} target="_blank" rel="noopener noreferrer"><span><b>Open {doc.number}</b>Its private link: {doc.url}</span><em aria-hidden="true">↗</em></a> : null}
        {D.docs.length ? <div className="ss-docs">{D.docs.map((x) => <a key={x.token} href={x.path} target="_blank" rel="noopener noreferrer">{x.number} · {x.client || (x.kind === 'invoice' ? 'Invoice' : 'Rate card')}{x.viewed_at ? ' · opened' : ''}</a>)}</div> : null}
      </section>
    </div><div>

      <section className="sm-card" aria-label="Switches">
        <h2>Switches</h2>
        <div className="sm-sw"><div><b>The agent</b><span>Finds businesses, reads their sites, writes, answers replies, follows up, keeps leads warm and books your calls.</span></div>
          <button className={'sm-tog' + (D.enabled ? '' : ' off')} role="switch" aria-checked={D.enabled} aria-label="The agent" disabled={!!busy} onClick={() => act('agent', { action: 'agent', on: !D.enabled }, D.enabled ? 'The agent is off.' : 'The agent is on.')}><i /><em>{D.enabled ? 'ON' : 'OFF'}</em></button></div>
        <div className="sm-sw"><div><b>Send without asking me</b><span>{D.autoSend ? 'Emails that pass every check go out by themselves.' : 'Each email waits for your OK first.'}</span></div>
          <button className={'sm-tog' + (D.autoSend ? '' : ' off')} role="switch" aria-checked={D.autoSend} aria-label="Send without asking me" disabled={!!busy} onClick={() => act('auto', { action: 'auto-send', on: !D.autoSend }, D.autoSend ? 'Emails wait for your OK again.' : 'Emails now go out by themselves.')}><i /><em>{D.autoSend ? 'ON' : 'OFF'}</em></button></div>
        {D.finding ? <div className="sm-sw"><div><b>Find businesses by itself</b><span>{D.finding.on ? (D.finding.last ? `Last search: ${KIND_NAME(D.finding.last.kind)} in ${D.finding.last.town}${D.finding.last.error ? ` (${D.finding.last.error})` : `, ${D.finding.last.added || 0} new`}. It searches again when fewer than 40 are waiting.` : 'It searches a new kind of business in a new city whenever fewer than 40 are waiting.') : 'Off: you find businesses yourself (Show details → Find).'}</span></div>
          <button className={'sm-tog' + (D.finding.on ? '' : ' off')} role="switch" aria-checked={D.finding.on} aria-label="Find businesses by itself" disabled={!!busy} onClick={() => act('find', { action: 'auto-find', on: !D.finding.on }, D.finding.on ? 'Finding by itself is off.' : 'It will find businesses by itself.')}><i /><em>{D.finding.on ? 'ON' : 'OFF'}</em></button></div> : null}
        {D.forms ? <div className="sm-sw"><div><b>Contact forms</b><span>{!D.forms.enabled ? 'Off: businesses without a published email are skipped.'
            : D.forms.paused ? D.forms.paused
            : !D.forms.ready ? 'Waiting for your outreach Gmail (their replies come there).'
            : `When there’s no email, the message goes through their “Contact us” form. Today ${D.forms.today} of ${D.forms.cap}; the limit grows by 5 a week, up to 40.`}</span></div>
          <button className={'sm-tog' + (D.forms.enabled ? '' : ' off')} role="switch" aria-checked={D.forms.enabled} aria-label="Contact forms" disabled={!!busy} onClick={() => act('forms', { action: 'forms', on: !D.forms.enabled }, D.forms.enabled ? 'Contact forms are off.' : 'Contact forms are on.')}><i /><em>{D.forms.enabled ? 'ON' : 'OFF'}</em></button></div> : null}
        {D.partners ? <div className="sm-sw"><div><b>Agency partners</b><span>{D.partners.enabled ? `Agencies that sell websites get a partner offer: you build their clients’ sites under their name. ${D.partners.found} found${D.partners.reached ? `, ${D.partners.reached} reached` : ''}.` : 'Off: agencies are skipped.'}</span></div>
          <button className={'sm-tog' + (D.partners.enabled ? '' : ' off')} role="switch" aria-checked={D.partners.enabled} aria-label="Agency partners" disabled={!!busy} onClick={() => act('partners', { action: 'partners', on: !D.partners.enabled }, D.partners.enabled ? 'Agency partners are off.' : 'Agency partners are on.')}><i /><em>{D.partners.enabled ? 'ON' : 'OFF'}</em></button></div> : null}
        {['GB', 'US', 'FR'].map((c) => <div key={c} className="sm-sw"><div><b>{FLAG[c]}</b><span>{{ GB: 'Limited companies only (UK law). Prices in pounds.', US: 'With an opt-out line and your address (US law). Prices in dollars.', FR: 'Emails in French; your replies in English. Prices in euros.' }[c]}</span></div>
          <button className={'sm-tog' + (D.countries.includes(c) ? '' : ' off')} role="switch" aria-checked={D.countries.includes(c)} aria-label={FLAG[c]} disabled={!!busy} onClick={() => toggleCountry(c)}><i /><em>{D.countries.includes(c) ? 'ON' : 'OFF'}</em></button></div>)}
        <p className="sm-note">Never Germany or Austria: their law needs consent even for business emails.</p>
      </section>

      <section className="sm-card" aria-label="Bank details">
        <h2>Your bank details</h2>
        <p className="sm-note">Printed on every invoice. Clients pay straight into your bank.</p>
        {field(bank, setBank, 'account_name', 'Account name')}{field(bank, setBank, 'bank_name', 'Bank')}
        <div className="ss-row">{field(bank, setBank, 'account_number', 'Account number')}{field(bank, setBank, 'sort_code', 'Sort code (UK)')}</div>
        <div className="ss-row">{field(bank, setBank, 'iban', 'IBAN')}{field(bank, setBank, 'swift', 'SWIFT / BIC')}</div>
        {field(bank, setBank, 'notes', 'A note for payers (optional)')}
        <button className="sm-btn sm-line" disabled={!!busy} onClick={() => act('bank', { action: 'bank', ...bank }, 'Bank details saved.')}>{busy === 'bank' ? 'Saving…' : 'Save bank details'}</button>
      </section>

      <button className="sm-more" onClick={showDetails}>Show the details (outbox, replies, businesses, find, settings) <span aria-hidden="true">→</span></button>
    </div></div>
    <style dangerouslySetInnerHTML={{ __html: SIMPLE_CSS + YS_CSS + CSS }} />
  </div>)
}
const CSS = `
.ss-stages{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}@media(min-width:700px){.ss-stages{grid-template-columns:repeat(6,minmax(0,1fr))}}
.ss-needs{border-color:rgba(239,122,106,.5);background:linear-gradient(150deg,rgba(239,122,106,.14),rgba(239,122,106,.03))}
.ss-need{display:grid;gap:4px;padding:12px 0;border-top:1px solid var(--line);font-size:14.5px}.ss-need q{quotes:none;font-style:italic}.ss-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
.ss-call{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 0;border-top:1px solid var(--line)}.sm-card h2+.ss-call{border-top:0;padding-top:0}.ss-call div{display:grid;gap:2px;min-width:0}.ss-call span{font-size:14px;color:var(--dim)}
.ss-lead{display:grid;gap:3px;padding:12px 0;border-top:1px solid var(--line);font-size:14px;color:var(--paper)}.sm-card h2+.ss-lead{border-top:0;padding-top:0}
.ss-lh{display:flex;gap:8px;align-items:center;justify-content:space-between}.ss-lh b{font-size:16px;overflow-wrap:anywhere}.ss-dim{color:var(--dim);font-size:13.5px}
.ss-tier{font-size:11.5px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;padding:4px 9px;border-radius:999px;background:var(--raise2);color:var(--dim);flex:none}
.ss-growth{color:var(--warn);background:rgba(240,179,94,.14)}.ss-premium{color:var(--green);background:rgba(143,227,106,.14)}
.ss-doc{display:grid;gap:8px;padding:12px 0;border-top:1px solid var(--line)}.sm-card h2+.ss-doc{border-top:0;padding-top:0}.ss-doc>b{font-size:16px}
.ss-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.ss-f{display:grid;gap:4px;font-size:13px;color:var(--dim);min-width:0}.ss-f .input{width:100%;min-width:0}
.ss-docs{display:flex;flex-wrap:wrap;gap:8px}.ss-docs a{font-size:13px;color:var(--dim);padding:6px 10px;border-radius:999px;border:1px solid var(--line);text-decoration:none}
`
