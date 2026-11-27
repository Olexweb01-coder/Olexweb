// Install 63: deleting a Meet account, by the person themselves (Settings → Delete my account, typing DELETE).
// What stops it (they're told why, and when they can):
//   - Pro they paid for that is still running (Pro they earned for free doesn't count);
//   - Pro they paid for one meeting that hasn't happened or ended yet;
//   - earnings still waiting to be paid out to them;
//   - things people paid them for that haven't happened yet (a meeting, a session, a membership month);
//   - an unpaid invoice.
// What goes: the account, its sign-ins and sessions, photos and banner, meetings (with their notes, guests, sign-ups,
// certificates, ratings and tickets), bundles, links, memberships, badges, rewards, notices, follows, bookings, support
// tickets and reviews. Payment records stay for the accounts (Paystack disputes and refunds), with the name and email
// taken off and no link to the person. One SQL statement, so it all happens or none of it does.
import 'server-only'
import { q, one } from './db'
import { Refused } from '@/lib/admin/content'

const DAYS = { month: 30, year: 365 }
const day = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' })

// when the Pro they paid for ends: each paid month or year added on in order, as it was given
async function paidProEnd(uid) {
  const rows = (await q("select kind, paid_at from meet_payments where user_id = $1 and status = 'paid' and kind in ('month', 'year') and paid_at is not null order by paid_at", [uid])).rows
  let end = 0
  for (const r of rows) end = Math.max(end, new Date(r.paid_at).getTime()) + DAYS[r.kind] * 86_400_000
  return end
}
export async function deleteBlockers(user) {
  const uid = Number(user.id), now = Date.now(), out = []
  if (user.role === 'owner') return ['This is the site owner’s account, so it can’t be deleted here.']
  const end = await paidProEnd(uid)
  if (end > now) out.push(`You paid for Pro, and it runs until ${day(end)}. You can delete your account after that.`)
  const one1 = await one("select count(*)::int as n from meet_payments p join meetings m on m.code = p.code where p.user_id = $1 and p.kind = 'meeting' and p.status = 'paid' and m.ended_at is null", [uid])
  if (one1.n) out.push('You paid for Pro for a meeting that hasn’t ended yet. Hold or end that meeting first.')
  const owed = await one("select coalesce(sum(amount), 0)::bigint as k from meet_credits where user_id = $1 and status in ('pending', 'sending')", [uid])
  if (Number(owed.k) > 0) out.push(`You have ₦${(Number(owed.k) / 100).toLocaleString('en-NG')} in earnings waiting to be paid to you. Once it’s in your bank, you can delete your account.`)
  const sold = await one(`select
      (select count(*)::int from meet_payments p join meetings m on m.code = p.code where p.host_user = $1 and p.status = 'paid' and m.ended_at is null) as meetings,
      (select count(*)::int from meet_bookings b where (b.mentor = $1 or b.mentee = $1) and b.status not in ('cancelled', 'pending') and b.starts_at > now()) as bookings,
      (select count(*)::int from meet_members x where x.host_user = $1 and x.status in ('active', 'renewing')) as members`, [uid])
  if (sold.meetings) out.push('People have paid for a meeting of yours that hasn’t happened yet. Hold it or end it first.')
  if (sold.bookings) out.push('You have a booked one-on-one session coming up. Hold it or cancel it first.')
  if (sold.members) out.push('Members are paying for your community. Turn memberships off and wait for this month to finish first.')
  const inv = await one('select count(*)::int as n from meet_invoices where user_id = $1 and paid_at is null', [uid])
  if (inv.n) out.push('You have an unpaid invoice. Pay it first.')
  return out
}
export async function deleteAccount(user, confirm) {
  if (String(confirm || '').trim() !== 'DELETE') throw new Refused('Type DELETE in capital letters to confirm.')
  const blockers = await deleteBlockers(user)
  if (blockers.length) throw new Refused(blockers[0], 409)
  const uid = Number(user.id), u = await one('select email from meet_users where id = $1', [uid])
  if (!u) return { ok: true }
  const email = String(u.email || '').toLowerCase()
  await q(`with mine as (select code from meetings where host_user = $1),
    pays as (update meet_payments set user_id = case when user_id = $1 then null else user_id end, host_user = case when host_user = $1 then null else host_user end,
      buyer_name = case when user_id = $1 then null else buyer_name end, buyer_email = case when user_id = $1 or ($2 <> '' and lower(buyer_email) = $2) then null else buyer_email end
      where user_id = $1 or host_user = $1 or ($2 <> '' and lower(buyer_email) = $2) returning 1),
    inv as (update meet_invoices set user_id = null where user_id = $1 returning 1),
    d1 as (delete from meet_regs where code in (select code from mine) or ($2 <> '' and lower(email) = $2) returning 1),
    d2 as (delete from meet_certs where code in (select code from mine) returning 1),
    d3 as (delete from meet_ratings where code in (select code from mine) or user_id = $1 returning 1),
    d4 as (delete from meet_passes where code in (select code from mine) returning 1),
    d5 as (delete from meet_usage where code in (select code from mine) returning 1),
    d6 as (delete from meet_reports where code in (select code from mine) returning 1),
    d7 as (delete from meet_notices where user_id = $1 returning 1),
    d8 as (delete from meet_badges where user_id = $1 returning 1),
    d9 as (delete from meet_rewards where user_id = $1 returning 1),
    d10 as (delete from meet_follows where follower = $1 or host = $1 returning 1),
    d11 as (delete from meet_bookings where mentor = $1 or mentee = $1 returning 1),
    d12 as (delete from meet_tickets where user_id = $1 or ($2 <> '' and lower(email) = $2) returning 1),
    d13 as (delete from meet_codes where $2 <> '' and lower(email) = $2 returning 1),
    d14 as (delete from meet_login_fails where $2 <> '' and lower(email) = $2 returning 1)
    delete from meet_users where id = $1`, [uid, email])   // the account's sign-ins, sessions, meetings (and their guests), bundles, links, memberships, earnings history, spotlight and gifts go with it
  return { ok: true }
}
