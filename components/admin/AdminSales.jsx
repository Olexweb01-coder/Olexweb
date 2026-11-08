'use client'
// Admin → Sales: Olex Sales, Olaitan's client-finding agent. Outbox (approve each email), Companies (what was found and
// why), Find (sources), Settings (limits, address, do-not-contact). lib/sales; /admin/api/sales.
import { useCallback, useEffect, useState } from 'react'
import { toast } from './ui'

const TABS = [['outbox', 'Outbox'], ['replies', 'Replies'], ['companies', 'Companies'], ['find', 'Find'], ['settings', 'Settings']]
const STEP = { 1: 'First email', 2: 'Follow-up 1', 3: 'Follow-up 2', 9: 'Answer to their reply', 10: 'Nudge', 11: 'Last nudge', 12: 'Introduction (they pointed us here)', 20: 'Check-in', 21: 'Check-in 2', 22: 'Last check-in' }
const MOVE = { answer: 'The agent answered', book: 'The agent sent your booking link', later: 'Not now: the agent will check in later', referral: 'They pointed to someone else: the agent wrote to them', handover: 'Handed to you', stop: 'They said no: no more emails' }
const INTENT = { interested: 'Interested', question: 'Question', price: 'Asked the price', wants_call: 'Wants a call', objection: 'Has a doubt', not_interested: 'Said no', not_now: 'Not now', wrong_person: 'Wrong person', other: 'Reply', opt_out: 'Opted out (done)', auto_reply: 'Out of office', bounce: 'Bounced' }
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const STATUS = { new: 'Waiting to be checked', qualified: 'Ready to email', drafted: 'Email drafted', contacted: 'Emailed', no_email: 'No published email', uk_unconfirmed: 'UK: not confirmed as a limited company',
  skipped: 'Skipped', write_failed: 'Draft failed', error: 'Couldn’t check', replied: 'Talking', booked: 'Call booked', opted_out: 'Opted out', bounced: 'Bounced', nurture: 'Later (kept warm)', lost: 'Closed (said no or went quiet)' }
const SIG = { NO_WEBSITE: 'No website', SITE_DOWN: 'Site down', SLOW_MOBILE: 'Slow on phones', NOT_MOBILE: 'Not mobile-friendly', NO_HTTPS: 'No padlock', NO_BOOKING: 'No online booking', OLD_COPYRIGHT: 'Looks out of date', PLATFORM: 'Platform' }
async function call(body) {
  const r = await fetch('/admin/api/sales', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'That didn’t work.'); return j
}
const Sigs = ({ list }) => (list && list.length ? <div className="sl-sigs">{list.map((s) => <span key={s.code} title={s.evidence}>{SIG[s.code] || s.code}</span>)}</div> : null)

export default function AdminSales() {
  const [tab, setTab] = useState(() => (typeof location !== 'undefined' && TABS.some(([t]) => '#' + t === location.hash) ? location.hash.slice(1) : 'outbox'))
  const [o, setO] = useState(null)
  const load = useCallback(async () => { try { setO(await call({ action: 'overview' })) } catch (e) { toast(e.message) } }, [])
  useEffect(() => { load() }, [load])
  const go = (t) => { setTab(t); history.replaceState(null, '', '#' + t) }
  return (<div className="sl">
    <div className="top"><h1 className="d">Sales</h1></div>
    {o ? <p className="sl-lead">Olex Sales finds UK and US businesses whose websites need help, drafts a short email to each, and sends at most {o.settings.daily_cap} a day from your outreach Gmail once you approve.
      {' '}<b>{o.sentToday} sent today</b> (limit today {o.capToday}).{o.blocked ? <span className="sl-warn"> {o.blocked}</span> : null}</p> : null}
    <div className="seg sl-tabs" role="tablist">{TABS.map(([t, l]) => <button key={t} type="button" role="tab" aria-selected={tab === t} aria-pressed={tab === t} onClick={() => go(t)}>{l}{t === 'outbox' && o && o.outbox.waiting ? ` (${o.outbox.waiting})` : ''}</button>)}</div>
    {!o ? <p className="mg-dim">Loading…</p> : tab === 'outbox' ? <Outbox reload={load} /> : tab === 'replies' ? <Replies /> : tab === 'companies' ? <Companies reload={load} /> : tab === 'find' ? <Find o={o} reload={load} /> : <Settings o={o} setO={setO} />}
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
  </div>)
}

function Outbox({ reload }) {
  const [which, setWhich] = useState('waiting'), [items, setItems] = useState(null), [edit, setEdit] = useState(null)
  const load = useCallback(async () => { try { setItems((await call({ action: 'outbox', which })).items) } catch (e) { toast(e.message) } }, [which])
  useEffect(() => { load() }, [load])
  async function act(action, id) { try { await call({ action, id }); toast(action === 'approve' ? 'Approved. It goes out in their office hours.' : 'Rejected.'); load(); reload() } catch (e) { toast(e.message) } }
  async function save(force) {
    try { await call({ action: 'edit', id: edit.id, subject: edit.subject, body: edit.body, force }); setEdit(null); toast('Saved.'); load() }
    catch (e) { if (/Save anyway/.test(e.message) && confirm(e.message)) return save(true); toast(e.message) }
  }
  return (<section className="mg-box">
    <div className="seg sl-sub"><button type="button" aria-pressed={which === 'waiting'} onClick={() => setWhich('waiting')}>To approve</button><button type="button" aria-pressed={which === 'sent'} onClick={() => setWhich('sent')}>Sent and done</button></div>
    {!items ? <p className="mg-dim">Loading…</p> : !items.length ? <p className="mg-dim">{which === 'waiting' ? 'Nothing to approve. New drafts appear as Olex Sales checks the businesses you find.' : 'Nothing sent yet.'}</p> :
      <ul className="sl-out">{items.map((m) => <li key={m.id} className={'sl-m sl-' + m.status}>
        <div className="sl-mh"><span className="sl-step">{STEP[m.step] || 'Email'}</span><b>{m.company}</b><span className="mg-dim">{m.city ? m.city + ', ' : ''}{{ GB: 'UK', US: 'US', FR: 'France' }[m.country] || m.country} · {m.channel === 'form' ? 'through their contact form' : 'to ' + m.email}{m.website ? <> · <a href={m.website} target="_blank" rel="noreferrer">their site</a></> : null}</span></div>
        <Sigs list={m.signals} />
        {m.held_reason && m.status === 'waiting' ? <p className="sl-for-you">{m.held_reason}. The agent wrote a suggested reply: edit it, then approve, or answer them yourself.</p> : null}
        {edit && edit.id === m.id ? <div className="sl-edit"><input className="input" value={edit.subject} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} aria-label="Subject" />
          <textarea className="input" rows={8} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} aria-label="Email" />
          <div className="mg-acts"><button className="btn btn-green" onClick={() => save(false)}>Save</button><button className="btn btn-line" onClick={() => setEdit(null)}>Cancel</button></div></div>
          : <><p className="sl-subj">{m.subject}</p><pre className="sl-body">{m.body}</pre></>}
        {m.error ? <p className="sl-warn">{m.error}</p> : null}
        {which === 'waiting' && !(edit && edit.id === m.id) ? <div className="mg-acts">{m.status === 'approved' ? <span className="sl-ok">Approved, waiting for their office hours</span> : <button className="btn btn-green" onClick={() => act('approve', m.id)}>Approve</button>}
          <button className="btn btn-line" onClick={() => setEdit({ id: m.id, subject: m.subject, body: m.body })}>Edit</button><button className="btn btn-line" onClick={() => act('reject', m.id)}>Reject</button></div>
          : which === 'sent' ? <p className="mg-dim">{m.status === 'sent' ? 'Sent ' + new Date(m.sent_at).toLocaleString('en-GB', { timeZone: 'Africa/Lagos' }) : m.status}</p> : null}
      </li>)}</ul>}
  </section>)
}

function Replies() {
  const [rows, setRows] = useState(null)
  const load = useCallback(async () => { try { setRows((await call({ action: 'replies' })).replies) } catch (e) { toast(e.message) } }, [])
  useEffect(() => { load() }, [load])
  return (<section className="mg-box">
    {!rows ? <p className="mg-dim">Loading…</p> : !rows.length ? <p className="mg-dim">No replies yet. They appear here within 10 minutes of arriving in the outreach Gmail.</p> :
      <ul className="sl-out">{rows.map((r) => <li key={r.id} className={'sl-m' + (r.handled ? ' sl-done' : '')}>
        <div className="sl-mh"><span className={'sl-step sl-i-' + r.intent}>{INTENT[r.intent] || r.intent}</span><b>{r.company || r.from_email}</b><span className="mg-dim">{r.from_email} · {new Date(r.received_at).toLocaleString('en-GB', { timeZone: 'Africa/Lagos' })}</span></div>
        {r.summary ? <p className="sl-subj">{r.summary}</p> : null}{r.body && r.intent !== 'bounce' ? <pre className="sl-body">{r.body}</pre> : null}
        {r.move ? <p className="mg-dim">{MOVE[r.move] || r.move}{r.move !== 'stop' && r.move !== 'handover' ? '' : '.'}</p> : ['interested', 'question'].includes(r.intent) && !r.handled ? <p className="mg-dim">An answer with your booking link is waiting in the Outbox.</p> : null}
        {!r.handled ? <div className="mg-acts"><button className="btn btn-line" onClick={async () => { await call({ action: 'reply-done', id: r.id }); load() }}>Done</button></div> : null}
      </li>)}</ul>}
  </section>)
}

function Companies({ reload }) {
  const [status, setStatus] = useState('qualified'), [rows, setRows] = useState(null), [busy, setBusy] = useState(0)
  const load = useCallback(async () => { try { setRows((await call({ action: 'companies', status: status || null })).companies) } catch (e) { toast(e.message) } }, [status])
  useEffect(() => { load() }, [load])
  async function act(action, id, ok) { setBusy(id); try { await call({ action, id }); toast(ok); load(); reload() } catch (e) { toast(e.message) } setBusy(0) }
  return (<section className="mg-box">
    <label className="sl-filter"><span className="mg-lab">Show</span><select className="input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Everything</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
    {!rows ? <p className="mg-dim">Loading…</p> : !rows.length ? <p className="mg-dim">None here yet.</p> : <ul className="mg-list">{rows.map((c) => <li key={c.id}>
      <div className="mg-main"><b>{c.name}</b><span className="mg-dim">{c.category} · {c.city ? c.city + ', ' : ''}{c.country === 'GB' ? 'UK' : 'US'} · {STATUS[c.status] || c.status}{c.score ? ` · score ${c.score}/10` : ''}</span>
        {c.website ? <a className="mg-dim" href={c.website} target="_blank" rel="noreferrer">{c.domain}</a> : null}
        <Sigs list={c.signals} />{c.contacts ? <span className="mg-dim">{c.contacts.map((k) => `${k.email} (${k.status})`).join(', ')}</span> : null}
        {c.profile_error ? <span className="sl-warn">{c.profile_error}</span> : null}</div>
      <div className="mg-acts">{['new', 'error', 'skipped', 'no_email', 'uk_unconfirmed', 'write_failed'].includes(c.status) ? <button className="btn btn-line" disabled={busy === c.id} onClick={() => act('profile', c.id, 'Checked again.')}>Check again</button> : null}
        {c.status === 'qualified' ? <button className="btn btn-green" disabled={busy === c.id} onClick={() => act('draft', c.id, 'Drafted. It’s in the Outbox.')}>Draft email</button> : null}
        {!['skipped', 'contacted', 'replied', 'booked'].includes(c.status) ? <button className="btn btn-line" onClick={() => act('skip', c.id, 'Skipped.')}>Skip</button> : null}</div>
    </li>)}</ul>}
  </section>)
}

function Find({ o, reload }) {
  const [kinds, setKinds] = useState([]), [f, setF] = useState({ source: 'serper', country: 'GB', kind: 'dentist', town: '', text: '', newerThanDays: 0 }), [busy, setBusy] = useState(''), [test, setTest] = useState(null)
  useEffect(() => { call({ action: 'kinds' }).then((j) => setKinds(j.kinds)).catch(() => {}) }, [])
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  async function run(e) { e.preventDefault(); setBusy('find'); try { const r = await call({ action: 'find', ...f }); toast(`Found ${r.found}, ${r.added} new. They’ll be checked over the next minutes.`); reload() } catch (err) { toast(err.message) } setBusy('') }
  async function check() { setBusy('test'); try { setTest(await call({ action: 'test-sources' })) } catch (e) { toast(e.message) } setBusy('') }
  return (<section className="mg-box">
    <form className="sl-find" onSubmit={run}>
      <label><span className="mg-lab">Where to look</span><select className="input" value={f.source} onChange={set('source')}><option value="serper">Map listings (Serper){o.keys.serper ? '' : ' – needs key'}</option>
        <option value="companies_house">UK companies register (Companies House){o.keys.companiesHouse ? '' : ' – needs key'}</option><option value="osm">OpenStreetMap (free, sometimes busy)</option><option value="manual">Paste a list</option></select></label>
      {f.source !== 'companies_house' ? <label><span className="mg-lab">Country</span><select className="input" value={f.country} onChange={set('country')}><option value="GB">UK</option><option value="US">US</option></select></label> : null}
      {f.source !== 'manual' ? <><label><span className="mg-lab">Kind of business</span><select className="input" value={f.kind} onChange={set('kind')}>{kinds.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select></label>
        <label><span className="mg-lab">Town or city{f.country === 'US' && f.source !== 'companies_house' ? ' (with state, e.g. Austin TX)' : ''}</span><input className="input" value={f.town} onChange={set('town')} required placeholder={f.country === 'US' ? 'Austin TX' : 'Leeds'} /></label></>
        : <label className="sl-wide"><span className="mg-lab">One business per line: name, website, city (website and city optional)</span><textarea className="input" rows={6} value={f.text} onChange={set('text')} required /></label>}
      {f.source === 'companies_house' ? <label><span className="mg-lab">Only companies registered in the last</span><select className="input" value={f.newerThanDays} onChange={set('newerThanDays')}><option value={0}>any time</option><option value={90}>3 months</option><option value={365}>year</option></select></label> : null}
      <button className="btn btn-green" disabled={busy === 'find'}>{busy === 'find' ? 'Looking…' : 'Find businesses'}</button>
    </form>
    <div className="sl-test"><button className="btn btn-line" onClick={check} disabled={busy === 'test'}>{busy === 'test' ? 'Testing…' : 'Test my sources'}</button>
      {test ? <ul>{Object.entries(test).map(([k, v]) => <li key={k}><b>{k}</b>: {v}</li>)}</ul> : null}</div>
  </section>)
}

function Settings({ o, setO }) {
  const [s, setS] = useState(o.settings), [dnc, setDnc] = useState([]), [add, setAdd] = useState(''), set = (k) => (e) => setS({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const loadDnc = () => call({ action: 'dnc' }).then((j) => setDnc(j.list)).catch(() => {})
  useEffect(() => { loadDnc() }, [])
  async function save(e) { e.preventDefault(); try { setO(await call({ action: 'settings', settings: { ...s, start_date: s.start_date ? String(s.start_date).slice(0, 10) : null } })); toast('Saved.') } catch (err) { toast(err.message) } }
  async function addDnc(e) { e.preventDefault(); try { await call({ action: 'dnc-add', entry: add }); setAdd(''); loadDnc(); toast('Added. They’ll never be emailed.') } catch (err) { toast(err.message) } }
  const K = o.keys, ch = s.call_hours || { days: [1, 2, 3, 4, 5], from: '14:00', to: '18:00' }
  const setCh = (v) => setS({ ...s, call_hours: { ...ch, ...v } })
  async function resume() { try { setO(await call({ action: 'settings', settings: { ...s, resume: true, start_date: s.start_date ? String(s.start_date).slice(0, 10) : null } })); setS({ ...s, paused_reason: null }); toast('Resumed.') } catch (err) { toast(err.message) } }
  return (<section className="mg-box">
    {s.paused_reason ? <div className="sl-paused"><b>{s.paused_reason}</b><button className="btn btn-green" onClick={resume}>Resume sending</button></div> : null}
    <ul className="sl-keys">{[['Outreach Gmail', K.gmail, 'GMAIL_USER, GMAIL_APP_PASSWORD'], ['Companies House', K.companiesHouse, 'COMPANIES_HOUSE_API_KEY'], ['Serper', K.serper, 'SERPER_API_KEY'], ['PageSpeed', K.pageSpeed, 'PAGESPEED_API_KEY']].map(([n, ok, env]) =>
      <li key={n} className={ok ? 'on' : ''}><b>{n}</b>{ok ? 'connected' : <span className="mg-dim">add {env} in Vercel</span>}</li>)}</ul>
    <form className="sl-set" onSubmit={save}>
      <label className="sl-check"><input type="checkbox" checked={!!s.enabled} onChange={set('enabled')} /> Olex Sales is on (checks businesses, drafts and sends)</label>
      <label className="sl-check"><input type="checkbox" checked={s.require_approval !== false} onChange={set('require_approval')} /> I approve every email before it’s sent</label>
      <label><span className="mg-lab">Most emails a day (up to 20)</span><input className="input" type="number" min={1} max={20} value={s.daily_cap} onChange={set('daily_cap')} /></label>
      <label><span className="mg-lab">Warm-up started on (5 a day at first, +1 a day)</span><input className="input" type="date" value={s.start_date ? String(s.start_date).slice(0, 10) : ''} onChange={set('start_date')} /></label>
      <label><span className="mg-lab">Your name (as the sender)</span><input className="input" value={s.sender_name || ''} onChange={set('sender_name')} /></label>
      <label className="sl-wide"><span className="mg-lab">Your postal address (US law requires it in every email)</span><textarea className="input" rows={2} value={s.postal_address || ''} onChange={set('postal_address')} /></label>
      <div className="sl-wide sl-hours"><span className="mg-lab">Call hours for the booking page (Lagos time)</span>
        <div className="sl-days">{DAYS.map((d, i) => <label key={d} className="sl-day"><input type="checkbox" checked={ch.days.includes(i)} onChange={(e) => setCh({ days: e.target.checked ? [...ch.days, i].sort() : ch.days.filter((x) => x !== i) })} />{d}</label>)}</div>
        <div className="sl-days"><input className="input" type="time" value={ch.from} onChange={(e) => setCh({ from: e.target.value })} aria-label="From" /><span className="mg-dim">to</span><input className="input" type="time" value={ch.to} onChange={(e) => setCh({ to: e.target.value })} aria-label="To" /></div>
        <span className="mg-dim">Your booking page: <a href="https://meet.olexweb.com/book" target="_blank" rel="noreferrer">meet.olexweb.com/book</a> (times show in each visitor’s own time zone)</span></div>
      <label className="sl-wide"><span className="mg-lab">Opt-out line (under every email)</span><input className="input" value={s.opt_out_line || ''} onChange={set('opt_out_line')} /></label>
      <button className="btn btn-green">Save</button>
    </form>
    <h2 className="sl-h">Never contact</h2>
    <form className="sl-dnc" onSubmit={addDnc}><input className="input" value={add} onChange={(e) => setAdd(e.target.value)} placeholder="name@business.com or business.com" aria-label="Address or website" /><button className="btn btn-line">Add</button></form>
    {dnc.length ? <ul className="mg-list">{dnc.map((d) => <li key={d.entry}><div className="mg-main"><b>{d.entry}</b>{d.reason ? <span className="mg-dim">{d.reason}</span> : null}</div>
      <div className="mg-acts"><button className="btn btn-line" onClick={async () => { await call({ action: 'dnc-remove', entry: d.entry }); loadDnc() }}>Remove</button></div></li>)}</ul> : <p className="mg-dim">Nobody yet. People who reply “no thanks” are added automatically.</p>}
  </section>)
}

const CSS = `.sl{display:grid;gap:14px;max-width:980px}.sl-lead{margin:0;color:var(--dim);line-height:1.6;max-width:78ch}.sl-lead b{color:var(--paper)}.sl-warn{color:#f0b35e}.sl-ok{color:var(--green);font-size:14px;align-self:center}
.sl-tabs,.sl-sub{justify-self:start}.sl-sub{margin-bottom:12px}
.sl-out{list-style:none;margin:0;padding:0;display:grid;gap:12px}.sl-m{display:grid;gap:8px;padding:14px;border-radius:14px;border:1px solid var(--line)}.sl-mh{display:grid;gap:2px}
.sl-subj{margin:4px 0 0;font-weight:700}.sl-body{margin:0;white-space:pre-wrap;font:inherit;font-size:15px;line-height:1.55;background:rgba(242,239,233,.03);padding:12px;border-radius:10px}
.sl-sigs{display:flex;gap:6px;flex-wrap:wrap}.sl-sigs span{font-size:12px;font-weight:700;padding:3px 9px;border-radius:999px;background:rgba(143,227,106,.12);color:var(--green)}
.sl-edit{display:grid;gap:8px}.sl-filter{display:grid;gap:6px;max-width:320px;margin-bottom:10px}
.sl-find,.sl-set{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;align-items:end}.sl-find label,.sl-set label{display:grid;gap:6px}.sl-wide{grid-column:1/-1}
.sl-check{display:flex!important;gap:8px;align-items:center;grid-column:1/-1}
.sl-test{margin-top:14px;display:grid;gap:8px}.sl-test ul{margin:0;padding-left:18px;color:var(--dim);line-height:1.7}
.sl-keys{list-style:none;padding:0;margin:0 0 14px;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px}.sl-keys li{display:grid;gap:2px;padding:10px 12px;border-radius:12px;border:1px solid var(--line);font-size:14px}.sl-keys li.on{border-color:rgba(143,227,106,.4)}.sl-keys li.on::after{content:"✓";color:var(--green)}
.sl-h{font-size:16px;margin:20px 0 8px}.sl-step{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--green)}.sl-i-opt_out,.sl-i-bounce,.sl-i-auto_reply{color:var(--dim)!important}.sl-done{opacity:.6}.sl-for-you{margin:0;padding:10px 12px;border-radius:12px;background:rgba(239,122,106,.12);border:1px solid rgba(239,122,106,.4);font-size:14px}
.sl-paused{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:12px 14px;border-radius:12px;background:rgba(240,179,94,.12);color:#f0b35e;margin-bottom:14px}.sl-hours{display:grid;gap:8px}.sl-days{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.sl-day{display:flex;gap:4px;align-items:center;font-size:14px}.sl-dnc{display:flex;gap:8px;margin-bottom:10px}.sl-dnc .input{flex:1}`
