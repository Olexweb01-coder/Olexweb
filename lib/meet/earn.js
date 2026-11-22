// Hosts earning on Olexweb Meet (Install D): paid meetings (tickets) and one-on-one mentorship sessions. Payments go
// through Paystack straight to the host's bank (a Paystack subaccount), and Olexweb keeps 5% automatically. These only
// run while pricing is on and Paystack is set up.
import 'server-only'
import { randomBytes } from 'node:crypto'
import { q, one } from './db'
import { Refused } from '@/lib/admin/content'
import { pricing, paystackReady, ps, notice, naira } from './plans'
import { send as sendEmail, emailReady } from './email'
import { limit, clientIp } from './limit'
import { PCT, kobo, share } from './money'

export const FEE = PCT.ticket                                                   // Olexweb's share, in percent (lib/meet/money.js)
const clean = (s, n) => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, n)
const EMAIL = /^[^\s@<>]{1,64}@[^\s@<>]{1,190}\.[a-z]{2,24}$/i
const lagos = (d) => new Date(d).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' }) + ' (Lagos time)'
async function ready() {
  if (!(await pricing()).on) throw new Refused('Paid meetings aren’t open yet.', 403)
  if (!paystackReady()) throw new Refused('Payments aren’t set up yet.', 503)
}

// ---------- the host's bank (once) ----------
let BANKS = null
export async function banks() {
  await ready()
  if (!BANKS || BANKS.at < Date.now() - 864e5) BANKS = { at: Date.now(), list: (await ps('/bank?currency=NGN&perPage=200')).filter((b) => b.active !== false).map((b) => ({ code: b.code, name: b.name })) }
  return BANKS.list
}
export async function setPayout(user, { bankCode, accountNumber }) {
  await ready()
  const num = String(accountNumber || '').replace(/\D/g, ''), code = String(bankCode || '').replace(/[^\w-]/g, '').slice(0, 20)
  if (num.length !== 10 || !code) throw new Refused('Choose your bank and type your 10-digit account number.')
  const acc = await ps(`/bank/resolve?account_number=${num}&bank_code=${encodeURIComponent(code)}`).catch(() => null)
  if (!acc || !acc.account_name) throw new Refused('That account couldn’t be found. Check the number and the bank.')
  const bank = (await banks()).find((b) => b.code === code)
  const cur = await one('select payout, name from meet_users where id = $1', [user.id])
  // percentage_charge is only Paystack's default: every sale sets Olexweb's exact share itself (transaction_charge)
  const body = { business_name: clean(cur.name || acc.account_name, 80), settlement_bank: code, account_number: num, percentage_charge: FEE, settlement_schedule: 'weekly' }
  const sub = await ps('/subaccount', body)                                    // a changed bank gets a fresh subaccount
  await ps('/subaccount/' + encodeURIComponent(sub.subaccount_code), { settlement_schedule: 'weekly' }, 'PUT').catch(() => {})   // paid out weekly
  // the same bank receives what Olexweb pays them (30% invite share, ambassador prize) by Paystack Transfer; a Starter
  // business can't make transfers yet, so this may fail now and is made on the first Monday after the upgrade (payouts.js)
  const rcp = await ps('/transferrecipient', { type: 'nuban', name: acc.account_name, account_number: num, bank_code: code, currency: 'NGN' }).catch(() => null)
  await q('update meet_users set payout = $2, recipient = $3 where id = $1', [user.id, JSON.stringify({ code: sub.subaccount_code, bankName: bank ? bank.name : '', accountName: acc.account_name, last4: num.slice(-4) }), (rcp && rcp.recipient_code) || null])
  return { ok: true, accountName: acc.account_name }
}

// ---------- tickets for a paid meeting ----------
export async function setPrice(user, code, price) {
  const p = Math.round(Number(price) || 0)
  if (p && (p < 100 || p > 5_000_000)) throw new Refused('A ticket can be ₦100 to ₦5,000,000, or free.')
  const m = await one('select host_user, started_at from meetings where code = $1', [String(code || '')])
  if (!m || Number(m.host_user) !== Number(user.id)) throw new Refused('Choose one of your meetings.', 404)
  if (p) { await ready(); const u = await one('select payout from meet_users where id = $1', [user.id]); if (!u.payout) throw new Refused('Add your bank first, so ticket money reaches you.') }
  await q('update meetings set price = $2 where code = $1', [code, p])
  return { ok: true, price: p }
}
export async function buyTicket({ code, name, email }, origin, buyer = null, linkId = null) {
  await limit('ticket:' + clientIp(), 10, 600); await ready()
  const n = clean(name, 60), e = String(email || '').trim().toLowerCase().slice(0, 200)
  if (!n) throw new Refused('Type your name.')
  if (!EMAIL.test(e)) throw new Refused('That email doesn’t look right.')
  const m = await one('select m.code, m.title, m.price, m.ended_at, m.host_user, u.payout from meetings m join meet_users u on u.id = m.host_user where m.code = $1', [String(code || '')])
  if (!m || m.ended_at || !m.price || !m.payout) throw new Refused('This meeting isn’t selling tickets.', 404)
  if (buyer && (await (await import('./members')).perksFor(m.host_user, buyer.id)).free) throw new Refused('You’re a member: you get in free. Sign in and join.')
  return startSplit({ kind: 'ticket', code: m.code, amount: m.price, sub: m.payout.code, hostUser: m.host_user, name: n, email: e, userId: buyer ? buyer.id : null, linkId: await linkFor(linkId, m.host_user), origin })
}
// One sale that goes to a host: Olexweb's exact share is set on the payment itself (transaction_charge, in kobo), and the
// host's subaccount pays Paystack's fee (bearer). Nothing is worked out later: the row keeps the numbers it was sold at.
export async function startSplit({ kind, fee = kind, code = null, amount, sub, hostUser, name, email, userId = null, bookingId = null, refId = null, seats = 1, linkId = null, via = null, identity = null, origin, extra = {} }) {
  const amt = Math.round(Number(amount))
  if (!Number.isSafeInteger(amt) || amt < 100) throw new Refused('That price isn’t valid.')
  if (!sub || !hostUser) throw new Refused('This host can’t take payments yet.')
  const pct = PCT[fee], charge = share(kobo(amt), pct), reference = 'olm_' + randomBytes(9).toString('hex')
  await q(`insert into meet_payments (reference, user_id, kind, code, amount, provider, buyer_name, buyer_email, booking_id, pct, olex_kobo, host_user, link_id, via, ref_id, seats, identity)
    values ($1, $2, $3, $4, $5, 'paystack', $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`, [reference, userId, kind, code, amt, name, email, bookingId, pct, charge, hostUser, linkId, via, refId, seats, identity])
  const d = await ps('/transaction/initialize', { email, amount: kobo(amt), currency: 'NGN', reference, subaccount: sub, transaction_charge: charge, bearer: 'subaccount',
    callback_url: `${origin}/api/meet/pay?reference=${reference}`, metadata: { kind, code, ...extra } })
  return { url: d.authorization_url, reference }
}
// a ticket's key lets that person in (it comes back with them from Paystack, and by email)
export async function passOk(code, pass) {
  if (pass && String(pass).length !== 22) { const { entryFor } = await import('./entry'); const e = await entryFor(code, pass); return !!(e && e.t === 'meet_passes') }   // Install 58l: a ticket's entry code
  if (!pass || String(pass).length !== 22) return false
  if (await one("select 1 from meet_payments where kind = 'ticket' and status = 'paid' and code = $1 and pass = $2", [code, String(pass)])) return true   // tickets sold before Install 58
  return !!(await one('select 1 from meet_passes p where p.pass = $2 and (p.code = $1 or p.bundle_id in (select bundle_id from meet_bundle_items where code = $1))', [code, String(pass)]))
}
// a tracked link counts only for the host who made it (the cookie can't move a sale to someone else)
export async function linkFor(id, hostUser) {
  const n = Number(id) || 0; if (!n) return null
  const l = await one('select id from meet_links where id = $1 and host_user = $2', [n, hostUser])
  return l ? l.id : null
}
const newPass = () => randomBytes(16).toString('base64url')
async function makePasses(pay, code, bundleId) {
  const have = (await q('select pass from meet_passes where payment_id = $1 order by created_at, pass', [pay.id])).rows.map((r) => r.pass)
  for (let i = have.length; i < Math.max(1, pay.seats || 1); i++) { const p = newPass(); await q('insert into meet_passes (pass, payment_id, code, bundle_id) values ($1, $2, $3, $4)', [p, pay.id, code, bundleId]); have.push(p) }
  return have
}
// called once a ticket or booking payment is confirmed (lib/meet/plans.js applyPayment)
export async function paidFor(pay) {
  if (pay.kind === 'ticket') {
    const [pass] = await makePasses(pay, pay.code, null)
    await q('update meet_payments set pass = $2 where id = $1', [pay.id, pass])          // the return page sends them straight in
    const m = await one('select title, host_user, starts_at from meetings where code = $1', [pay.code])
    if (m && m.host_user) await notice(m.host_user, `Ticket sold: ${naira(pay.amount)}`, `${pay.buyer_name} bought a ticket for “${m.title}”. It goes to your bank, minus Olexweb’s ${pay.pct || FEE}% and Paystack’s fee.`)
    if (pay.buyer_email && emailReady() && m) {
      const link = (await import('@/lib/site/meet')).meetLink(pay.code) + '?pass=' + pass
      const { entryOfPass, showEntry } = await import('./entry'), code8 = showEntry(await entryOfPass(pass))   // Install 58l: the short entry code too
      const E = (x) => String(x || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
      await sendEmail({ to: pay.buyer_email, kind: 'meet-ticket', subject: `Your ticket: ${m.title}`, text: `Hi ${pay.buyer_name},\n\nYour ticket for “${m.title}”${m.starts_at ? ' on ' + lagos(m.starts_at) : ''} is confirmed.\nYour entry code: ${code8} (just for you; it works for the whole meeting, even if you drop out and come back).\nOr use your own link (don’t share it): ${link}\n\nOlexweb Meet`,
        html: `<p>Hi ${E(pay.buyer_name)},</p><p>Your ticket for <b>${E(m.title)}</b>${m.starts_at ? ' on ' + E(lagos(m.starts_at)) : ''} is confirmed.</p><p>Your entry code: <b style="font-size:20px;letter-spacing:2px">${E(code8)}</b><br><small>Just for you. It works for the whole meeting, even if you drop out and come back.</small></p><p>Or <a href="${E(link)}">use your own link to join</a> (don’t share it).</p><p>Olexweb Meet</p>` }).catch(() => {})
    }
  }
  if (pay.kind === 'booking' && pay.booking_id) await confirmBooking(pay.booking_id, true)
  if (pay.kind === 'bundle') await (await import('./bundles')).bundlePaid(pay, makePasses)
  if (pay.kind === 'membership') await (await import('./members')).memberPaid(pay)
  if (pay.kind === 'cert') await (await import('./certs')).certPaid(pay)
}

// ---------- mentorship: one-on-one sessions people book and pay for ----------
const DAYS = [1, 2, 3, 4, 5, 6, 7]                                               // Monday = 1 … Sunday = 7
export async function saveBooking(user, b) {
  const days = (Array.isArray(b.days) ? b.days : []).map(Number).filter((d) => DAYS.includes(d))
  const hm = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || '')) ? s : null
  const from = hm(b.from), to = hm(b.to), minutes = [15, 30, 45, 60, 90].includes(Number(b.minutes)) ? Number(b.minutes) : 45
  const price = Math.round(Number(b.price) || 0)
  if (b.on && (!days.length || !from || !to || from >= to)) throw new Refused('Choose the days and a time window (from earlier to later).')
  if (price && (price < 500 || price > 5_000_000)) throw new Refused('A session can be ₦500 to ₦5,000,000, or free.')
  if (b.on && price && !(await (await import('./plans')).proById(user.id))) throw new Refused('Paid sessions are for Pro hosts. Go Pro, or offer free sessions.', 402)   // Install 58j
  if (b.on && price) { await ready(); const u = await one('select payout from meet_users where id = $1', [user.id]); if (!u.payout) throw new Refused('Add your bank first, so session payments reach you.') }
  const h = await one('select handle from meet_users where id = $1', [user.id])
  if (b.on && !(h && h.handle)) throw new Refused('Choose a profile name first: your booking page lives at your profile.')
  await q('update meet_users set booking = $2 where id = $1', [user.id, JSON.stringify({ on: !!b.on, days, from, to, minutes, price, title: clean(b.title, 80) || 'Mentorship session' })])
  return { ok: true }
}
// the next 14 days of free slots, in Lagos time (UTC+1)
export async function slots(handle) {
  const u = await one('select id, name, handle, picture, bio, booking, public from meet_users where lower(handle) = lower($1) and banned_at is null', [String(handle || '').slice(0, 40)])
  if (!u || !u.booking || !u.booking.on) return null
  const b = u.booking, taken = new Set((await q("select starts_at from meet_bookings where mentor = $1 and starts_at > now() and (status = 'confirmed' or (status = 'pending' and created_at > now() - interval '30 minutes'))", [u.id])).rows.map((r) => r.starts_at.getTime()))
  const out = [], now = Date.now() + 2 * 3600_000, [fh, fm] = b.from.split(':').map(Number), [th, tm] = b.to.split(':').map(Number)
  for (let d = 0; d < 14; d++) {
    const day = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + d)), dow = ((day.getUTCDay() + 6) % 7) + 1
    if (!b.days.includes(dow)) continue
    for (let t = fh * 60 + fm; t + b.minutes <= th * 60 + tm; t += b.minutes) {
      const at = day.getTime() + (t - 60) * 60_000                               // Lagos is UTC+1, all year
      if (at > now && !taken.has(at)) out.push(new Date(at).toISOString())
    }
  }
  return { mentor: { name: u.name, handle: u.handle, picture: u.picture, bio: u.bio }, title: b.title, minutes: b.minutes, price: b.price, slots: out.slice(0, 120) }
}
export async function book(user, handle, startsAt, origin, via = null, linkId = null) {
  await limit('book:' + user.id, 10, 3600)
  const s = await slots(handle)
  if (!s) throw new Refused('Bookings aren’t open here.', 404)
  if (!s.slots.includes(new Date(startsAt).toISOString())) throw new Refused('That time isn’t free any more. Choose another.')
  const mentor = await one('select id, payout, mentor from meet_users where lower(handle) = lower($1)', [handle])
  if (mentor.id === user.id) throw new Refused('That’s your own booking page.')
  if (s.price && !(await (await import('./plans')).proById(mentor.id))) throw new Refused('This mentor isn’t taking paid bookings right now.', 403)   // Install 58j: their Pro ended
  const dir = via === 'directory' && !!(mentor.mentor && mentor.mentor.on)          // found through Find a mentor: Olexweb keeps 10%
  // a booking nobody paid for within 30 minutes gives its time back
  await q("update meet_bookings set status = 'cancelled' where mentor = $1 and starts_at = $2 and status = 'pending' and created_at <= now() - interval '30 minutes'", [mentor.id, startsAt])
  let b; try { b = await one('insert into meet_bookings (mentor, mentee, starts_at, minutes, via) values ($1, $2, $3, $4, $5) returning id', [mentor.id, user.id, startsAt, s.minutes, dir ? 'directory' : null]) }
  catch { throw new Refused('Someone just booked that time. Choose another.') }
  if (s.price) {
    await ready()
    if (!user.email) throw new Refused('Add an email to your account to pay.')
    if (!mentor.payout) throw new Refused('This mentor can’t take payments yet.')
    const perks = await (await import('./members')).perksFor(mentor.id, user.id)
    const { discounted } = await import('./money')
    const amount = perks.discount ? discounted(s.price, perks.discount) : s.price
    return startSplit({ kind: 'booking', fee: dir ? 'directory' : 'booking', amount, sub: mentor.payout.code, hostUser: mentor.id, name: user.name, email: user.email, userId: user.id, bookingId: b.id, via: dir ? 'directory' : null, linkId: await linkFor(linkId, mentor.id), origin })
  }
  return { ok: true, ...(await confirmBooking(b.id)) }
}
export async function confirmBooking(id, paid = false) {
  let b = await one("update meet_bookings set status = 'confirmed' where id = $1 and status = 'pending' returning *", [id])
  // paid after its 30 minutes ran out: still theirs if nobody else took the time; if someone did, you refund them
  if (!b && paid) b = await one(`update meet_bookings set status = 'confirmed' where id = $1 and status = 'cancelled'
    and not exists (select 1 from meet_bookings o where o.mentor = meet_bookings.mentor and o.starts_at = meet_bookings.starts_at and o.status <> 'cancelled' and o.id <> $1) returning *`, [id]).catch(() => null)
  if (!b && paid) {
    const x = await one("select status from meet_bookings where id = $1", [id])
    if (x && x.status !== 'confirmed') { const { notify } = await import('@/lib/assistant/notify'); await notify('support', `A mentorship booking (#${id}) was paid after someone else took that time. Refund the payer in Paystack.`, '/admin/meetings#business').catch(() => {}) }
    return {}
  }
  if (!b) return {}
  const [mentor, mentee] = await Promise.all([one('select name, booking from meet_users where id = $1', [b.mentor]), one('select name, email from meet_users where id = $1', [b.mentee])])
  const { createMeeting, meetLink } = await import('@/lib/site/meet')
  const r = await createMeeting({ title: `${(mentor.booking && mentor.booking.title) || 'Mentorship'}: ${mentee.name}`, startsAt: b.starts_at.toISOString(), minutes: b.minutes, private: true }, null, { hostUser: b.mentor, pushes: false })
  await q('update meet_bookings set code = $2 where id = $1', [b.id, r.code])
  const link = meetLink(r.code), when = lagos(b.starts_at)
  await notice(b.mentor, `New booking: ${mentee.name}`, `${when}. It’s in your meetings.`, link)
  await notice(b.mentee, `Booked with ${mentor.name}`, `${when}. Join with the link when it starts.`, link)
  if (mentee.email && emailReady()) await sendEmail({ to: mentee.email, kind: 'meet-booking', subject: `Booked: ${mentor.name}, ${when}`, text: `You’re booked with ${mentor.name} on ${when}.\nJoin here: ${link}\n\nOlexweb Meet`, html: `<p>You’re booked with <b>${mentor.name}</b> on ${when}.</p><p><a href="${link}">Join the session</a></p><p>Olexweb Meet</p>` }).catch(() => {})
  return { code: r.code, link }
}
// a meeting only members of the host's community can join (Pro hosts with memberships on)
export async function setMembersOnly(user, code, on) {
  const m = await one('select host_user from meetings where code = $1', [String(code || '')])
  if (!m || Number(m.host_user) !== Number(user.id)) throw new Refused('Choose one of your meetings.', 404)
  if (on) { const u = await one('select membership from meet_users where id = $1', [user.id]); if (!(u.membership && u.membership.on)) throw new Refused('Turn memberships on first (Earn → Membership).') }
  await q('update meetings set members_only = $2 where code = $1', [code, !!on])
  return { ok: true }
}
// What a host earned, sale by sale, with the exact split. Sales from before Install 58 were split by Paystack's default
// (Olexweb 5%, Olexweb paid Paystack's fee), so for those the host got exactly 95%.
export async function myEarn(user) {
  const { breakdown, paystackFee, PCT: P } = await import('./money')
  const u = await one('select payout, booking, handle, recipient from meet_users where id = $1', [user.id])
  const rows = (await q(`select p.id, p.kind, p.amount, p.olex_kobo, p.pct, p.via, p.paid_at, p.buyer_name, p.seats from meet_payments p left join meetings m on m.code = p.code and p.host_user is null
      left join meet_bookings b on b.id = p.booking_id and p.host_user is null
    where p.status = 'paid' and p.kind in ('ticket', 'booking', 'bundle', 'membership', 'cert') and (p.host_user = $1 or (p.host_user is null and (m.host_user = $1 or b.mentor = $1)))
    order by p.paid_at desc`, [user.id])).rows
  const sales = rows.map((r) => {
    const price = kobo(r.amount), olexweb = r.olex_kobo != null ? Number(r.olex_kobo) : share(price, P.ticket), paystack = r.olex_kobo != null ? paystackFee(price) : 0
    return { kind: r.kind, via: r.via, buyer: r.buyer_name || '', seats: r.seats, at: r.paid_at && r.paid_at.toISOString(), price, olexweb, paystack, host: price - olexweb - paystack }
  })
  const sum = (k, f = () => true) => sales.filter(f).reduce((t, x) => t + x[k], 0)
  const weekAgo = Date.now() - 7 * 864e5, monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
  const upcoming = (await q(`select b.starts_at, b.code, u.name from meet_bookings b join meet_users u on u.id = b.mentee where b.mentor = $1 and b.status = 'confirmed' and b.starts_at > now() order by b.starts_at limit 10`, [user.id])).rows
  const meetings = (await q('select code, title, starts_at, price, members_only, certs, cert_price, cert_award from meetings where host_user = $1 and ended_at is null order by coalesce(starts_at, created_at) desc limit 50', [user.id])).rows
  const [bundles, links, members, memberOf, credits, listing, brand] = await Promise.all([
    import('./bundles').then((x) => x.myBundles(user)), import('./links').then((x) => x.myLinks(user)), import('./members').then((x) => x.myMembers(user)),
    import('./members').then((x) => x.myMemberships(user)), import('./payouts').then((x) => x.myCredits(user)), import('./mentors').then((x) => x.listingOf(user.id)),
    one('select cert_brand from meet_users where id = $1', [user.id]).then((r) => (r && r.cert_brand) || {})])
  return { payout: u.payout ? { bankName: u.payout.bankName, accountName: u.payout.accountName, last4: u.payout.last4, transfers: !!u.recipient } : null,
    booking: u.booking || { on: false, days: [1, 2, 3, 4, 5], from: '18:00', to: '20:00', minutes: 45, price: 0, title: 'Mentorship session' },
    handle: u.handle, fees: P, example: breakdown(5000, 'ticket'),
    totals: { gross: sum('price'), olexweb: sum('olexweb'), paystack: sum('paystack'), host: sum('host'), count: sales.length,
      week: sum('host', (x) => new Date(x.at).getTime() > weekAgo), month: sum('host', (x) => new Date(x.at).getTime() >= monthStart) },
    sales: sales.slice(0, 40), upcoming: upcoming.map((x) => ({ at: x.starts_at.toISOString(), code: x.code, name: x.name })),
    meetings: meetings.map((m) => ({ code: m.code, title: m.title, at: m.starts_at && m.starts_at.toISOString(), price: m.price, membersOnly: m.members_only, certs: m.certs, certPrice: m.cert_price, certAward: m.cert_award || 'Attendance' })),
    bundles, links, members, memberOf, credits, listing, brand: { org: brand.org || '', variant: brand.variant || 'c1', signature: !!brand.signature },
    // kept for the current dashboard (until the new design replaces it)
    gross: Math.round(sum('price') / 100), net: Math.round(sum('host') / 100), sales_n: sales.length, fee: P.ticket }
}
