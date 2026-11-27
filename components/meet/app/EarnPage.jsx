'use client'
// Earn (Install 58): every way to earn on Meet, with every fee shown before you set a price and on every sale.
// Numbers come from the server (lib/meet/money.js); the live previews use the same maths.
import { useEffect, useRef, useState } from 'react'
import { I } from './icons'
import { api, naira, kobo, day, when, copyText, Sheet, Field, Empty, Fees, split } from './ui'
import { ProLocked, LockLine, lockedFor } from './ProLock'

const TABS = [['overview', 'Overview'], ['sell', 'Sell'], ['members', 'Members'], ['mentor', 'Mentoring'], ['certs', 'Certificates'], ['invite', 'Invite and rewards']]
const KIND = { ticket: 'Ticket', booking: 'Session', bundle: 'Bundle', membership: 'Membership', cert: 'Certificate' }
const D = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [7, 'Sun']]
const VARIANTS = [['c1', 'Classic Gold'], ['c2', 'Emerald'], ['c3', 'Modern'], ['c4', 'Royal Laurel'], ['c5', 'Champion']]
const AWARDS = ['Attendance', 'Participation', 'Completion', 'Achievement', 'Excellence']
const NICHES = ['Design', 'Tech and coding', 'Business', 'Marketing', 'Careers', 'Finance', 'Writing', 'Languages', 'Music and arts', 'Health and fitness', 'Faith', 'School and exams', 'Other']
const earnApi = (body) => api('/api/meet/earn', body)

export default function EarnPage({ ctx }) {
  const { h, setToast, reload, nav } = ctx, locked = lockedFor(h)
  const [e, setE] = useState(null), [tab, setTab] = useState('overview'), [busy, setBusy] = useState(''), [sheet, setSheet] = useState(null), [banks, setBanks] = useState(null)
  async function load() { try { setE(await api('/api/meet/earn')) } catch (x) { setToast(x.message) } }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  async function run(key, fn, ok) { setBusy(key); try { const r = await fn(); if (ok) setToast(ok); await load(); return r || true } catch (x) { setToast(x.message); return false } finally { setBusy('') } }
  async function openBank() { setSheet({ kind: 'bank', bankCode: '', accountNumber: '' }); if (!banks) try { setBanks((await earnApi({ action: 'banks' })).banks) } catch (x) { setToast(x.message) } }
  const pricingOn = h && h.dash.pricing.on, pro = h && h.dash.plan.pro
  if (!e) return <div className="wrap"><div className="earnhero skel" style={{ height: 180 }} /></div>
  const t = e.totals
  return (<div className="wrap">
    <section className="earnhero"><div><span className="pill dark"><i />Earn on Meet</span>
      <div className="amt" style={{ marginTop: 12 }}>{kobo(t.host)}</div><p style={{ margin: '6px 0 0', opacity: .85 }}>yours so far, after every fee · {kobo(t.month)} this month · {t.count} sale{t.count === 1 ? '' : 's'}</p>
      <p style={{ margin: '10px 0 0', opacity: .75, fontSize: 13.5 }}>Paystack pays your sales into your bank every week. Fees are shown before you sell, never after.</p></div>
      <div className="bankbox">{e.payout ? <><small>Paid to</small><b>{e.payout.accountName}</b><small>{e.payout.bankName} ••{e.payout.last4}</small><button className="btn sm w" onClick={openBank}>Change bank</button></>
        : <><b>Add your bank</b><small>So money reaches you</small><button className="btn sm go" onClick={openBank} disabled={!pricingOn}>Add my bank</button></>}</div></section>
    {!pricingOn ? <p className="note">Selling opens soon. You can set things up; nothing is charged until payments are switched on.</p> : null}
    <nav className="tabs" aria-label="Earn">{TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}</nav>

    {tab === 'overview' ? <>
      <section className="card"><div className="ch"><h3>Exactly what you get</h3></div><p className="dim" style={{ marginTop: 0 }}>A ₦5,000 ticket, to the kobo:</p><Fees {...e.example} />
        <p className="dim sm">Paystack’s fee is set by Paystack (now 1.5% + ₦100, the ₦100 waived under ₦2,500, at most ₦2,000), and you pay it. Olexweb keeps {e.fees.ticket}% on tickets, sessions, bundles and certificates, {e.fees.membership}% on memberships (platform management) and {e.fees.directory}% on sessions booked from Find a mentor (we brought the client).</p></section>
      <section className="card"><div className="ch"><h3>Sales</h3><small className="dim">Price · Paystack · Olexweb · You</small></div>
        {e.sales.length ? e.sales.map((s, i) => <div key={i} className="mrow"><span className="ni bg-b"><I n="coin" /></span><div className="t"><b>{KIND[s.kind] || s.kind}{s.via === 'directory' ? ' (from Find a mentor)' : ''}{s.seats > 1 ? ` · ${s.seats} people` : ''}</b><span>{s.buyer} · {when(s.at)}</span><span className="sm">{kobo(s.price)} − {kobo(s.paystack)} − {kobo(s.olexweb)}</span></div><b className="amtsm">{kobo(s.host)}</b></div>)
          : <Empty icon="coin" title="No sales yet">Sell tickets, bundles, sessions, memberships or certificates. Each sale shows here with its exact split.</Empty>}</section>
    </> : null}

    {tab === 'sell' ? <>
      <ProLocked h={h} nav={nav} title="Sell more with Pro" text="Tickets for paid meetings and tracked links are free for everyone. Pro adds:" items={['Sell course bundles', 'Paid one-on-one sessions', 'Memberships for your community', 'Paid certificates']} />
      <div className="ways">
        <div className="way"><span className="st live">Live</span><b>Paid meetings</b><p>Set a ticket price when you schedule a meeting. Nobody gets in without one.</p><a className="btn sm" href="#meetings">Schedule one</a></div>
        <div className="way"><span className="st live">Live</span><b>Closed sessions</b><p>One-on-one or a private group. Make a tracked link and see who opens, starts paying and pays.</p><button className="btn sm" onClick={() => setSheet({ kind: 'link', label: '', what: 'meeting', target: '' })}>Make a link</button></div>
        <div className="way"><span className="st new">{locked ? 'Pro' : 'New'}</span><b>Course bundles</b><p>Several sessions as one ticket, with early-bird and group prices.</p>{locked ? <LockLine>Sell course bundles</LockLine> : null}<button className="btn sm go" disabled={locked} onClick={() => setSheet({ kind: 'bundle', title: '', blurb: '', codes: [], price: '', earlyPrice: '', earlyUntil: '', groupSize: '', groupPrice: '' })}>New bundle</button></div>
      </div>
      <section className="card"><div className="ch"><h3>Bundles</h3></div>
        {e.bundles.length ? e.bundles.map((b) => <div key={b.id} className="mrow wrap-sm"><span className="ni bg-o"><I n="gift" /></span><div className="t"><b>{b.title}</b><span>{naira(b.now)}{b.now < b.price ? ` early-bird (then ${naira(b.price)})` : ''}{b.groupSize ? ` · ${b.groupSize} for ${naira(b.groupPrice)}` : ''} · {b.codes.length} session{b.codes.length === 1 ? '' : 's'} · {b.seats} sold{b.onSale ? '' : ' · not on sale'}</span></div>
          <div className="acts"><button className="btn sm" onClick={async () => { await copyText(`${location.origin}/meet/b/${b.id}`); setToast('Bundle link copied.') }}>Copy link</button><button className="btn sm" onClick={() => setSheet({ kind: 'bundle', ...b, earlyPrice: b.earlyPrice || '', earlyUntil: b.earlyUntil ? b.earlyUntil.slice(0, 10) : '', groupSize: b.groupSize || '', groupPrice: b.groupPrice || '' })}>Change</button></div></div>)
          : <Empty icon="gift" title="No bundles yet">Group your sessions into one ticket.</Empty>}</section>
      <section className="card"><div className="ch"><h3>Tracked links</h3><button className="lnk" onClick={() => setSheet({ kind: 'link', label: '', what: 'meeting', target: '' })}>New link</button></div>
        {e.links.length ? e.links.map((l) => <div key={l.id} className="mrow wrap-sm"><span className="ni bg-b"><I n="link" /></span><div className="t"><b>{l.label}</b><span>{l.opens} opened → {l.started} started paying → {l.paid} paid · <b>{kobo(l.netKobo)}</b> to you</span>
          <div className="funnel"><i style={{ width: '100%' }} /><i style={{ width: (l.opens ? Math.round((l.started / l.opens) * 100) : 0) + '%' }} /><i style={{ width: (l.opens ? Math.round((l.paid / l.opens) * 100) : 0) + '%' }} /></div></div>
          <div className="acts"><button className="btn sm" onClick={async () => { await copyText(`${location.origin}${location.hostname.startsWith('meet.') ? '' : '/meet'}/l/${l.slug}`); setToast('Link copied.') }}>Copy</button><button className="btn sm quiet" onClick={() => run('drop', () => earnApi({ action: 'link-drop', id: l.id }), 'Link deleted.')}>Delete</button></div></div>)
          : <Empty icon="link" title="No links yet">Share a tracked link on WhatsApp, Instagram or by email, and see what each one brings in.</Empty>}</section>
    </> : null}

    {tab === 'members' ? <Members e={e} pro={pro} pricingOn={pricingOn} busy={busy} run={run} reload={reload} /> : null}
    {tab === 'mentor' ? <Mentor e={e} h={h} busy={busy} run={run} locked={locked} nav={nav} /> : null}
    {tab === 'certs' ? <Certs e={e} pro={pro} busy={busy} run={run} setToast={setToast} /> : null}
    {tab === 'invite' ? <Invite e={e} h={h} setToast={setToast} /> : null}

    {sheet && sheet.kind === 'bank' ? <Sheet title={e.payout ? 'Change your bank' : 'Add your bank'} onClose={() => setSheet(null)}>
      <form className="stack" onSubmit={async (x) => { x.preventDefault(); if (await run('bank', () => earnApi({ action: 'payout', bankCode: sheet.bankCode, accountNumber: sheet.accountNumber }), 'Bank saved.')) setSheet(null) }}>
        <Field label="Bank"><select className="in" value={sheet.bankCode} onChange={(x) => setSheet({ ...sheet, bankCode: x.target.value })}><option value="">{banks ? 'Choose your bank' : 'Loading banks…'}</option>{(banks || []).map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}</select></Field>
        <Field label="Account number" hint="Paystack checks the name on the account before anything is saved."><input className="in" inputMode="numeric" maxLength={10} value={sheet.accountNumber} onChange={(x) => setSheet({ ...sheet, accountNumber: x.target.value.replace(/\D/g, '') })} /></Field>
        <div className="row-btns"><button className="btn go" disabled={busy === 'bank'}>{busy === 'bank' ? 'Checking…' : 'Save'}</button></div></form></Sheet> : null}
    {sheet && sheet.kind === 'bundle' ? <BundleSheet s={sheet} setS={setSheet} meetings={e.meetings} busy={busy} run={run} /> : null}
    {sheet && sheet.kind === 'link' ? <LinkSheet s={sheet} setS={setSheet} e={e} busy={busy} run={run} /> : null}
  </div>)
}

function BundleSheet({ s, setS, meetings, busy, run }) {
  const pv = split(s.earlyPrice || s.price, 'bundle')
  return (<Sheet title={s.id ? 'Change the bundle' : 'New course bundle'} onClose={() => setS(null)} wide>
    <form className="stack" onSubmit={async (x) => { x.preventDefault(); if (await run('bundle', () => earnApi({ action: 'bundle-save', id: s.id, title: s.title, blurb: s.blurb, codes: s.codes, price: s.price, earlyPrice: s.earlyPrice, earlyUntil: s.earlyUntil ? new Date(s.earlyUntil + 'T23:59:00').toISOString() : '', groupSize: s.groupSize, groupPrice: s.groupPrice, onSale: s.onSale !== false }), 'Bundle saved.')) setS(null) }}>
      <Field label="Name"><input className="in" maxLength={90} value={s.title} onChange={(x) => setS({ ...s, title: x.target.value })} placeholder="Product Design Masterclass" /></Field>
      <Field label="What it’s about (optional)"><textarea className="in" rows={2} maxLength={400} value={s.blurb} onChange={(x) => setS({ ...s, blurb: x.target.value })} /></Field>
      <div className="fld"><span>Sessions in it (your scheduled meetings)</span><div className="pickl">{meetings.length ? meetings.map((m) => <label key={m.code} className="check"><input type="checkbox" checked={s.codes.includes(m.code)} onChange={(x) => setS({ ...s, codes: x.target.checked ? [...s.codes, m.code] : s.codes.filter((c) => c !== m.code) })} /><span>{m.title}{m.at ? ` · ${when(m.at)}` : ''}</span></label>) : <p className="dim">Schedule the sessions first, then add them here.</p>}</div></div>
      <div className="grid3"><Field label="Price (₦)"><input className="in" type="number" min={100} inputMode="numeric" value={s.price} onChange={(x) => setS({ ...s, price: x.target.value })} /></Field>
        <Field label="Early-bird price (optional)"><input className="in" type="number" min={100} inputMode="numeric" value={s.earlyPrice} onChange={(x) => setS({ ...s, earlyPrice: x.target.value })} /></Field>
        <Field label="Early-bird ends"><input className="in" type="date" value={s.earlyUntil} onChange={(x) => setS({ ...s, earlyUntil: x.target.value })} /></Field></div>
      <div className="grid3"><Field label="Group size (optional)"><input className="in" type="number" min={2} max={50} inputMode="numeric" value={s.groupSize} onChange={(x) => setS({ ...s, groupSize: x.target.value })} /></Field>
        <Field label="Group price, total (₦)"><input className="in" type="number" min={100} inputMode="numeric" value={s.groupPrice} onChange={(x) => setS({ ...s, groupPrice: x.target.value })} /></Field></div>
      {pv ? <Fees {...pv} /> : null}
      {s.id ? <label className="check"><input type="checkbox" checked={s.onSale !== false} onChange={(x) => setS({ ...s, onSale: x.target.checked })} /><span>On sale</span></label> : null}
      <div className="row-btns"><button className="btn go" disabled={busy === 'bundle'}>{busy === 'bundle' ? 'Saving…' : 'Save bundle'}</button></div></form></Sheet>)
}
function LinkSheet({ s, setS, e, busy, run }) {
  const targets = s.what === 'meeting' ? e.meetings.map((m) => [m.code, m.title]) : s.what === 'bundle' ? e.bundles.map((b) => [String(b.id), b.title]) : []
  return (<Sheet title="New tracked link" onClose={() => setS(null)}>
    <form className="stack" onSubmit={async (x) => { x.preventDefault(); if (await run('link', () => earnApi({ action: 'link-make', label: s.label, kind: s.what, target: s.target }), 'Link made. Copy it from the list.')) setS(null) }}>
      <Field label="Name it (only you see this)"><input className="in" maxLength={60} value={s.label} onChange={(x) => setS({ ...s, label: x.target.value })} placeholder="Instagram, early-bird" /></Field>
      <Field label="It opens"><select className="in" value={s.what} onChange={(x) => setS({ ...s, what: x.target.value, target: '' })}><option value="meeting">A paid or closed meeting</option><option value="bundle">A bundle</option><option value="booking">My booking page</option><option value="membership">My membership</option></select></Field>
      {targets.length || ['meeting', 'bundle'].includes(s.what) ? (['meeting', 'bundle'].includes(s.what) ? <Field label="Which one"><select className="in" value={s.target} onChange={(x) => setS({ ...s, target: x.target.value })}><option value="">Choose</option>{targets.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field> : null) : null}
      <div className="row-btns"><button className="btn go" disabled={busy === 'link'}>Make the link</button></div></form></Sheet>)
}

function Members({ e, pro, pricingOn, busy, run, reload }) {
  const m = e.members, [f, setF] = useState({ on: m.on, price: m.price || 3000, perMonth: m.perMonth || 2, free: !!(m.perks && m.perks.free), discount: (m.perks && m.perks.discount) || 0, line: m.line || '' })
  const pv = split(f.price, 'membership')
  return (<>
    <section className="card"><div className="ch"><h3>Your membership</h3>{m.on && e.handle ? <a href={`/meet/h/${e.handle}/join`}>See your page</a> : null}</div>
      <p className="dim" style={{ marginTop: 0 }}>People pay you every month for what you promise. Olexweb counts the members-only meetings you hold and shows it on your page. If you hold none in a member’s month, they aren’t charged for the next one: their membership pauses until you hold one.</p>
      {!pro ? <p className="note">Memberships are for Pro hosts. Go Pro in Settings to turn them on.</p> : null}
      {m.on ? <div className="stats"><div className="stat"><span>Members</span><b>{m.active}</b><small>paying now</small></div><div className="stat"><span>Paused</span><b>{m.paused}</b><small>waiting for a meeting</small></div><div className="stat"><span>This month</span><b>{m.heldThisMonth} of {m.perMonth}</b><small>members-only meetings held</small></div></div> : null}
      <form className="stack" style={{ marginTop: 14 }} onSubmit={async (x) => { x.preventDefault(); if (await run('mem', () => earnApi({ action: 'membership', on: f.on, price: f.price, perMonth: f.perMonth, perks: { free: f.free, discount: f.discount }, line: f.line }), 'Membership saved.')) reload() }}>
        <div className="grid3"><Field label="Price per month (₦)"><input className="in" type="number" min={500} inputMode="numeric" value={f.price} onChange={(x) => setF({ ...f, price: x.target.value })} /></Field>
          <Field label="Members-only meetings a month (your promise)"><input className="in" type="number" min={1} max={31} inputMode="numeric" value={f.perMonth} onChange={(x) => setF({ ...f, perMonth: x.target.value })} /></Field>
          <Field label="Members’ discount on sessions and bundles (%)"><input className="in" type="number" min={0} max={50} inputMode="numeric" value={f.discount} onChange={(x) => setF({ ...f, discount: x.target.value })} /></Field></div>
        <label className="check"><input type="checkbox" checked={f.free} onChange={(x) => setF({ ...f, free: x.target.checked })} /><span>Members get into my paid meetings free</span></label>
        <Field label="In your own words (one line)"><input className="in" maxLength={160} value={f.line} onChange={(x) => setF({ ...f, line: x.target.value })} placeholder="Weekly design feedback and a monthly portfolio review" /></Field>
        {pv ? <Fees {...pv} why="Olexweb (platform management)" /> : null}
        <label className="check"><input type="checkbox" checked={f.on} onChange={(x) => setF({ ...f, on: x.target.checked })} disabled={!pro || !pricingOn} /><span>Open my membership</span></label>
        <div className="row-btns"><button className="btn go" disabled={busy === 'mem'}>{busy === 'mem' ? 'Saving…' : 'Save'}</button></div>
        <p className="dim sm">Changing the price applies to new members; existing members keep the price they joined at. Turning memberships off stops all future charges.</p></form></section>
    {e.memberOf.length ? <section className="card"><div className="ch"><h3>Communities you’re in</h3></div>{e.memberOf.map((x) => <div key={x.handle} className="mrow"><span className="ni bg-g"><I n="users" /></span><div className="t"><b>{x.host}</b><span>{naira(x.price)}/month · {x.status === 'paused' ? 'paused, not charged' : x.cancelling ? `ends ${day(x.until)}` : x.until ? `renews ${day(x.until)}` : x.status}</span></div><a className="btn sm" href={`/meet/h/${x.handle}/join`}>Open</a></div>)}</section> : null}
  </>)
}

function Mentor({ e, h, busy, run, locked, nav }) {
  const [bk, setBk] = useState({ ...e.booking }), [L, setL] = useState({ on: !!e.listing.on, niche: e.listing.niche || '', headline: e.listing.headline || '', help: (e.listing.help || []).join('\n'), city: e.listing.city || '', years: e.listing.years || '', tags: (e.listing.tags || []).join(', ') })
  const pv = split(bk.price, 'booking'), pd = split(bk.price, 'directory')
  return (<>
    <section className="card"><div className="ch"><h3>One-on-one sessions</h3>{e.booking.on && e.handle ? <a href={`/meet/h/${e.handle}/book`}>Your booking page</a> : null}</div>
      <form className="stack" onSubmit={(x) => { x.preventDefault(); run('bk', () => earnApi({ action: 'booking', ...bk }), 'Saved.') }}>
        <Field label="What people book"><input className="in" maxLength={80} value={bk.title} onChange={(x) => setBk({ ...bk, title: x.target.value })} /></Field>
        <div className="fld"><span>Days</span><div className="row-btns">{D.map(([d, l]) => <button key={d} type="button" className={'btn sm' + (bk.days.includes(d) ? ' go' : '')} aria-pressed={bk.days.includes(d)} onClick={() => setBk({ ...bk, days: bk.days.includes(d) ? bk.days.filter((y) => y !== d) : [...bk.days, d] })}>{l}</button>)}</div></div>
        <div className="grid3"><Field label="From (Lagos time)"><input className="in" type="time" value={bk.from} onChange={(x) => setBk({ ...bk, from: x.target.value })} /></Field><Field label="To"><input className="in" type="time" value={bk.to} onChange={(x) => setBk({ ...bk, to: x.target.value })} /></Field>
          <Field label="Session"><select className="in" value={bk.minutes} onChange={(x) => setBk({ ...bk, minutes: Number(x.target.value) })}>{[15, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}</select></Field></div>
        {locked ? <LockLine>Charge for sessions</LockLine> : null}
        <Field label={locked ? 'Price (free on the Free plan)' : 'Price (₦, 0 = free)'}><input className="in" type="number" min={0} inputMode="numeric" disabled={locked} value={locked ? 0 : bk.price} onChange={(x) => setBk({ ...bk, price: x.target.value })} /></Field>
        {pv ? <div className="two-fees"><div><small className="dim">From your own links</small><Fees {...pv} /></div><div><small className="dim">From Find a mentor</small><Fees {...pd} why="Olexweb (we brought the client)" /></div></div> : null}
        <label className="check"><input type="checkbox" checked={!!bk.on} onChange={(x) => setBk({ ...bk, on: x.target.checked })} /><span>Open my booking page</span></label>
        <div className="row-btns"><button className="btn go" disabled={busy === 'bk'}>Save</button></div></form></section>
    {locked ? <ProLocked h={h} nav={nav} title="Get found by new clients" text="Find a mentor lists Pro hosts. Free sessions on your own booking page work on Free." items={['Be listed in Find a mentor', 'Paid one-on-one sessions']} /> : null}
    {locked ? null : <section className="card"><div className="ch"><h3>Find a mentor listing</h3><a href="/meet/mentors">See the directory</a></div>
      <p className="dim" style={{ marginTop: 0 }}>Be listed in the public directory. Bookings that come from it: Olexweb keeps 10% (we brought you the client). Your ratings, people taught and sessions held are counted by Meet.</p>
      <form className="stack" onSubmit={(x) => { x.preventDefault(); run('ls', () => earnApi({ action: 'listing', on: L.on, niche: L.niche, headline: L.headline, help: L.help.split('\n'), city: L.city, years: L.years, tags: L.tags.split(',') }), 'Listing saved.') }}>
        <div className="grid3"><Field label="Main area"><select className="in" value={L.niche} onChange={(x) => setL({ ...L, niche: x.target.value })}><option value="">Choose</option>{NICHES.map((n) => <option key={n}>{n}</option>)}</select></Field>
          <Field label="City (optional)"><input className="in" maxLength={40} value={L.city} onChange={(x) => setL({ ...L, city: x.target.value })} /></Field><Field label="Years of experience"><input className="in" type="number" min={0} max={60} value={L.years} onChange={(x) => setL({ ...L, years: x.target.value })} /></Field></div>
        <Field label="One line about you"><input className="in" maxLength={90} value={L.headline} onChange={(x) => setL({ ...L, headline: x.target.value })} placeholder="Product designer, 8 years" /></Field>
        <Field label="How you can help (one per line, up to 4)"><textarea className="in" rows={3} value={L.help} onChange={(x) => setL({ ...L, help: x.target.value })} placeholder={'Review your portfolio\nPlan a career switch'} /></Field>
        <Field label="Skills (comma separated)"><input className="in" value={L.tags} onChange={(x) => setL({ ...L, tags: x.target.value })} placeholder="Figma, UX research" /></Field>
        <label className="check"><input type="checkbox" checked={L.on} onChange={(x) => setL({ ...L, on: x.target.checked })} /><span>List me in Find a mentor</span></label>
        <div className="row-btns"><button className="btn go" disabled={busy === 'ls'}>Save</button></div></form></section>}
    {e.upcoming.length ? <section className="card"><div className="ch"><h3>Coming sessions</h3></div>{e.upcoming.map((u) => <div key={u.code} className="mrow"><span className="ni bg-o"><I n="clock" /></span><div className="t"><b>{u.name}</b><span>{when(u.at)}</span></div></div>)}</section> : null}
  </>)
}

function SignaturePad({ onDone }) {
  const c = useRef(null), drawing = useRef(false), [has, setHas] = useState(false)
  useEffect(() => { const x = c.current.getContext('2d'); x.lineWidth = 2.6; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#1b3a8a' }, [])
  const pos = (ev) => { const r = c.current.getBoundingClientRect(); return [((ev.clientX - r.left) / r.width) * c.current.width, ((ev.clientY - r.top) / r.height) * c.current.height] }
  return (<div className="sigpad"><canvas ref={c} width={460} height={130} onPointerDown={(ev) => { drawing.current = true; c.current.setPointerCapture(ev.pointerId); const [a, b] = pos(ev); const x = c.current.getContext('2d'); x.beginPath(); x.moveTo(a, b) }}
    onPointerMove={(ev) => { if (!drawing.current) return; const [a, b] = pos(ev); const x = c.current.getContext('2d'); x.lineTo(a, b); x.stroke(); setHas(true) }} onPointerUp={() => { drawing.current = false }} aria-label="Draw your signature" />
    <div className="row-btns"><button type="button" className="btn sm" onClick={() => { c.current.getContext('2d').clearRect(0, 0, 460, 130); setHas(false) }}>Clear</button><button type="button" className="btn sm go" disabled={!has} onClick={() => onDone(c.current.toDataURL('image/png'))}>Use this signature</button></div></div>)
}
function Certs({ e, pro, busy, run, setToast }) {
  const [b, setB] = useState({ org: e.brand.org, variant: e.brand.variant }), [sig, setSig] = useState(undefined), [list, setList] = useState(null)
  const certMeetings = e.meetings
  return (<>
    <section className="card"><div className="ch"><h3>Your certificate</h3></div>
      <p className="dim" style={{ marginTop: 0 }}>Every certificate has its own code and a page anyone can check. It shows your establishment, your signature, the OLEXWEB ✓ VERIFIED seal and “Powered by Olexweb Meet”.</p>
      <form className="stack" onSubmit={(x) => { x.preventDefault(); run('brand', () => earnApi({ action: 'cert-brand', org: b.org, variant: b.variant, ...(sig !== undefined ? { signature: sig } : {}) }), 'Saved.').then(() => setSig(undefined)) }}>
        <Field label="Establishment name (shown at the top)"><input className="in" maxLength={70} value={b.org} onChange={(x) => setB({ ...b, org: x.target.value })} placeholder="Adeola Bankole Design Academy" /></Field>
        <div className="fld"><span>Design</span><div className="variants">{VARIANTS.map(([v, l]) => <button key={v} type="button" className={'variant ' + v + (b.variant === v ? ' on' : '')} aria-pressed={b.variant === v} onClick={() => setB({ ...b, variant: v })}><i />{l}</button>)}</div></div>
        <div className="fld"><span>Signature {e.brand.signature && sig === undefined ? '(saved)' : sig ? '(new, not saved yet)' : ''}</span><SignaturePad onDone={(d) => { setSig(d); setToast('Signature ready. Press Save.') }} />{e.brand.signature ? <button type="button" className="lnk" onClick={() => setSig(null)}>Remove my signature</button> : null}</div>
        <div className="row-btns"><button className="btn go" disabled={busy === 'brand'}>Save</button></div></form></section>
    <section className="card"><div className="ch"><h3>Per meeting</h3></div>
      <p className="dim" style={{ marginTop: 0 }}>Turn certificates on when you schedule. Here you choose the award and, as a Pro host, a price (people pay before theirs opens; Olexweb keeps 5%, you pay Paystack’s fee).</p>
      {certMeetings.filter((m) => m.certs).length ? certMeetings.filter((m) => m.certs).map((m) => <CertRow key={m.code} m={m} pro={pro} run={run} busy={busy} onList={async () => { try { setList({ m, certs: (await earnApi({ action: 'cert-list', code: m.code })).certs }) } catch (x) { setToast(x.message) } }} />)
        : <Empty icon="cert" title="No certificate meetings coming">Tick “Certificates” when you schedule a meeting.</Empty>}</section>
    {list ? <Sheet title={`Certificates: ${list.m.title}`} onClose={() => setList(null)} wide>{list.certs.length ? list.certs.map((c) => <div key={c.serial} className="mrow wrap-sm"><div className="t"><b>{c.name}</b><span>{c.serial} · {c.award}{c.paid ? ' · paid' : ''}</span></div>
      <select className="in sm" value={c.award} onChange={async (x) => { await run('aw', () => earnApi({ action: 'cert-award', serial: c.serial, award: x.target.value }), 'Changed.'); setList({ ...list, certs: list.certs.map((y) => y.serial === c.serial ? { ...y, award: x.target.value } : y) }) }}>{AWARDS.map((a) => <option key={a}>{a}</option>)}</select>
      <a className="btn sm" href={`/meet/v/${c.serial}`} target="_blank" rel="noopener">View</a></div>) : <p className="dim">None given yet.</p>}</Sheet> : null}
  </>)
}
function CertRow({ m, pro, run, busy, onList }) {
  const [p, setP] = useState(m.certPrice || ''), [a, setA] = useState(m.certAward || 'Attendance')
  return (<div className="mrow wrap-sm"><span className="ni bg-y"><I n="cert" /></span><div className="t"><b>{m.title}</b><span>{m.at ? when(m.at) : 'Not scheduled'}</span></div>
    <div className="acts"><select className="in sm" value={a} onChange={(x) => setA(x.target.value)}>{AWARDS.map((w) => <option key={w}>{w}</option>)}</select>
      <input className="in sm" style={{ width: 110 }} type="number" min={0} placeholder={pro ? 'Free' : 'Free (Pro to charge)'} disabled={!pro} value={p} onChange={(x) => setP(x.target.value)} aria-label="Price" />
      <button className="btn sm go" disabled={busy === 'c' + m.code} onClick={() => run('c' + m.code, () => earnApi({ action: 'cert-meeting', code: m.code, price: Number(p) || 0, award: a }), 'Saved.')}>Save</button><button className="btn sm" onClick={onList}>Issued</button></div></div>)
}

function Invite({ e, h, setToast }) {
  const c = e.credits, link = h ? h.community.invite : ''
  return (<>
    <section className="earnhero"><div><span className="pill dark"><i />Invite and earn</span><h2 style={{ marginTop: 12 }}>15% of your friends’ Pro payments</h2>
      <p style={{ opacity: .8 }}>Everyone who joins through your link and pays for Pro earns you 15% of every Pro payment they make in their first 6 months. Each payment’s 15% can be paid out 14 days later, on the next Monday, once ₦1,000 or more is ready.</p>
      <div className="reflink"><code>{link}</code><button className="btn sm go" onClick={async () => { await copyText(link); setToast('Invite link copied.') }}>Copy</button></div></div>
      <div className="bankbox"><small>Waiting</small><b>{kobo(c.waitingKobo)}</b><small>Paid so far {kobo(c.paidKobo)}</small>{!e.payout || !e.payout.transfers ? <small>Add (or re-add) your bank in Overview to get paid.</small> : null}</div></section>
    <div className="rules">
      <div className="rule"><b>10 invites in 15 days</b><p>Ten people you invite host their first meeting within 15 days: the Super connector badge, a week in the spotlight and a day of Pro, free.</p></div>
      <div className="rule"><b>Ambassador of the month</b><p>The person whose invites brought the most new hosts last month (at least 3) wins a cash prize of {kobo((c.prize || 0) * 100)}, when their invitees’ payments that month cover it. Otherwise: the Ambassador badge and a week in the spotlight.</p></div>
      <div className="rule"><b>Your friend gets a free Pro meeting</b><p>When they’ve hosted 3 meetings with people in them. Everyone gets this once.</p></div>
      <div className="rule"><b>Fair play</b><p>Inviting yourself, fake accounts or paying people to sign up cancels the rewards involved.</p></div>
    </div>
    <section className="card"><div className="ch"><h3>Your rewards</h3></div>{c.items.length ? c.items.map((x, i) => <div key={i} className="mrow"><span className="ni bg-g"><I n="coin" /></span><div className="t"><b>{x.note}</b><span>{day(x.at)} · {x.status === 'paid' ? 'paid ' + day(x.paidAt) : x.status === 'sending' ? 'on its way' : x.availableAt && new Date(x.availableAt) > new Date() ? 'ready from ' + day(x.availableAt) : 'waiting for Monday'}</span></div><b className="amtsm">{kobo(x.amountKobo)}</b></div>)
      : <Empty icon="gift" title="Nothing yet">Share your link. Rewards show here, to the kobo.</Empty>}</section>
  </>)
}
