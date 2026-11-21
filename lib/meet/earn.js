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

export const FEE = 5                                                           // Olexweb's share, in percent
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
  const body = { business_name: clean(cur.name || acc.account_name, 80), settlement_bank: code, account_number: num, percentage_charge: FEE }
  const sub = await ps('/subaccount', body)                                    // a changed bank gets a fresh subaccount
  await q('update meet_users set payout = $2 where id = $1', [user.id, JSON.stringify({ code: sub.subaccount_code, bankName: bank ? bank.name : '', accountName: acc.account_name, last4: num.slice(-4) })])
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
export async function buyTicket({ code, name, email }, origin) {
  await limit('ticket:' + clientIp(), 10, 600); await ready()
  const n = clean(name, 60), e = String(email || '').trim().toLowerCase().slice(0, 200)
  if (!n) throw new Refused('Type your name.')
  if (!EMAIL.test(e)) throw new Refused('That email doesn’t look right.')
  const m = await one('select m.code, m.title, m.price, m.ended_at, u.payout from meetings m join meet_users u on u.id = m.host_user where m.code = $1', [String(code || '')])
  if (!m || m.ended_at || !m.price || !m.payout) throw new Refused('This meeting isn’t selling tickets.', 404)
  return startSplit({ kind: 'ticket', code: m.code, amount: m.price, sub: m.payout.code, name: n, email: e, origin })
}
async function startSplit({ kind, code = null, amount, sub, name, email, userId = null, bookingId = null, origin }) {
  const reference = 'olm_' + randomBytes(9).toString('hex')
  await q('insert into meet_payments (reference, user_id, kind, code, amount, provider, buyer_name, buyer_email, booking_id) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [reference, userId, kind, code, amount, 'paystack', name, email, bookingId])
  const d = await ps('/transaction/initialize', { email, amount: amount * 100, currency: 'NGN', reference, subaccount: sub, callback_url: `${origin}/api/meet/pay?reference=${reference}`, metadata: { kind, code } })
  return { url: d.authorization_url, reference }
}
// a ticket's key lets that person in (it comes back with them from Paystack, and by email)
export async function passOk(code, pass) {
  if (!pass || String(pass).length !== 22) return false
  return !!(await one("select 1 from meet_payments where kind = 'ticket' and status = 'paid' and code = $1 and pass = $2", [code, String(pass)]))
}
// called once a ticket or booking payment is confirmed (lib/meet/plans.js applyPayment)
export async function paidFor(pay) {
  if (pay.kind === 'ticket') {
    const pass = randomBytes(16).toString('base64url')
    await q('update meet_payments set pass = $2 where id = $1', [pay.id, pass])
    const m = await one('select title, host_user, starts_at from meetings where code = $1', [pay.code])
    if (m && m.host_user) await notice(m.host_user, `Ticket sold: ${naira(pay.amount)}`, `${pay.buyer_name} bought a ticket for “${m.title}”. It goes to your bank, minus Olexweb’s ${FEE}%.`)
    if (pay.buyer_email && emailReady() && m) {
      const link = (await import('@/lib/site/meet')).meetLink(pay.code) + '?pass=' + pass
      await sendEmail({ to: pay.buyer_email, kind: 'meet-ticket', subject: `Your ticket: ${m.title}`, text: `Hi ${pay.buyer_name},\n\nYour ticket for “${m.title}”${m.starts_at ? ' on ' + lagos(m.starts_at) : ''} is confirmed.\nYour own link (don’t share it): ${link}\n\nOlexweb Meet`,
        html: `<p>Hi ${pay.buyer_name},</p><p>Your ticket for <b>${m.title}</b>${m.starts_at ? ' on ' + lagos(m.starts_at) : ''} is confirmed.</p><p><a href="${link}">Your own link to join</a> (don’t share it).</p><p>Olexweb Meet</p>` }).catch(() => {})
    }
  }
  if (pay.kind === 'booking' && pay.booking_id) await confirmBooking(pay.booking_id)
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
export async function book(user, handle, startsAt, origin) {
  await limit('book:' + user.id, 10, 3600)
  const s = await slots(handle)
  if (!s) throw new Refused('Bookings aren’t open here.', 404)
  if (!s.slots.includes(new Date(startsAt).toISOString())) throw new Refused('That time isn’t free any more. Choose another.')
  const mentor = await one('select id, payout from meet_users where lower(handle) = lower($1)', [handle])
  if (mentor.id === user.id) throw new Refused('That’s your own booking page.')
  let b; try { b = await one('insert into meet_bookings (mentor, mentee, starts_at, minutes) values ($1, $2, $3, $4) returning id', [mentor.id, user.id, startsAt, s.minutes]) }
  catch { throw new Refused('Someone just booked that time. Choose another.') }
  if (s.price) {
    await ready()
    if (!user.email) throw new Refused('Add an email to your account to pay.')
    return startSplit({ kind: 'booking', amount: s.price, sub: mentor.payout.code, name: user.name, email: user.email, userId: user.id, bookingId: b.id, origin })
  }
  return { ok: true, ...(await confirmBooking(b.id)) }
}
export async function confirmBooking(id) {
  const b = await one("update meet_bookings set status = 'confirmed' where id = $1 and status = 'pending' returning *", [id])
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
export async function myEarn(user) {
  const u = await one('select payout, booking, handle from meet_users where id = $1', [user.id])
  const sold = await one(`select coalesce(sum(p.amount), 0)::int as gross, count(*)::int as n from meet_payments p left join meetings m on m.code = p.code left join meet_bookings b on b.id = p.booking_id
    where p.status = 'paid' and p.kind in ('ticket', 'booking') and (m.host_user = $1 or b.mentor = $1)`, [user.id])
  const upcoming = (await q(`select b.starts_at, b.code, u.name from meet_bookings b join meet_users u on u.id = b.mentee where b.mentor = $1 and b.status = 'confirmed' and b.starts_at > now() order by b.starts_at limit 10`, [user.id])).rows
  return { payout: u.payout ? { bankName: u.payout.bankName, accountName: u.payout.accountName, last4: u.payout.last4 } : null, booking: u.booking || { on: false, days: [1, 2, 3, 4, 5], from: '18:00', to: '20:00', minutes: 45, price: 0, title: 'Mentorship session' },
    handle: u.handle, gross: sold.gross, net: Math.round(sold.gross * (100 - FEE) / 100), sales: sold.n, fee: FEE, upcoming: upcoming.map((x) => ({ at: x.starts_at.toISOString(), code: x.code, name: x.name })) }
}
