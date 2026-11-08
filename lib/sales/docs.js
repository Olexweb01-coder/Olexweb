// Olex Sales, Install 18: official Olexweb documents, made by the agent or by Olaitan in one tap.
//   Rate card: the playbook's offers at one price level, in the client's currency, valid 30 days.
//   Invoice:   items, total, due date and the bank details from Sales settings (payment straight to the bank).
// Each gets a private link (olexweb.com/doc/<token>, never indexed) that prints or saves as a PDF.
import 'server-only'
import { randomBytes } from 'node:crypto'
import { q, one } from '@/lib/admin/db'
import { OFFERS, offersFor, priceOf, currencyOf, CURRENCIES, TIERS, POSITIONING, PROOF } from './playbook'

export class DocError extends Error {}
const SITE = 'https://olexweb.com'
const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n)
async function nextNumber(kind) {
  const y = new Date().getUTCFullYear(), n = (await one(`select count(*)::int n from sales_docs where kind = $1 and created_at >= make_date($2, 1, 1)`, [kind, y])).n + 1
  return `${kind === 'invoice' ? 'INV' : 'RC'}-${y}-${String(n).padStart(4, '0')}`
}
async function save(kind, data, companyId) {
  const token = randomBytes(18).toString('base64url'), number = await nextNumber(kind)
  await q('insert into sales_docs (kind, number, token, company_id, data) values ($1, $2, $3, $4, $5)', [kind, number, token, companyId || null, JSON.stringify(data)])
  return { kind, number, token, url: SITE + '/doc/' + token, path: '/doc/' + token }
}

export async function makeRateCard({ country = 'US', currency, tier = 'starter', companyId = null, client = null } = {}) {
  const cur = CURRENCIES[currency] ? currency : currencyOf(country), lvl = TIERS[tier] ? tier : 'starter'
  const items = offersFor(lvl).map((o) => ({ key: o.key, name: o.name, what: o.what, time: o.time, price: priceOf(o.key, lvl, cur).text }))
  const valid = new Date(Date.now() + 30 * 86400e3).toISOString().slice(0, 10)
  return save('ratecard', { currency: cur, tier: lvl, tierLabel: TIERS[lvl].label, items, positioning: POSITIONING, proof: PROOF, validUntil: valid, client: client ? clean(client, 120) : null }, companyId)
}

export async function makeInvoice({ client = {}, items = [], currency = 'USD', dueDays = 7, notes = '', companyId = null } = {}) {
  if (!CURRENCIES[currency]) throw new DocError('Choose USD, GBP or EUR.')
  const name = clean(client.name, 120); if (!name) throw new DocError('Who is the invoice for? Add the client’s name.')
  const lines = (Array.isArray(items) ? items : []).slice(0, 20).map((x) => ({ desc: clean(x.desc, 200), qty: Math.max(1, Math.min(999, Math.round(Number(x.qty) || 1))), amount: Math.round((Number(x.amount) || 0) * 100) / 100 }))
    .filter((x) => x.desc && x.amount > 0)
  if (!lines.length) throw new DocError('Add at least one item with an amount.')
  const S = await one('select sender_name, postal_address, bank from sales_settings where id = 1')
  if (!S.bank || !S.bank.account_number) throw new DocError('Add your bank details first (Sales → Simple → Your bank details).')
  const total = Math.round(lines.reduce((a, x) => a + x.qty * x.amount, 0) * 100) / 100
  const issued = new Date(), due = new Date(Date.now() + Math.max(0, Math.min(90, Number(dueDays) || 7)) * 86400e3)
  return save('invoice', { currency, client: { name, company: clean(client.company, 120), email: clean(client.email, 160), address: clean(client.address, 300) }, items: lines, total,
    issued: issued.toISOString().slice(0, 10), due: due.toISOString().slice(0, 10), notes: clean(notes, 600), from: { name: S.sender_name, address: S.postal_address }, bank: S.bank }, companyId)
}

export async function docByToken(token) {
  if (!/^[\w-]{20,40}$/.test(String(token || ''))) return null
  const d = await one('select kind, number, data, created_at, status from sales_docs where token = $1', [String(token)])
  if (!d) return null
  await q('update sales_docs set viewed_at = coalesce(viewed_at, now()) where token = $1', [String(token)]).catch(() => {})
  return { ...d, created_at: d.created_at.toISOString() }
}
export async function recentDocs(limit = 8) {
  return (await q(`select d.kind, d.number, d.token, d.data->>'currency' as currency, d.data->>'total' as total, coalesce(d.data->'client'->>'name', d.data->>'client', c.name) as client, d.data->>'tierLabel' as tier,
      d.created_at, d.viewed_at from sales_docs d left join sales_companies c on c.id = d.company_id order by d.id desc limit $1`, [limit])).rows
    .map((r) => ({ ...r, url: SITE + '/doc/' + r.token, path: '/doc/' + r.token, created_at: r.created_at.toISOString(), viewed_at: r.viewed_at && r.viewed_at.toISOString() }))
}
export async function saveBank(b = {}) {
  const bank = { account_name: clean(b.account_name, 120), bank_name: clean(b.bank_name, 120), account_number: clean(b.account_number, 40), swift: clean(b.swift, 20), iban: clean(b.iban, 40), sort_code: clean(b.sort_code, 20), notes: clean(b.notes, 300) }
  if (!bank.account_name || !bank.bank_name || !bank.account_number) throw new DocError('Account name, bank and account number are needed.')
  await q('update sales_settings set bank = $1 where id = 1', [JSON.stringify(bank)]); return { ok: true }
}
export { OFFERS }
