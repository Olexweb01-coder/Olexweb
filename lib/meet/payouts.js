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
import { INVITE_PCT, AMBASSADOR, PAYOUT_MIN, kobo, share, naira } from './money'

const PS = () => process.env.PAYSTACK_API_BASE || 'https://api.paystack.co'
async function credit(userId, kind, amount, ref, note) {
  if (!(amount > 0)) return null
  const r = await one('insert into meet_credits (user_id, kind, amount, ref, note) values ($1, $2, $3, $4, $5) on conflict (ref) do nothing returning id', [userId, kind, amount, ref, note])
  return r && r.id
}

// ---------- 3% of a referred person's first Pro payment ----------
export async function inviteCredit(pay) {
  if (!['month', 'year'].includes(pay.kind) || !pay.user_id) return
  const u = await one('select referred_by, name from meet_users where id = $1', [pay.user_id]); if (!u || !u.referred_by) return
  const first = await one("select id from meet_payments where user_id = $1 and kind in ('month', 'year') and status = 'paid' order by paid_at, id limit 1", [pay.user_id])
  if (!first || Number(first.id) !== Number(pay.id)) return                    // only their first Pro payment
  const amount = share(kobo(pay.amount), INVITE_PCT)
  if (await credit(u.referred_by, 'invite', amount, 'invite:' + pay.user_id, `${INVITE_PCT}% of ${u.name || 'a friend'}’s first Pro payment`))
    await notice(u.referred_by, `You earned ${naira(amount)}`, `${u.name || 'Someone you invited'} went Pro. Your ${INVITE_PCT}% is paid to your bank on Monday (once you have ₦1,000 or more waiting).`)
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
  const paid = await one(`select coalesce(sum(p.amount), 0)::bigint as naira from meet_payments p join meet_users i on i.id = p.user_id
    where i.referred_by = $1 and p.status = 'paid' and p.kind in ('month', 'year', 'meeting', 'invoice') and p.paid_at >= $2::date and p.paid_at < ($2::date + interval '1 month')`, [top.id, from])
  const prize = Math.min(share(kobo(Number(paid.naira)), AMBASSADOR.pct), AMBASSADOR.capKobo)
  if (prize > 0) {
    if (await credit(top.id, 'ambassador', prize, 'amb:' + month, `Ambassador of the month, ${month}`))
      await notice(top.id, `You’re Ambassador of the month 🏆`, `${top.n} people you invited became hosts. Your prize, ${naira(prize)} (${AMBASSADOR.pct}% of what they paid), goes to your bank on Monday.`)
  } else {
    const { reward } = await import('./community')
    await reward(top.id, 'amb:' + month, 7, 'You’re Ambassador of the month 🏆', `${top.n} people you invited became hosts. Here’s a week of Pro, free.`)
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
    where c.status = 'pending' and u.banned_at is null group by c.user_id, u.recipient having sum(c.amount) >= $1`, [PAYOUT_MIN])).rows
  let sent = 0
  for (const p of people) {
    if (!p.recipient) { await notice(p.user_id, 'Add your bank to get paid', `${naira(Number(p.total))} is waiting for you. Add your bank in Earn and it’s sent next Monday.`); continue }
    const ref = 'olx_' + randomBytes(10).toString('hex')
    const got = (await q("update meet_credits set status = 'sending', transfer_ref = $2, sent_at = now() where user_id = $1 and status = 'pending' returning amount", [p.user_id, ref])).rows
    const amount = got.reduce((t, r) => t + Number(r.amount), 0)                // exactly what was claimed, nothing more
    if (!amount) continue
    const res = await psRaw('/transfer', { source: 'balance', amount, recipient: p.recipient, reference: ref, currency: 'NGN', reason: 'Olexweb Meet rewards' }).catch(() => null)
    if (res && res.ok && res.data && res.data.status === 'success') { await paid(ref); sent++; continue }
    if (res && res.ok && res.data && ['pending', 'received', 'queued'].includes(res.data.status)) { sent++; continue }   // Paystack tells us later (webhook, or the next check)
    if (res && res.ok && res.data && res.data.status === 'otp') { await unclaim(ref); await ownerTold('Paystack asks for an OTP on transfers. Turn OTP off for transfers (Paystack → Settings → Preferences) so Monday payouts can go out.'); continue }
    if (res && !res.ok && res.http >= 400 && res.http < 500) { await unclaim(ref); await ownerTold(`A Monday payout of ${naira(amount)} was refused by Paystack: ${res.message || 'no reason given'}. Top up your Paystack balance if it’s low; it tries again next Monday.`); continue }
    // no clear answer (network): stays 'sending' until Paystack confirms either way (settleSending)
  }
  return { sent }
}
async function paid(ref) {
  const rows = (await q("update meet_credits set status = 'paid', paid_at = now() where transfer_ref = $1 and status = 'sending' returning user_id, amount", [ref])).rows
  if (rows.length) await notice(rows[0].user_id, `Paid: ${naira(rows.reduce((t, r) => t + Number(r.amount), 0))}`, 'Your Olexweb Meet rewards were sent to your bank.')
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
  const rows = (await q('select kind, amount, note, status, created_at, paid_at from meet_credits where user_id = $1 order by created_at desc limit 50', [user.id])).rows
  const waiting = rows.filter((r) => r.status !== 'paid').reduce((t, r) => t + Number(r.amount), 0), total = rows.filter((r) => r.status === 'paid').reduce((t, r) => t + Number(r.amount), 0)
  return { waitingKobo: waiting, paidKobo: total, min: PAYOUT_MIN, items: rows.map((r) => ({ kind: r.kind, amountKobo: Number(r.amount), note: r.note, status: r.status, at: r.created_at.toISOString(), paidAt: r.paid_at && r.paid_at.toISOString() })) }
}
