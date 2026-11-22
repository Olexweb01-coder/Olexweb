// Certificates (Install 58). Only Pro hosts' meetings give certificates (as before). New:
//   • every certificate gets its own code (like 7KQ2-9XF4) and a public page, /meet/v/<code> (meet.olexweb.com/v/<code>),
//     that shows it and confirms it's real, checked against our records;
//   • a host can charge for them (₦200 to ₦100,000; Olexweb keeps 5%, the host pays Paystack's fee);
//   • a host names the award (Attendance, Completion, Excellence…), can give one person a special edition, and chooses
//     the look (5 designs), their establishment's name and a signature.
// Who may get one is unchanged: the person's own link (signed when they joined), and they stayed long enough.
import 'server-only'
import { randomBytes } from 'node:crypto'
import { q, one } from './db'
import { Refused } from '@/lib/admin/content'
import { planOf, notice, pricing, paystackReady } from './plans'
import { PCT, kobo, naira } from './money'
import { send as sendEmail, emailReady } from './email'
import { limit, clientIp } from './limit'

const clean = (s, n) => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, n)
const EMAIL = /^[^\s@<>]{1,64}@[^\s@<>]{1,190}\.[a-z]{2,24}$/i
export const AWARDS = ['Attendance', 'Participation', 'Completion', 'Achievement', 'Excellence']
export const VARIANTS = [['c1', 'Classic Gold'], ['c2', 'Emerald'], ['c3', 'Modern'], ['c4', 'Royal Laurel'], ['c5', 'Champion']]
const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'                                      // no 0/O or 1/I: easy to read out
const serialNew = () => { const b = randomBytes(8); let s = ''; for (let i = 0; i < 8; i++) s += ABC[b[i] % 32]; return s.slice(0, 4) + '-' + s.slice(4) }
export const SERIAL = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/
const base = async () => { const { meetBase, mainOrigin } = await import('@/lib/site/meet'); return meetBase() || mainOrigin() + '/meet' }
export const verifyUrl = async (serial) => `${await base()}/v/${serial}`

// ---------- the host's choices ----------
export async function saveBrand(user, b) {
  const org = clean(b.org, 70), variant = VARIANTS.some(([v]) => v === b.variant) ? b.variant : 'c1'
  let signature = null
  if (b.signature) {
    const sig = String(b.signature)
    if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(sig) || sig.length > 80_000) throw new Refused('Draw your signature again (it was too big).')
    if (!Buffer.from(sig.split(',')[1], 'base64').subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) throw new Refused('That signature isn’t a picture.')
    signature = sig
  }
  const cur = await one('select cert_brand from meet_users where id = $1', [user.id])
  const keep = b.signature === undefined ? ((cur && cur.cert_brand && cur.cert_brand.signature) || null) : signature
  await q('update meet_users set cert_brand = $2 where id = $1', [user.id, JSON.stringify({ org, variant, signature: keep })])
  return { ok: true }
}
export async function setMeetingCert(user, { code, price, award }) {
  const m = await one('select code, host_user from meetings where code = $1', [String(code || '')])
  if (!m || Number(m.host_user) !== Number(user.id)) throw new Refused('Choose one of your meetings.', 404)
  const p = Math.round(Number(price) || 0), a = AWARDS.includes(award) ? award : 'Attendance'
  if (p) {
    if (!(await planOf(user)).pro) throw new Refused('Paid certificates are for Pro hosts.', 402)
    if (!(await pricing()).on || !paystackReady()) throw new Refused('Payments aren’t set up yet.', 503)
    if (p < 200 || p > 100_000) throw new Refused('A certificate can be ₦200 to ₦100,000, or free.')
    const u = await one('select payout from meet_users where id = $1', [user.id]); if (!u.payout) throw new Refused('Add your bank first, so certificate payments reach you.')
  }
  await q('update meetings set certs = true, cert_price = $2, cert_award = $3 where code = $1', [m.code, p, a])
  return { ok: true }
}

// ---------- getting one ----------
async function issue(code, identity, name, award, paymentId = null) {
  for (let i = 0; i < 5; i++) {
    const r = await one('insert into meet_certs (serial, code, identity, name, award, payment_id) values ($1, $2, $3, $4, $5, $6) on conflict do nothing returning serial', [serialNew(), code, identity, clean(name, 60) || 'Participant', award, paymentId])
    if (r) return r.serial
    const had = await one('select serial from meet_certs where code = $1 and identity = $2', [code, identity]); if (had) return had.serial   // already theirs
  }
  throw new Refused('Try again.')
}
// the person's own link (from the meeting) → their certificate, or what it costs first
export async function getCert(code, identity, key) {
  const { certificate } = await import('./pro')
  const c = await certificate(code, identity, key)                               // checks the link and that they stayed
  const had = await one('select serial from meet_certs where code = $1 and identity = $2', [c.code, String(identity)]); if (had) return { serial: had.serial }
  const m = await one('select cert_price, cert_award from meetings where code = $1', [c.code])
  if (m.cert_price > 0) return { pay: true, price: m.cert_price, title: c.title, host: c.host, name: c.name }
  return { serial: await issue(c.code, String(identity), c.name, m.cert_award || 'Attendance') }
}
export async function buyCert({ code, id, k, email }, origin) {
  await limit('cert:' + clientIp(), 10, 600)
  const e = String(email || '').trim().toLowerCase().slice(0, 200)
  if (!EMAIL.test(e)) throw new Refused('That email doesn’t look right.')
  const g = await getCert(code, id, k); if (g.serial) return { serial: g.serial }
  const m = await one('select m.code, m.cert_price, m.host_user, u.payout from meetings m join meet_users u on u.id = m.host_user where m.code = $1', [String(code)])
  if (!m || !m.payout || !(m.cert_price > 0)) throw new Refused('This certificate isn’t for sale.', 404)
  const { startSplit } = await import('./earn')
  return startSplit({ kind: 'cert', amount: m.cert_price, sub: m.payout.code, hostUser: m.host_user, name: g.name, email: e, code: m.code, identity: String(id), origin })
}
export async function certPaid(pay) {
  const m = await one('select code, cert_award, title, host_user from meetings where code = $1', [pay.code]); if (!m || !pay.identity) return
  const serial = await issue(m.code, pay.identity, pay.buyer_name, m.cert_award || 'Attendance', pay.id)
  await notice(m.host_user, `Certificate sold: ${naira(kobo(pay.amount))}`, `${pay.buyer_name}, “${m.title}”. Paid to your bank weekly, minus Olexweb’s ${pay.pct || PCT.cert}% and Paystack’s fee.`)
  if (pay.buyer_email && emailReady()) {
    const link = await verifyUrl(serial)
    await sendEmail({ to: pay.buyer_email, kind: 'meet-cert', subject: `Your certificate: ${m.title}`, text: `Hi ${pay.buyer_name},\n\nYour certificate is ready: ${link}\nAnyone can check it’s real at that link.\n\nOlexweb Meet`,
      html: `<p>Hi ${pay.buyer_name},</p><p>Your certificate is ready: <a href="${link}">${link}</a></p><p>Anyone can check it’s real at that link.</p><p>Olexweb Meet</p>` }).catch(() => {})
  }
}
export async function serialOfPayment(paymentId) {
  const r = await one('select serial from meet_certs where payment_id = $1', [paymentId]); return r && r.serial
}

// ---------- the public page ----------
export async function verify(serial) {
  const s = String(serial || '').toUpperCase(); if (!SERIAL.test(s)) return null
  const c = await one(`select c.*, m.title, m.started_at, m.ended_at, m.host_user, u.name as host, u.handle, u.public, u.cert_brand from meet_certs c join meetings m on m.code = c.code left join meet_users u on u.id = m.host_user where c.serial = $1`, [s])
  if (!c) return null
  const att = await one('select coalesce(sum(extract(epoch from (coalesce(left_at, now()) - joined_at))), 0)::float as secs from meet_usage where code = $1 and identity = $2', [c.code, c.identity])
  const brand = c.cert_brand || {}
  return { serial: c.serial, name: c.name, award: c.award, title: c.title, host: c.host || 'Olexweb', handle: c.public ? c.handle : null, org: brand.org || '', variant: brand.variant || 'c1', signature: brand.signature || null,
    date: (c.ended_at || c.started_at || c.issued_at).toISOString(), issued: c.issued_at.toISOString(), minutes: Math.round(att.secs / 60), revoked: !!c.revoked_at, url: await verifyUrl(c.serial) }
}
// a host gives one person a special edition (or takes it back)
export async function setAward(user, serial, award) {
  if (!AWARDS.includes(award)) throw new Refused('Choose an award.')
  const r = await one('update meet_certs c set award = $3 from meetings m where c.serial = $1 and m.code = c.code and m.host_user = $2 returning c.serial', [String(serial || '').toUpperCase(), user.id, award])
  if (!r) throw new Refused('That certificate isn’t from your meetings.', 404)
  return { ok: true }
}
export async function hostCerts(user, code) {
  const m = await one('select code from meetings where code = $1 and host_user = $2', [String(code || ''), user.id]); if (!m) throw new Refused('Choose one of your meetings.', 404)
  return (await q('select serial, name, award, issued_at, payment_id is not null as paid from meet_certs where code = $1 order by issued_at limit 500', [m.code])).rows.map((r) => ({ serial: r.serial, name: r.name, award: r.award, at: r.issued_at.toISOString(), paid: r.paid }))
}
