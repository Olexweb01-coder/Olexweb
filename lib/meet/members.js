// Memberships (Install 58): people pay a Pro host every month for what the host promised (members-only meetings, free
// entry to paid meetings, a discount on sessions and bundles, a Member badge). Olexweb keeps 7% (platform management);
// the host pays Paystack's fee. The promise is checked by Olexweb, not typed by the host:
//   • the membership page shows "This month: X of Y members-only meetings held";
//   • when a member's month ends and the host held NO members-only meeting in it, that member is not charged: the
//     membership pauses (they keep their access) and starts again, with a charge, when the host holds one.
// Charges happen once per month per member, with the card they paid with (Paystack charge_authorization). A card that
// can't be charged again (bank transfer, USSD) gets a pay link instead. A member can cancel any time and keeps access
// until the end of the month they paid for. A row is claimed before it's charged (status 'renewing'), so two runs can
// never charge the same person twice.
import 'server-only'
import { randomBytes } from 'node:crypto'
import { q, one } from './db'
import { Refused } from '@/lib/admin/content'
import { planOf, ps, notice, paystackReady, pricing, confirmPayment } from './plans'
import { PCT, kobo, share, naira } from './money'
import { send as sendEmail, emailReady } from './email'

const clean = (s, n) => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, n)
// who can get in: paid up (a day's grace while the 10-minute run renews them), being charged right now, or paused (the host
// owes them a meeting, so they keep their place)
export const ACCESS = "(status in ('renewing', 'paused') or (status = 'active' and (period_start is null or period_end > now() - interval '1 day')))"
const plan = (u) => (u && u.membership) || { on: false, price: 0, perMonth: 2, perks: { free: false, discount: 0 }, line: '' }

// ---------- the host's side ----------
export async function saveMembership(user, b) {
  const on = !!b.on, price = Math.round(Number(b.price) || 0), perMonth = Math.round(Number(b.perMonth) || 0)
  const discount = Math.round(Number(b.perks && b.perks.discount) || 0), free = !!(b.perks && b.perks.free), line = clean(b.line, 160)
  if (on) {
    if (!(await pricing()).on || !paystackReady()) throw new Refused('Memberships aren’t open yet.', 403)
    if (!(await planOf(user)).pro) throw new Refused('Memberships are for Pro hosts. Go Pro to turn them on.', 402)
    if (!Number.isSafeInteger(price) || price < 500 || price > 500_000) throw new Refused('A membership can be ₦500 to ₦500,000 a month.')
    if (perMonth < 1 || perMonth > 31) throw new Refused('Promise at least 1 members-only meeting a month (up to 31).')
    if (discount < 0 || discount > 50) throw new Refused('A members’ discount can be 0% to 50%.')
    const u = await one('select payout, handle from meet_users where id = $1', [user.id])
    if (!u.payout) throw new Refused('Add your bank first, so membership payments reach you.')
    if (!u.handle) throw new Refused('Choose a profile name first: your membership page lives at your profile.')
  }
  const was = plan(await one('select membership from meet_users where id = $1', [user.id]))
  await q('update meet_users set membership = $2 where id = $1', [user.id, JSON.stringify({ on, price: on ? price : was.price, perMonth: on ? perMonth : was.perMonth, perks: { free, discount }, line })])
  if (was.on && !on) {                                                         // switched off: nobody is charged again
    const rows = (await q("update meet_members set cancel_at_end = true where host_user = $1 and status in ('active', 'renewing', 'paused') returning user_id", [user.id])).rows
    for (const r of rows) await notice(r.user_id, 'A membership is ending', 'The host stopped memberships. You won’t be charged again, and you keep access until your paid month ends.')
  }
  return { ok: true }
}
// how many members-only meetings the host held between two times (the promise, counted by Olexweb)
export async function held(hostId, from, to) {
  return (await one('select count(*)::int as n from meetings where host_user = $1 and members_only and started_at >= $2 and started_at < $3', [hostId, from, to])).n
}
const monthStartLagos = () => one("select (date_trunc('month', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos') as t").then((r) => r.t)

// ---------- the public membership page ----------
export async function membershipOf(handle, viewer = null) {
  const u = await one('select id, name, handle, picture, membership, payout, public from meet_users where lower(handle) = lower($1) and banned_at is null', [String(handle || '').slice(0, 40)])
  const m = plan(u)
  if (!u || !m.on || !u.payout || !(await planOf({ id: u.id })).pro) return null
  const from = await monthStartLagos(), [count, mine] = await Promise.all([one(`select count(*)::int as n from meet_members where host_user = $1 and (${ACCESS})`, [u.id]),
    viewer ? one('select status, period_end, cancel_at_end, price from meet_members where host_user = $1 and user_id = $2', [u.id, viewer.id]) : null])
  return { host: { name: u.name, handle: u.handle, picture: u.picture }, price: m.price, perMonth: m.perMonth, perks: m.perks, line: m.line, pct: PCT.membership,
    heldThisMonth: await held(u.id, from, new Date()), members: count.n,
    mine: mine && mine.status !== 'pending' ? { status: mine.status, until: mine.period_end && mine.period_end.toISOString(), cancelling: mine.cancel_at_end, price: mine.price } : null }
}
// what a member gets from a host right now ({} when they aren't one)
export async function perksFor(hostId, userId) {
  if (!hostId || !userId) return {}
  const r = await one(`select 1 from meet_members where host_user = $1 and user_id = $2 and (${ACCESS})`, [hostId, userId])
  if (!r) return {}
  const m = plan(await one('select membership from meet_users where id = $1', [hostId]))
  return { member: true, free: !!m.perks.free, discount: Math.min(Math.max(Number(m.perks.discount) || 0, 0), 50) }
}

// ---------- joining, paying, cancelling ----------
export async function join(user, handle, origin, linkId = null) {
  const info = await membershipOf(handle, user)
  if (!info) throw new Refused('This membership isn’t open.', 404)
  const h = await one('select id, payout from meet_users where lower(handle) = lower($1)', [handle])
  if (h.id === user.id) throw new Refused('That’s your own membership.')
  if (!user.email) throw new Refused('Add an email to your account to pay.')
  const cur = await one('select id, status, period_end from meet_members where host_user = $1 and user_id = $2', [h.id, user.id])
  if (cur && ['active', 'renewing'].includes(cur.status) && cur.period_end > new Date()) throw new Refused('You’re already a member.')
  if (cur && cur.status === 'paused') throw new Refused('Your membership is paused because the host hasn’t held a members-only meeting. It starts again when they do.')
  const row = await one(`insert into meet_members (host_user, user_id, status, price) values ($1, $2, 'pending', $3)
    on conflict (host_user, user_id) do update set price = excluded.price, cancel_at_end = false, status = case when meet_members.status in ('ended', 'lapsed', 'pending') then 'pending' else meet_members.status end returning id`, [h.id, user.id, info.price])
  const { startSplit, linkFor } = await import('./earn')
  return startSplit({ kind: 'membership', amount: info.price, sub: h.payout.code, hostUser: h.id, name: user.name, email: user.email, userId: user.id, refId: row.id, linkId: await linkFor(linkId, h.id), origin })
}
// a membership payment was confirmed with Paystack (first month, a renewal, or a pay link): one more month
export async function memberPaid(pay) {
  const d = await ps('/transaction/verify/' + encodeURIComponent(pay.reference)).catch(() => null)
  const a = d && d.authorization, card = a && a.reusable && a.authorization_code ? a.authorization_code : null
  const r = await one(`update meet_members set status = 'active', renew_ref = null, charging_at = null,
      period_start = greatest(now(), case when status in ('active', 'renewing') and period_end > now() then period_end else now() end),
      period_end = greatest(now(), case when status in ('active', 'renewing') and period_end > now() then period_end else now() end) + interval '1 month',
      auth_code = coalesce($2, auth_code), auth_email = coalesce($3, auth_email)
    where id = $1 returning host_user, user_id, period_end`, [pay.ref_id, card, (d && d.customer && d.customer.email) || pay.buyer_email || null])
  if (!r) return
  const [h, m] = await Promise.all([one('select name from meet_users where id = $1', [r.host_user]), one('select name from meet_users where id = $1', [r.user_id])])
  const until = r.period_end.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'Africa/Lagos' })
  await notice(r.user_id, `You’re a member of ${h.name}’s community`, `Paid ${naira(kobo(pay.amount))}. Your membership runs to ${until}.${card ? ' It renews by itself; cancel any time.' : ' We’ll send you a link to pay for the next month.'}`)
  await notice(r.host_user, `Membership: ${m.name}`, `${naira(kobo(pay.amount))}, minus Olexweb’s ${pay.pct || PCT.membership}% and Paystack’s fee. Paid to your bank weekly.`)
}
export async function cancel(user, handle) {
  const h = await one('select id from meet_users where lower(handle) = lower($1)', [String(handle || '').slice(0, 40)])
  const r = h && await one("update meet_members set cancel_at_end = true where host_user = $1 and user_id = $2 and status in ('active', 'renewing', 'paused') returning period_end", [h.id, user.id])
  if (!r) throw new Refused('You aren’t a member here.', 404)
  return { ok: true, until: r.period_end && r.period_end.toISOString() }
}
export async function myMemberships(user) {
  const rows = (await q(`select m.status, m.period_end, m.cancel_at_end, m.price, u.name, u.handle from meet_members m join meet_users u on u.id = m.host_user
    where m.user_id = $1 and m.status <> 'pending' order by m.created_at desc limit 50`, [user.id])).rows
  return rows.map((r) => ({ host: r.name, handle: r.handle, status: r.status, until: r.period_end && r.period_end.toISOString(), cancelling: r.cancel_at_end, price: r.price }))
}
export async function myMembers(user) {
  const m = plan(await one('select membership from meet_users where id = $1', [user.id])), from = await monthStartLagos()
  const c = await one(`select count(*) filter (where status in ('active', 'renewing') and period_end > now())::int as active, count(*) filter (where status = 'paused')::int as paused from meet_members where host_user = $1`, [user.id])
  return { ...m, pct: PCT.membership, active: c.active, paused: c.paused, heldThisMonth: await held(user.id, from, new Date()) }
}

// ---------- the monthly charge (every 10 minutes, a few rows at a time) ----------
export async function renewals() {
  if (!(await pricing()).on || !paystackReady()) return { done: 0 }
  // stuck charges (no answer from Paystack for 2 hours): ask Paystack what happened, never charge again blindly
  for (const r of (await q("select id, renew_ref from meet_members where status = 'renewing' and charging_at < now() - interval '2 hours' limit 20")).rows) {
    const res = r.renew_ref ? await confirmPayment(r.renew_ref).catch(() => ({ ok: false })) : { ok: false }
    if (!res.ok) await lapse(r.id, 'We couldn’t take this month’s payment.')
  }
  const due = (await q(`update meet_members set status = 'renewing', charging_at = now() where id in (select id from meet_members where status = 'active' and period_end <= now() order by period_end limit 25 for update skip locked)
    returning *`)).rows
  let done = 0
  for (const r of due) {
    try { await renewOne(r) } catch { await q("update meet_members set status = 'active', charging_at = null, renew_ref = null where id = $1 and status = 'renewing' and renew_ref is null", [r.id]) }
    done++
  }
  return { done }
}
async function renewOne(r) {
  const h = await one('select id, name, membership, payout from meet_users where id = $1', [r.host_user]), m = plan(h)
  if (r.cancel_at_end || !m.on || !h.payout || !(await planOf({ id: h.id })).pro) {
    await q("update meet_members set status = 'ended', charging_at = null where id = $1", [r.id])
    await notice(r.user_id, `Your membership with ${h.name} has ended`, r.cancel_at_end ? 'As you asked. You weren’t charged again.' : 'The host stopped offering memberships. You weren’t charged again.')
    return
  }
  // (period_start is empty only right after the host held a members-only meeting that started a paused membership again)
  if (r.period_start && (await held(h.id, r.period_start, r.period_end)) === 0) {   // the promise wasn't kept: no charge
    await q("update meet_members set status = 'paused', charging_at = null where id = $1", [r.id])
    await notice(r.user_id, `Membership paused: no charge`, `${h.name} held no members-only meeting last month, so we didn’t charge you. It starts again when they hold one.`)
    await notice(h.id, 'A member was paused', 'You held no members-only meeting in their month, so they weren’t charged. Hold one to start their membership again.')
    return
  }
  if (!r.auth_code || !r.auth_email) return lapse(r.id, 'Pay for the next month with the link on the membership page.')
  const reference = 'olm_' + randomBytes(9).toString('hex'), charge = share(kobo(r.price), PCT.membership)
  await q(`insert into meet_payments (reference, user_id, kind, amount, provider, buyer_email, pct, olex_kobo, host_user, ref_id) values ($1, $2, 'membership', $3, 'paystack', $4, $5, $6, $7, $8)`,
    [reference, r.user_id, r.price, r.auth_email, PCT.membership, charge, h.id, r.id])
  await q('update meet_members set renew_ref = $2 where id = $1', [r.id, reference])   // from here on, only Paystack's answer decides
  const d = await ps('/transaction/charge_authorization', { email: r.auth_email, amount: kobo(r.price), authorization_code: r.auth_code, reference, currency: 'NGN',
    subaccount: h.payout.code, transaction_charge: charge, bearer: 'subaccount', metadata: { kind: 'membership' } }).catch(() => null)
  if (d && d.status === 'success') { await confirmPayment(reference); return }
  if (d && d.status === 'failed') return lapse(r.id, 'Your card was declined for this month’s payment.')
  // anything else: Paystack's webhook (or the 2-hour check above) finishes it
}
async function lapse(id, why) {
  const r = await one("update meet_members set status = 'lapsed', charging_at = null, renew_ref = null where id = $1 and status in ('renewing', 'active') returning user_id, host_user", [id])
  if (!r) return
  const h = await one('select name, handle from meet_users where id = $1', [r.host_user]), u = await one('select email, name from meet_users where id = $1', [r.user_id])
  const { meetBase, mainOrigin } = await import('@/lib/site/meet'), link = `${meetBase() || mainOrigin()}/meet/h/${h.handle}/join`
  await notice(r.user_id, `Your membership with ${h.name} needs paying`, why, link)
  if (u.email && emailReady()) await sendEmail({ to: u.email, kind: 'meet-membership', subject: `Your membership with ${h.name}`, text: `Hi ${u.name},\n\n${why}\nRenew here: ${link}\n\nOlexweb Meet`, html: `<p>Hi ${u.name},</p><p>${why}</p><p><a href="${link}">Renew your membership</a></p><p>Olexweb Meet</p>` }).catch(() => {})
}
// a host holds a members-only meeting: paused members start again (their charge runs in the next few minutes)
export async function resumePaused(hostId) {
  const rows = (await q("update meet_members set status = 'active', period_start = null, period_end = now() where host_user = $1 and status = 'paused' and not cancel_at_end returning user_id", [hostId])).rows
  for (const r of rows) await notice(r.user_id, 'Your membership is back on', 'The host held a members-only meeting, so your membership starts again and this month is charged now.')
  await q("update meet_members set status = 'ended' where host_user = $1 and status = 'paused' and cancel_at_end", [hostId])
  return rows.length
}
