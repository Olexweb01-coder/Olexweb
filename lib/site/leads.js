// The leads inbox: project enquiries from olexweb.com/start, and anonymous counts of taps on WhatsApp buttons.
import 'server-only'
import { createHmac, createHash } from 'node:crypto'
import { q, one } from '@/lib/admin/db'
import { Refused } from '@/lib/admin/content'
import { source, isBot, readerFp, allowed } from './engage'
import { notify } from '@/lib/assistant/notify'

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
const sign = (s) => createHmac('sha256', process.env.AUTH_SECRET || 'olexweb').update('lead-form:' + s).digest('base64url')
export const leadStamp = () => { const t = String(Date.now()); return t + '.' + sign(t) }
function stampAge(stamp) { const [t, sig] = String(stamp || '').split('.'); if (!t || !sig || sig !== sign(t)) return -1; return Date.now() - Number(t) }
const PATH = /^\/[a-z0-9\-/]{0,120}$/

export async function submitLead(d, ip, ua) {
  if (clean(d.website, 200)) return { ok: true }                      // the hidden bot trap: pretend it worked
  const age = stampAge(d.stamp)
  if (age < 3000 || age > 6 * 3600e3) throw new Refused('Please take a moment to fill in the form, then send it again.')
  const ipHash = createHash('sha256').update('lead:' + ip + ':' + (process.env.AUTH_SECRET || '')).digest('hex')
  const n = await one("select count(*) filter (where created_at > now() - interval '1 hour')::int as h, count(*)::int as d from leads where ip_hash = $1 and created_at > now() - interval '1 day'", [ipHash])
  if (n.h >= 3 || n.d >= 8) throw new Refused('Thank you. We’ve already received your details. Olaitan will reply soon.', 429)
  const name = clean(d.name, 81), contact = clean(d.contact, 121), need = clean(d.need, 2001)
  if (name.length < 2 || name.length > 80) throw new Refused('Add your name.')
  const phone = contact.replace(/[\s()-]/g, ''), email = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact)
  if (!email && !/^\+?\d{7,15}$/.test(phone)) throw new Refused('Add a WhatsApp number or an email address so Olaitan can reply.')
  if (need.length < 10) throw new Refused('Tell Olaitan a little about what you need.')
  if (need.length > 2000) throw new Refused('Keep it under 2,000 characters; you can share more later.')
  const page = PATH.test(String(d.page || '')) ? d.page : ''
  const r = await one(`insert into leads (name, contact, need, business, budget, timeline, page, source, ip_hash) values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
    [name, email ? contact : phone, need, clean(d.business, 120), clean(d.budget, 60), clean(d.timeline, 60), page, source(String(d.ref || '').slice(0, 500), String(d.utm || '').slice(0, 40)), ipHash])
  await notify('lead', `New enquiry from ${name}: ${need.slice(0, 90)}${need.length > 90 ? '…' : ''}`, '/admin/leads')
  return { ok: true, id: r.id }
}

export async function recordClick(d, ip, ua) {                        // a tap on a WhatsApp button: anonymous daily totals per page
  if (isBot(ua)) return
  const page = PATH.test(String(d.page || '')) ? d.page : null; if (!page) return
  if (!(await allowed(readerFp(ip, ua)))) return
  await q(`insert into lead_clicks (day, page, label, n) values ((now() at time zone 'Africa/Lagos')::date, $1, $2, 1)
           on conflict (day, page, label) do update set n = lead_clicks.n + 1`, [page, clean(d.label, 40)])
}

export const leadsList = async (status) => (await q(`select id, created_at, name, contact, need, business, budget, timeline, page, source, status, notes from leads
  ${['new', 'contacted', 'won', 'lost'].includes(status) ? 'where status = $1' : ''} order by created_at desc limit 200`, ['new', 'contacted', 'won', 'lost'].includes(status) ? [status] : [])).rows
export async function updateLead(id, d) {
  const status = ['new', 'contacted', 'won', 'lost'].includes(d.status) ? d.status : null
  const r = await one('update leads set status = coalesce($2, status), notes = coalesce($3, notes), updated_at = now() where id = $1 returning id', [id, status, d.notes == null ? null : clean(d.notes, 2000)])
  if (!r) throw new Refused('That enquiry no longer exists.', 404)
  return { ok: true }
}
export async function deleteLead(id) { await q('delete from leads where id = $1', [id]); return { ok: true } }
export async function leadSummary() {
  const counts = await one("select count(*) filter (where status = 'new')::int as new, count(*) filter (where created_at > now() - interval '30 days')::int as month, count(*) filter (where status = 'won')::int as won, count(*)::int as total from leads")
  const taps = (await q("select page, sum(n)::int as n from lead_clicks where day > (now() at time zone 'Africa/Lagos')::date - 30 group by page order by n desc limit 10")).rows
  return { ...counts, taps }
}
