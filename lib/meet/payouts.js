// Money Olexweb pays people (Install 58), sent every Monday from Olexweb's Paystack balance by Paystack Transfer:
//   • 3% of a referred person's FIRST Pro payment, to whoever invited them (once per referred person);
//   • the Ambassador of the month: the person whose invites brought the most new hosts last month (at least 3) gets 10%
//     of what those invitees paid Olexweb last month, at most ₦50,000. If their invitees paid nothing: a week of Pro.
// Plus, not cash: 5 invites that became hosts within 15 days = a week of Pro and a week in the spotlight.
// Each credit has a unique ref, so it can only ever be created once. On Monday the pending credits of each person are
// claimed (status 'sending') under one transfer reference before Paystack is asked, and they only go back to 'pending'
// once Paystack says that transfer failed or never existed: nobody can be paid twice.
import 'server-only'
import { randomBytes } from 'node:crypto'
import { q, one } from './db'
import { notice, pricing, paystackReady } from './plans'
import { INVITE_PCT, INVITE_MONTHS, HOLD_DAYS, AMBASSADOR, PAYOUT_MIN, kobo, share, naira, paystackFee } from './money'

const PS = () => process.env.PAYSTACK_API_BASE || 'https://api.paystack.co'
async function credit(userId, kind, amount, ref, note, holdDays = 0) {
  if (!(amount > 0)) return null
  const r = await one(`insert into meet_credits (user_id, kind, amount, ref, note, available_at) values ($1, $2, $3, $4, $5, now() + ($6 || ' days')::interval) on conflict (ref) do nothing returning id`, [userId, kind, amount, ref, note, String(holdDays)])
  return r && r.id
}

// ---------- 30% of a referred person's Pro payments, for their first 12 months (Install 58f) ----------
// One credit per Pro payment (its own ref, so never twice). It can be paid out 14 days later, so a refunded payment can be
// caught first (a refund before then cancels it). Commission always comes out of a payment Olexweb already received.
export async function inviteCredit(pay) {
  if (!['month', 'year'].includes(pay.kind) || !pay.user_id) return
  const u = await one('select referred_by, name from meet_users where id = $1', [pay.user_id]); if (!u || !u.referred_by || Number(u.referred_by) === Number(pay.user_id)) return
  const first = await one("select paid_at from meet_payments where user_id = $1 and kind in ('month', 'year') and status = 'paid' order by paid_at, id limit 1", [pay.user_id])
  const at = await one('select paid_at from meet_payments where id = $1', [pay.id])
  if (!first || !at || at.paid_at > new Date(first.paid_at.getTime() + INVITE_MONTHS * 30.44 * 864e5)) return   // only within their first 12 months
  const amount = share(kobo(pay.amount), INVITE_PCT)
  if (await credit(u.referred_by, 'invite', amount, 'invite:' + pay.id, `${INVITE_PCT}% of ${u.name || 'a friend'}’s Pro payment`, HOLD_DAYS))
    await notice(u.referred_by, `You earned ${naira(amount)}`, `${u.name || 'Someone you invited'} paid for Pro. Your ${INVITE_PCT}% can be paid out from ${HOLD_DAYS} days after their payment, on the next Monday (once ₦1,000 or more is ready).`)
}
// a refunded Pro payment: its commission is cancelled if it hasn't gone out yet
export async function inviteRefunded(paymentId) {
  return (await q("update meet_credits set status = 'cancelled' where ref = $1 and status = 'pending' returning id", ['invite:' + paymentId])).rows.length
}

// ---------- 5 invites that became hosts within 15 days: a week of Pro and the spotlight ----------
export async function inviteCounted(inviterId) {
  const five = (await q(`with pick as (select id from meet_users where referred_by = $1 and ref_done and not ref_five and ref_done_at > now() - interval '15 days' order by ref_done_at limit 5 for update)
    update meet_users set ref_five = true where id in (select id from pick) and (select count(*) from pick) = 5 returning id`, [inviterId])).rows
  if (five.length !== 5) return false
  const { reward } = await import('./community')
  await reward(inviterId, 'five:' + five.map((r) => r.id).sort((a, b) => a - b).join('-'), 7, '5 invites in 15 days: a week of Pro 🎉', 'Five people you invited became hosts. Enjoy a week of Pro, and a week in the spotlight on Olexweb Meet.')
  await q("insert into meet_spot (user_id, reason, until) values ($1, '5 invites in 15 days', now() + interval '7 days')", [inviterId])
  return true
}
export async function spots() {
  return (await q(`select u.name, u.handle, u.picture, s.reason from meet_spot s join meet_users u on u.id = s.user_id where s.until > now() and u.public and u.handle is not null and u.banned_at is null order by s.created_at desc limit 6`)).rows
}

// ---------- Ambassador of the month (run on the 1st, for last month) ----------
export async function ambassador(month) {                                     // month: 'YYYY-MM'
  const from = month + '-01'
  const top = await one(`select referred_by as id, count(*)::int as n, max(ref_done_at) as last from meet_users
    where referred_by is not null and ref_done and ref_done_at >= $1::date and ref_done_at < ($1::date + interval '1 month') and banned_at is null
    group by referred_by having count(*) >= $2 order by n desc, last asc limit 1`, [from, AMBASSADOR.minInvites])
  if (!top) return null
  const u = await one('select name, handle, public, banned_at from meet_users where id = $1', [top.id]); if (!u || u.banned_at) return null
  // what Olexweb kept last month from this person's invitees: their payments, minus Paystack's fee, minus commissions owed on them
  const pays = (await q(`select p.id, p.amount from meet_payments p join meet_users i on i.id = p.user_id where i.referred_by = $1 and p.status = 'paid'
    and p.kind in ('month', 'year', 'meeting', 'invoice') and p.paid_at >= $2::date and p.paid_at < ($2::date + interval '1 month')`, [top.id, from])).rows
  const comm = pays.length ? Number((await one("select coalesce(sum(amount), 0)::bigint as k from meet_credits where ref = any($1) and status <> 'cancelled'", [pays.map((p) => 'invite:' + p.id)])).k) : 0
  const kept = pays.reduce((t, p) => t + kobo(p.amount) - paystackFee(kobo(p.amount)), 0) - comm
  const set = await one('select ambassador_prize from meet_settings where id = 1').catch(() => null)
  const prizeNaira = set && set.ambassador_prize != null ? Number(set.ambassador_prize) : AMBASSADOR.prizeNaira
  const prize = prizeNaira > 0 && kept >= kobo(prizeNaira) * AMBASSADOR.cover ? kobo(prizeNaira) : 0      // never more than half of what they brought in
  if (prize > 0) {
    if (await credit(top.id, 'ambassador', prize, 'amb:' + month, `Ambassador of the month, ${month}`))
      await notice(top.id, 'You’re Ambassador of the month', `${top.n} people you invited became hosts. Your prize, ${naira(prize)}, goes to your bank on Monday.`)
  } else {
    const { reward } = await import('./community')
    await reward(top.id, 'amb:' + month, 7, 'You’re Ambassador of the month', `${top.n} people you invited became hosts. Here’s a week of Pro, free.`)
  }
  return { name: u.name, handle: u.public ? u.handle : null, invites: top.n, prizeKobo: prize }
}

// ---------- Monday: send what's waiting (₦1,000 or more, to people with a bank on file) ----------
async function psRaw(path, body) {
  const r = await fetch(PS() + path, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + process.env.PAYSTACK_SECRET_KEY, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store' })
  const j = await r.json().catch(() => ({}))
  return { http: r.status, ok: r.ok && !!j.status, data: j.data || null, message: j.message || '' }
}
const lagosNow = () => { const d = new Date(Date.now() + 3600_000); return { day: d.getUTCDay(), hour: d.getUTCHours(), date: d.toISOString().slice(0, 10) } }
export async function mondayPayouts(force = false) {
  if (!(await pricing()).on || !paystackReady()) return { sent: 0 }
  await settleSending()
  const t = lagosNow()
  if (!force && !(t.day === 1 && t.hour >= 9)) return { sent: 0 }
  const claimed = await one("update meet_settings set payouts = payouts || jsonb_build_object($1::text, now()) where id = 1 and not (payouts ? $1) returning id", [t.date])
  if (!claimed && !force) return { sent: 0 }                                    // this Monday already ran
  const people = (await q(`select c.user_id, sum(c.amount)::bigint as total, u.recipient from meet_credits c join meet_users u on u.id = c.user_id
    where c.status = 'pending' and c.available_at <= now() and u.banned_at is null group by c.user_id, u.recipient having sum(c.amount) >= $1`, [PAYOUT_MIN])).rows
  let sent = 0, left = await paystackBalance(), short = 0
  if (left == null) return { sent: 0 }                                           // can't see the balance: send nothing
  for (const p of people) {
    const need = Number(p.total) + TRANSFER_FEE(Number(p.total))
    if (p.recipient && need > left) { short += need; continue }                  // not enough in the balance: they keep waiting, nothing is half-paid
    if (!p.recipient) p.recipient = await recipientFromBank(p.user_id)              // Install 58i: bank saved before transfers were open (Starter business)
    if (!p.recipient) { await notice(p.user_id, 'Add your bank to get paid', `${naira(Number(p.total))} is waiting for you. Add your bank in Earn and it’s sent next Monday.`); continue }
    const ref = 'olx_' + randomBytes(10).toString('hex')
    const got = (await q("update meet_credits set status = 'sending', transfer_ref = $2, sent_at = now() where user_id = $1 and status = 'pending' and available_at <= now() returning amount", [p.user_id, ref])).rows
    const amount = got.reduce((t, r) => t + Number(r.amount), 0)                // exactly what was claimed, nothing more
    if (!amount) continue
    if (amount + TRANSFER_FEE(amount) > left) { await unclaim(ref); short += amount + TRANSFER_FEE(amount); continue }
    left -= amount + TRANSFER_FEE(amount)
    const res = await psRaw('/transfer', { source: 'balance', amount, recipient: p.recipient, reference: ref, currency: 'NGN', reason: 'Olexweb Meet rewards' }).catch(() => null)
    if (res && res.ok && res.data && res.data.status === 'success') { await paid(ref); sent++; continue }
    if (res && res.ok && res.data && ['pending', 'received', 'queued'].includes(res.data.status)) { sent++; continue }   // Paystack tells us later (webhook, or the next check)
    if (res && res.ok && res.data && res.data.status === 'otp') { await unclaim(ref); await ownerTold('Paystack asks for an OTP on transfers. Turn OTP off for transfers (Paystack → Settings → Preferences) so Monday payouts can go out.'); continue }
    if (res && !res.ok && res.http >= 400 && res.http < 500) { await unclaim(ref); await ownerTold(`A Monday payout of ${naira(amount)} was refused by Paystack: ${res.message || 'no reason given'}. Top up your Paystack balance if it’s low; it tries again next Monday.`); continue }
    // no clear answer (network): stays 'sending' until Paystack confirms either way (settleSending)
  }
  if (short) await ownerTold(`Some rewards are waiting: your Paystack balance is ${naira(short)} short of paying them (with transfer fees). Nobody was half-paid; they go out once the balance covers them. See Admin → Meet → Money.`)
  return { sent, short }
}
async function paid(ref) {
  const rows = (await q("update meet_credits set status = 'paid', paid_at = now() where transfer_ref = $1 and status = 'sending' returning user_id, amount", [ref])).rows
  if (rows.length) await notice(rows[0].user_id, `Paid: ${naira(rows.reduce((t, r) => t + Number(r.amount), 0))}`, 'Your Olexweb Meet rewards were sent to your bank.')
}
// Install 58i: a Starter business can't make transfers, so a bank saved then has no transfer recipient. Once transfers open
// (Registered business), the bank already saved for their sales (their Paystack subaccount) becomes the recipient.
async function recipientFromBank(userId) {
  const u = await one('select payout from meet_users where id = $1', [userId]).catch(() => null)
  const code = u && u.payout && (typeof u.payout === 'string' ? JSON.parse(u.payout) : u.payout).code
  if (!code) return null
  const sub = await psRaw('/subaccount/' + encodeURIComponent(code)).catch(() => null)
  if (!sub || !sub.ok || !sub.data || !sub.data.account_number || !sub.data.settlement_bank) return null
  const banks = await psRaw('/bank?country=nigeria&perPage=200').catch(() => null)
  const b = banks && banks.ok && Array.isArray(banks.data) ? banks.data.find((x) => x.name === sub.data.settlement_bank || x.code === sub.data.settlement_bank) : null
  if (!b) return null
  const r = await psRaw('/transferrecipient', { type: 'nuban', name: sub.data.account_name || sub.data.business_name, account_number: sub.data.account_number, bank_code: b.code, currency: 'NGN' }).catch(() => null)
  if (!r || !r.ok || !r.data || !r.data.recipient_code) return null
  await q('update meet_users set recipient = $2 where id = $1 and recipient is null', [userId, r.data.recipient_code])
  return r.data.recipient_code
}
const unclaim = (ref) => q("update meet_credits set status = 'pending', transfer_ref = null, sent_at = null where transfer_ref = $1 and status = 'sending'", [ref])
const ownerTold = async (msg) => { const { notify } = await import('@/lib/assistant/notify'); await notify('support', msg, '/admin/meetings#business').catch(() => {}) }
// transfers we haven't heard back about (older than 30 minutes): ask Paystack
export async function settleSending() {
  const refs = (await q("select distinct transfer_ref from meet_credits where status = 'sending' and sent_at < now() - interval '30 minutes' limit 20")).rows.map((r) => r.transfer_ref)
  for (const ref of refs) await transferEvent(ref)
}
// Paystack's transfer.success / transfer.failed / transfer.reversed webhook (or our own check): asks Paystack, then acts
export async function transferEvent(ref) {
  if (!/^olx_[a-f0-9]{20}$/.test(String(ref || ''))) return
  const res = await psRaw('/transfer/verify/' + encodeURIComponent(ref)).catch(() => null)
  if (!res) return
  if (res.ok && res.data && res.data.status === 'success') return paid(ref)
  if ((res.ok && res.data && ['failed', 'reversed'].includes(res.data.status)) || res.http === 404 || (res.http === 400 && /not found/i.test(res.message))) return unclaim(ref)   // never sent: back in the queue
}
export async function myCredits(user) {
  const rows = (await q("select kind, amount, note, status, created_at, paid_at, available_at from meet_credits where user_id = $1 and status <> 'cancelled' order by created_at desc limit 50", [user.id])).rows
  const waiting = rows.filter((r) => r.status !== 'paid').reduce((t, r) => t + Number(r.amount), 0), total = rows.filter((r) => r.status === 'paid').reduce((t, r) => t + Number(r.amount), 0)
  return { waitingKobo: waiting, paidKobo: total, min: PAYOUT_MIN, items: rows.map((r) => ({ kind: r.kind, availableAt: r.available_at && r.available_at.toISOString(), amountKobo: Number(r.amount), note: r.note, status: r.status, at: r.created_at.toISOString(), paidAt: r.paid_at && r.paid_at.toISOString() })) }
}

// ---------- Install 58b: your money, in the admin (no need to open Paystack) ----------
// Paystack's own balance, what's set aside for people (earned and not yet sent), and what's left that's yours.
export const TRANSFER_FEE = (k) => (k <= 500_000 ? 1_000 : k <= 5_000_000 ? 2_500 : 5_000)   // Paystack NG transfer fee, kobo (₦10/₦25/₦50)
export async function paystackBalance() {
  const r = await psRaw('/balance').catch(() => null)
  if (!r || !r.ok || !Array.isArray(r.data)) return null
  const ngn = r.data.find((x) => x.currency === 'NGN')
  return ngn ? Number(ngn.balance) || 0 : 0
}
export async function ledger() {
  const [bal, owed, people, sent, income, shares, paidOut] = await Promise.all([
    paystackReady() ? paystackBalance() : null,
    one("select coalesce(sum(amount), 0)::bigint as k, count(distinct user_id)::int as n from meet_credits where status in ('pending', 'sending')"),
    q(`select u.name, u.email, u.recipient is not null as bank, sum(c.amount)::bigint as k from meet_credits c join meet_users u on u.id = c.user_id where c.status in ('pending', 'sending') group by u.id order by k desc limit 50`),
    q(`select c.transfer_ref, max(c.paid_at) as at, sum(c.amount)::bigint as k, u.name, u.email from meet_credits c join meet_users u on u.id = c.user_id where c.status = 'paid' group by c.transfer_ref, u.name, u.email order by at desc limit 100`),
    q(`select kind, coalesce(sum(amount), 0)::bigint as naira, count(*)::int as n, coalesce(sum(amount) filter (where paid_at >= date_trunc('month', now())), 0)::bigint as month from meet_payments where status = 'paid' and kind in ('month', 'year', 'meeting', 'invoice') group by kind`),
    one(`select coalesce(sum(coalesce(olex_kobo, floor(amount * 100 * 5 / 100))), 0)::bigint as k, coalesce(sum(coalesce(olex_kobo, floor(amount * 100 * 5 / 100))) filter (where paid_at >= date_trunc('month', now())), 0)::bigint as month
      from meet_payments where status = 'paid' and kind in ('ticket', 'booking', 'bundle', 'membership', 'cert')`),
    one("select coalesce(sum(amount), 0)::bigint as k from meet_credits where status = 'paid'")])
  const plans = income.rows.reduce((t, r) => t + Number(r.naira) * 100, 0), plansMonth = income.rows.reduce((t, r) => t + Number(r.month) * 100, 0)
  const owedK = Number(owed.k), fees = people.rows.reduce((t, p) => t + TRANSFER_FEE(Number(p.k)), 0)
  return {
    balance: bal,                                                              // null: Paystack not connected
    owed: owedK, owedPeople: owed.n, owedFees: fees,
    yours: bal == null ? null : Math.max(0, bal - owedK - fees),               // what you can take out without short-changing anyone
    short: bal == null ? 0 : Math.max(0, owedK + fees - bal),                  // how much more the balance needs to pay everyone
    income: { plans, plansMonth, shares: Number(shares.k), sharesMonth: Number(shares.month), paidOut: Number(paidOut.k), byKind: income.rows.map((r) => ({ kind: r.kind, kobo: Number(r.naira) * 100, n: r.n })) },
    waiting: people.rows.map((p) => ({ name: p.name, email: p.email, bank: p.bank, kobo: Number(p.k) })),
    sent: sent.rows.map((s) => ({ ref: s.transfer_ref, at: s.at && s.at.toISOString(), kobo: Number(s.k), name: s.name, email: s.email })),
    limit: await psLimit(),
    min: PAYOUT_MIN, prize: await one('select ambassador_prize from meet_settings where id = 1').then((r) => Number(r.ambassador_prize)).catch(() => AMBASSADOR.prizeNaira),
  }
}
// Install 58h: how much has come in through Paystack against the Starter-business limit. Every payment (Pro and hosts'
// sales) passes through the account before it is split, so all of it counts. Once more has come in than the limit
// allows and payments still went through, Paystack has lifted the limit: the account is marked Registered by itself.
export async function psLimit() {
  const s = await one('select ps_limit, ps_registered, ps_limit_hit_at, ps_manual from meet_settings where id = 1')
  const c = await one("select coalesce(sum(amount), 0)::bigint as n, max(paid_at) as last from meet_payments where status = 'paid' and provider = 'paystack'")
  const collected = Number(c.n), limit = Number(s.ps_limit)
  let registered = !!s.ps_registered, auto = false
  if (!registered && !s.ps_manual && limit > 0 && collected > limit) { await q('update meet_settings set ps_registered = true, ps_limit_hit_at = null where id = 1'); registered = true; auto = true }
  const hit = s.ps_limit_hit_at && !(c.last && c.last > s.ps_limit_hit_at) ? s.ps_limit_hit_at.toISOString() : null   // a payment since then: cleared
  return { collected: collected * 100, limit: limit * 100, registered, auto, hit, pct: limit ? Math.min(100, Math.floor((collected * 100) / limit)) : 0 }
}
export async function setLimit({ naira, registered }) {
  if (registered != null) { await q('update meet_settings set ps_registered = $1, ps_manual = true, ps_limit_hit_at = case when $1 then null else ps_limit_hit_at end where id = 1', [!!registered]); return { ok: true } }
  const n = Math.round(Number(naira))
  if (!Number.isSafeInteger(n) || n < 100_000 || n > 1_000_000_000) throw new (await import('@/lib/admin/content')).Refused('Enter the limit Paystack shows, in naira (₦100,000 or more).')
  await q('update meet_settings set ps_limit = $1, ps_manual = false where id = 1', [n])   // a new limit: notice the upgrade by itself again
  return { ok: true }
}
export async function setPrize(naira) {
  const n = Math.round(Number(naira))
  if (!Number.isSafeInteger(n) || n < 0 || n > 1_000_000) throw new (await import('@/lib/admin/content')).Refused('Choose ₦0 to ₦1,000,000 (₦0 = a week of Pro only).')
  await q('update meet_settings set ambassador_prize = $1 where id = 1', [n])
  return { ok: true }
}
