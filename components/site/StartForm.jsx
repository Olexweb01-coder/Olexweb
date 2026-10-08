'use client'
// The project form. Same protections as the review page: a hidden bot trap, a signed start time, limits per connection.
import { useState } from 'react'
const WA = 'https://wa.me/2347011726321?text=' + encodeURIComponent("Hi Olexweb, I have a project in mind and I'd like to talk about it.").replace(/'/g, '%27')
export default function StartForm({ stamp }) {
  const [f, setF] = useState({ name: '', contact: '', business: '', need: '', budget: '', timeline: '' }), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [sent, setSent] = useState(false)
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); if (err) setErr('') }   // the message clears as soon as they correct it
  async function send(e) {
    e.preventDefault(); setErr('')
    const problem = f.name.trim().length < 2 ? 'Add your name.' : f.contact.trim().length < 5 ? 'Add a WhatsApp number or an email address.' : f.need.trim().length < 10 ? 'Tell Olaitan a little about what you need.' : ''
    if (problem) { setErr(problem); return }
    setBusy(true)
    try {
      const p = new URLSearchParams(location.search)
      const r = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, stamp, website: e.currentTarget.website.value, page: p.get('from') || '/start', ref: document.referrer, utm: p.get('utm_source') || '' }) })
      const j = await r.json().catch(() => ({}))
      if (r.ok) { setSent(true); window.scrollTo({ top: 0, behavior: 'smooth' }) } else setErr(j.error || 'Something went wrong. Try again, or message on WhatsApp.')
    } catch { setErr('No connection. Your details are still here; try again.') } finally { setBusy(false) }
  }
  if (sent) return (<div className="sf"><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <h1>Thank you, {f.name.trim().split(' ')[0]}.</h1>
    <p className="sf-lead">Olaitan will reply within a day, on WhatsApp or by email.</p>
    <p><a className="btn btn-line" href={WA}>Prefer to talk now? Message me on WhatsApp</a></p></div>)
  return (<form className="sf" onSubmit={send} noValidate><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <p className="art-back"><a href="/work-with-me">Back to Work with me</a></p>
    <h1>Start your project.</h1>
    <p className="sf-lead">Tell me what you have in mind. You’ll get a reply within a day, on WhatsApp or by email.</p>
    <label>Your name<input className="sf-in" value={f.name} onChange={set('name')} autoComplete="name" maxLength={80} required /></label>
    <label>WhatsApp number or email<input className="sf-in" value={f.contact} onChange={set('contact')} autoComplete="email" inputMode="email" maxLength={120} placeholder="For example: +234 801 234 5678" required /></label>
    <label>Business name <span>(optional)</span><input className="sf-in" value={f.business} onChange={set('business')} autoComplete="organization" maxLength={120} /></label>
    <label>What do you need?<textarea className="sf-in" value={f.need} onChange={set('need')} maxLength={2000} rows={5} placeholder="A new website, a redesign, an app, an admin system… What should it do for your business?" required /></label>
    <div className="sf-row">
      <label>Budget <span>(optional)</span><input className="sf-in" value={f.budget} onChange={set('budget')} maxLength={60} placeholder="For example: ₦1,000,000" /></label>
      <label>When <span>(optional)</span><select className="sf-in" value={f.timeline} onChange={set('timeline')}><option value="">Choose</option><option>As soon as possible</option><option>Within a month</option><option>In 1 to 3 months</option><option>Just exploring</option></select></label>
    </div>
    <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    {err ? <p className="sf-err" role="alert">{err}</p> : null}
    <button className="btn btn-green" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send my project details'}</button>
    <p className="sf-note">Prefer to talk? <a href={WA}>Message me on WhatsApp</a>. Your details are used only to reply to you; see the <a href="/privacy">Privacy Policy</a>.</p>
  </form>)
}
const CSS = `
.sf{display:flex;flex-direction:column;gap:16px;max-width:620px}
.sf h1{margin:6px 0 0}
.sf-lead{margin:0;font-size:18px;color:var(--paper-dim)}
.sf label{display:flex;flex-direction:column;gap:7px;font-size:15px;font-weight:600}
.sf label span{font-weight:400;color:var(--paper-dim)}
.sf-in{font:inherit;font-size:16px;font-weight:400;color:var(--paper);background:#121412;border:1px solid var(--hair);border-radius:14px;padding:13px 14px;width:100%;box-sizing:border-box}
.sf-in:focus{outline:none;border-color:var(--green);box-shadow:0 0 0 3px rgba(143,227,106,.18)}
textarea.sf-in{resize:vertical;min-height:120px;line-height:1.5}
.sf-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px}
.sf-err{margin:0;color:#f0b35e;font-weight:600}
.sf .btn{align-self:flex-start;text-decoration:none;border:0;cursor:pointer;font:inherit}
.sf-note{margin:0;font-size:14px;color:var(--paper-dim)}.sf-note a{color:var(--paper)}
`
