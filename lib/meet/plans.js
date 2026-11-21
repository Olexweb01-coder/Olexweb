// Olexweb Meet's plans and payments (Install B). One switch decides everything: pricing off (the default) means every
// feature is free and nobody is asked to pay, exactly as before. Pricing on means:
//   Free: unlimited hours, audio and video up to 100 people, MP3 recording, AI notes, screen sharing.
//   Pro (for the account by month or year, or for one meeting): video recording, all past meetings and transcripts.
//   More than 100 people (when the host allows it): a price per extra person for every 30 minutes, invoiced when the
//   meeting ends; until it's paid (or you mark it paid) that host can't start new meetings.
// Payments go through Paystack (PAYSTACK_SECRET_KEY). Amounts are in naira. Your own meetings are never charged.
import 'server-only'
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto'
import { q, one } from './db'
import { Refused } from '@/lib/admin/content'

export const DEFAULT_PRICES = { month: 4500, year: 45000, meeting: 1000, extra: 50 }
export const FREE_PEOPLE = 100, MAX_WITH_EXTRA = 500
export async function pricing() {
  const s = await one('select pricing_on, prices from meet_settings where id = 1').catch(() => null)
  return { on: !!(s && s.pricing_on), prices: { ...DEFAULT_PRICES, ...((s && s.prices) || {}) } }
}
export const naira = (n) => '₦' + Math.round(n).toLocaleString('en-NG')
export const paystackReady = () => !!process.env.PAYSTACK_SECRET_KEY
// Ways to pay. Each one is a small entry here, so another platform (Flutterwave, Monnify, Stripe…) is added the same
// way later: a ready check, a start (returns a page to send the payer to) and a check of the payment with the platform.
// Bank transfer is the fallback you control: your account details, and you confirm each transfer in the admin.
export async function bankInfo() {
  const s = await one('select bank from meet_settings where id = 1').catch(() => null)
  const b = (s && s.bank) || {}
  return b.on && b.accountNumber ? { bankName: b.bankName || '', accountName: b.accountName || '', accountNumber: b.accountNumber, note: b.note || '' } : null
}
export async function payOptions() {
  const o = []
  if (paystackReady()) o.push({ id: 'paystack', name: 'Card, bank or USSD (Paystack)' })
  if (await bankInfo()) o.push({ id: 'bank', name: 'Bank transfer' })
  return o
}
export const payReady = () => paystackReady()                                  // (the online platform; bank transfer is checked separately)

// is this person Pro? (Olaitan always is)
export async function planOf(user) {
  if (!user) return { pro: false, proUntil: null }
  if (user.role === 'owner') return { pro: true, proUntil: null, owner: true }
  const r = await one('select pro_until from meet_users where id = $1', [user.id])
  const until = r && r.pro_until && r.pro_until > new Date() ? r.pro_until : null
  return { pro: !!until, proUntil: until && until.toISOString() }
}
// may this meeting use Pro features? Pricing off: yes. On: the host is Pro, or Pro was bought for this meeting.
export async function meetingPro(m) {
  const p = await pricing()
  if (!p.on || m.host_user == null) return true
  if (m.pro) return true
  const u = await one('select pro_until from meet_users where id = $1', [m.host_user])
  return !!(u && u.pro_until && u.pro_until > new Date())
}

// ---------- invoices for extra people ----------
export async function owed(userId) {
  if (!userId) return null
  return one('select id, code, title, amount, created_at from meet_invoices where user_id = $1 and paid_at is null order by created_at limit 1', [userId])
}
export async function mustNotOwe(userId) {
  if (!userId || !(await pricing()).on) return
  const i = await owed(userId)
  if (i) throw new Refused(`You have an unpaid invoice of ${naira(i.amount)} for “${i.title}”. Pay it from your dashboard to start new meetings.`, 402)
}
// when a meeting ends: everyone who joined while it already had 100 people is charged per 30 minutes they stayed
export async function billMeeting(code) {
  const p = await pricing()
  if (!p.on) return null
  const m = await one('select code, title, host_user from meetings where code = $1', [code])
  if (!m || m.host_user == null) return null
  const r = await one(`select count(distinct identity)::int as people, coalesce(sum(ceil(greatest(extract(epoch from (coalesce(left_at, now()) - joined_at)), 1) / 1800)), 0)::int as blocks
    from meet_usage where code = $1 and extra`, [code])
  if (!r || !r.blocks) return null
  const amount = r.blocks * p.prices.extra
  const inv = await one(`insert into meet_invoices (user_id, code, title, people, blocks, amount) values ($1, $2, $3, $4, $5, $6)
    on conflict (code) do update set people = excluded.people, blocks = excluded.blocks, amount = excluded.amount where meet_invoices.paid_at is null and meet_invoices.amount <> excluded.amount returning id`,   // billed again if more joined later
    [m.host_user, code, m.title, r.people, r.blocks, amount])
  if (inv) await notice(m.host_user, `Invoice: ${naira(amount)} for “${m.title}”`, `${r.people} extra ${r.people === 1 ? 'person' : 'people'} beyond the free 100 (${r.blocks} half-hours at ${naira(p.prices.extra)}). Pay it from your dashboard to start your next meeting.`, '/#dashboard')
  return inv ? { id: inv.id, amount } : null
}

// ---------- notices (one person) ----------
export const notice = (userId, title, body = '', link = null) => q('insert into meet_notices (user_id, title, body, link) values ($1, $2, $3, $4)', [userId, String(title).slice(0, 200), String(body).slice(0, 2000), link]).catch(() => {})

// ---------- Paystack ----------
const PS = process.env.PAYSTACK_API_BASE || 'https://api.paystack.co'   // (a stand-in during tests)
const ps = async (path, body) => {
  const r = await fetch(PS + path, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + process.env.PAYSTACK_SECRET_KEY, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store' })
    .catch(() => { throw new Refused('Paystack couldn’t be reached. Try again in a moment.', 502) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || !j.status) throw new Refused('Payment couldn’t start. Try again in a moment.', 502)
  return j.data
}
// kind: 'month' | 'year' | 'meeting' (with code) | 'invoice' (with invoiceId)
export async function startPayment(user, { kind, code, invoiceId, via }, origin) {
  const opts = await payOptions(), how = via ? opts.find((o) => o.id === via) : opts[0]
  if (!how) throw new Refused(opts.length ? 'Choose how to pay.' : 'Payments aren’t set up yet.', 503)
  const p = await pricing()
  if (!p.on) throw new Refused('Everything is free right now. Nothing to pay.')
  if (!user.email && how.id === 'paystack') throw new Refused('Add an email to your account to pay.')
  let amount
  if (kind === 'month' || kind === 'year') amount = p.prices[kind]
  else if (kind === 'meeting') {
    const m = await one('select code, host_user, ended_at, pro from meetings where code = $1', [String(code || '')])
    if (!m || Number(m.host_user) !== Number(user.id)) throw new Refused('Choose one of your meetings.', 404)
    if (m.ended_at) throw new Refused('That meeting has ended.')
    if (m.pro) throw new Refused('This meeting already has Pro.')
    amount = p.prices.meeting
  } else if (kind === 'invoice') {
    const i = await one('select id, amount from meet_invoices where id = $1 and user_id = $2 and paid_at is null', [Number(invoiceId) || 0, user.id])
    if (!i) throw new Refused('That invoice is already paid.', 404)
    amount = i.amount
  } else throw new Refused('Choose what to pay for.')
  const reference = 'olm_' + randomBytes(9).toString('hex')
  await q('insert into meet_payments (reference, user_id, kind, code, invoice_id, amount, provider, status) values ($1, $2, $3, $4, $5, $6, $7, $8)', [reference, user.id, kind, kind === 'meeting' ? code : null, kind === 'invoice' ? Number(invoiceId) : null, amount, how.id, how.id === 'bank' ? 'transfer' : 'pending'])
  if (how.id === 'bank') return { bank: { ...(await bankInfo()), amount, reference: reference.slice(4).toUpperCase() } }   // they transfer, then tell us
  const d = await ps('/transaction/initialize', { email: user.email, amount: amount * 100, currency: 'NGN', reference, callback_url: `${origin}/api/meet/pay?reference=${reference}`, metadata: { kind, code: code || null, invoiceId: invoiceId || null } })
  return { url: d.authorization_url, reference }
}
// checks the payment with Paystack itself (never trusts the browser) and applies it once
export async function confirmPayment(reference) {
  const pay = await one('select * from meet_payments where reference = $1', [String(reference || '')])
  if (!pay) return { ok: false }
  if (pay.status === 'paid') return { ok: true, kind: pay.kind, code: pay.code }
  const d = await ps('/transaction/verify/' + encodeURIComponent(pay.reference))
  if (d.status !== 'success' || Number(d.amount) !== pay.amount * 100 || d.currency !== 'NGN') return { ok: false }
  return applyPayment(pay)
}
// a payment is applied exactly once, whichever way it came (Paystack's webhook, the return page, or you confirming a transfer)
async function applyPayment(pay) {
  const won = await one("update meet_payments set status = 'paid', paid_at = now() where id = $1 and status <> 'paid' returning id", [pay.id])
  if (!won) return { ok: true, kind: pay.kind, code: pay.code }                       // the webhook and the return page both arrived
  if (pay.kind === 'month' || pay.kind === 'year') {
    await q(`update meet_users set pro_until = greatest(coalesce(pro_until, now()), now()) + $2::interval where id = $1`, [pay.user_id, pay.kind === 'year' ? '365 days' : '30 days'])
    await notice(pay.user_id, 'You’re on Pro', `Thank you. Pro is on for ${pay.kind === 'year' ? 'a year' : '30 days'}.`)
  } else if (pay.kind === 'meeting') {
    await q('update meetings set pro = true where code = $1', [pay.code])
    await notice(pay.user_id, 'Pro is on for your meeting', 'Video recording and the rest of Pro now work in that meeting.')
  } else if (pay.kind === 'invoice') {
    await q("update meet_invoices set paid_at = now(), paid_how = $2 where id = $1", [pay.invoice_id, pay.provider === 'bank' ? 'bank transfer' : 'paystack'])
    await notice(pay.user_id, 'Invoice paid', 'Thank you. You can start new meetings again.')
  }
  return { ok: true, kind: pay.kind, code: pay.code }
}
// bank transfer: the payer says they've sent it; you check your bank and confirm (or decline) in the admin
export async function claimTransfer(user, reference) {
  const ref = 'olm_' + String(reference || '').toLowerCase().replace(/[^a-f0-9]/g, '')
  const pay = await one("update meet_payments set status = 'claimed' where reference = $1 and user_id = $2 and provider = 'bank' and status = 'transfer' returning amount, kind", [ref, user.id])
  if (!pay) throw new Refused('That transfer is already with us.', 404)
  const { notify } = await import('@/lib/assistant/notify')
  await notify('support', `${user.name || 'A Meet user'} says they sent ${naira(pay.amount)} by bank transfer (ref ${ref.slice(4).toUpperCase()}). Check your bank and confirm it.`, '/admin/meetings#business')
  return { ok: true }
}
export async function confirmTransfer(id, yes) {
  const pay = await one("select * from meet_payments where id = $1 and provider = 'bank' and status in ('transfer', 'claimed')", [Number(id) || 0])
  if (!pay) throw new Refused('That transfer is already handled.', 404)
  if (!yes) { await q("update meet_payments set status = 'declined' where id = $1", [pay.id]); await notice(pay.user_id, 'We couldn’t find your transfer', `We didn’t receive ${naira(pay.amount)}. If you sent it, reply through Help with your receipt.`); return { ok: true } }
  return applyPayment(pay)
}
export function paystackSigned(raw, sig) {
  const k = process.env.PAYSTACK_SECRET_KEY; if (!k || !sig) return false
  const a = Buffer.from(createHmac('sha512', k).update(raw).digest('hex')), b = Buffer.from(String(sig))
  return a.length === b.length && timingSafeEqual(a, b)
}
