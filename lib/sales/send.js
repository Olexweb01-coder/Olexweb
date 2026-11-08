// Olex Sales: sends approved emails from Olaitan's outreach Gmail (GMAIL_USER + GMAIL_APP_PASSWORD, smtp.gmail.com).
// Never through Olexweb Mail or olexweb.com: cold email must not touch the site's own sending reputation, and Resend and
// Mailjet forbid it. Every rule is plain code:
//  - warm-up: 5 a day at first, one more each day, up to the cap (20)        - one email at most every 12 minutes
//  - only weekdays 9:00–16:30 in the recipient's own time zone               - do-not-contact, opt-outs, replies honoured
//  - the footer US law (CAN-SPAM) requires: an opt-out line and Olaitan's postal address; nothing sends without the address
// Tests send to a stand-in (SALES_TEST_BASE/gmail/send) instead of Gmail.
import 'server-only'
import { q, one } from '@/lib/admin/db'

const T = () => String(process.env.SALES_TEST_BASE || '').replace(/\/$/, '')
import { FR_OPT_OUT } from './playbook'
export const gmailReady = () => !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
const US_TZ = { AL: 'America/Chicago', AK: 'America/Anchorage', AZ: 'America/Phoenix', AR: 'America/Chicago', CA: 'America/Los_Angeles', CO: 'America/Denver', CT: 'America/New_York', DE: 'America/New_York',
  DC: 'America/New_York', FL: 'America/New_York', GA: 'America/New_York', HI: 'Pacific/Honolulu', ID: 'America/Denver', IL: 'America/Chicago', IN: 'America/New_York', IA: 'America/Chicago', KS: 'America/Chicago',
  KY: 'America/New_York', LA: 'America/Chicago', ME: 'America/New_York', MD: 'America/New_York', MA: 'America/New_York', MI: 'America/New_York', MN: 'America/Chicago', MS: 'America/Chicago', MO: 'America/Chicago',
  MT: 'America/Denver', NE: 'America/Chicago', NV: 'America/Los_Angeles', NH: 'America/New_York', NJ: 'America/New_York', NM: 'America/Denver', NY: 'America/New_York', NC: 'America/New_York', ND: 'America/Chicago',
  OH: 'America/New_York', OK: 'America/Chicago', OR: 'America/Los_Angeles', PA: 'America/New_York', RI: 'America/New_York', SC: 'America/New_York', SD: 'America/Chicago', TN: 'America/Chicago', TX: 'America/Chicago',
  UT: 'America/Denver', VT: 'America/New_York', VA: 'America/New_York', WA: 'America/Los_Angeles', WV: 'America/New_York', WI: 'America/Chicago', WY: 'America/Denver' }
export function zoneOf(c) {
  if (c.country === 'GB') return 'Europe/London'
  if (c.country === 'FR') return 'Europe/Paris'
  const st = String(c.region || '').trim().toUpperCase().slice(0, 2) || (String(c.city || '').match(/,\s*([A-Z]{2})\b/) || [])[1]
  return US_TZ[st] || 'America/New_York'
}
export function inOfficeHours(zone, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: zone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map((p) => [p.type, p.value]))
  const mins = Number(parts.hour) * 60 + Number(parts.minute)
  return !['Sat', 'Sun'].includes(parts.weekday) && mins >= 9 * 60 && mins <= 16 * 60 + 30
}
export function capToday(S, now = new Date()) {
  if (!S.start_date) return Math.min(5, S.daily_cap)
  const days = Math.max(0, Math.floor((now - new Date(S.start_date)) / 864e5))
  return Math.min(S.daily_cap, 5 + days)
}
const lagosDay = () => new Date(Date.now() + 3600e3).toISOString().slice(0, 10)
export function footer(S, country) { return `\n\n--\n${country === 'FR' ? FR_OPT_OUT : S.opt_out_line}\nOlexweb, ${String(S.postal_address || '').replace(/\s*\n\s*/g, ', ')}` }   // French businesses: the opt-out line in French

// why sending can't happen right now (null when it can)
export async function blocked(S) {
  if (!S.enabled) return 'Olex Sales is switched off (Settings).'
  if (S.paused_reason) return S.paused_reason
  if (!gmailReady() && !T()) return 'Connect the outreach Gmail first (GMAIL_USER and GMAIL_APP_PASSWORD).'
  if (!S.postal_address || S.postal_address.trim().length < 10) return 'Add your postal address in Settings (US law requires it in every email).'
  return null
}

async function deliver({ from, to, subject, text, inReplyTo }) {
  if (T()) {
    const r = await fetch(T() + '/gmail/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to, subject, text, inReplyTo }) })
    if (!r.ok) throw new Error('send failed ' + r.status); return (await r.json()).id
  }
  const nodemailer = (await import('nodemailer')).default
  const t = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } })
  const info = await t.sendMail({ from, to, subject, text, replyTo: process.env.GMAIL_USER, ...(inReplyTo ? { inReplyTo, references: [inReplyTo] } : {}) })   // same thread
  return info.messageId
}

// send at most one due email (called every 10 minutes); returns what happened
export async function sendNext({ now = T() && process.env.SALES_TEST_NOW ? new Date(process.env.SALES_TEST_NOW) : new Date() } = {}) {   // tests can fix the clock
  const S = await one('select * from sales_settings where id = 1')
  const why = await blocked(S); if (why) return { sent: false, why }
  const today = await one("select count(*)::int as n from sales_outbox where status = 'sent' and (step <= 3 or step >= 12) and sent_at >= ($1::date - interval '1 hour')", [lagosDay()])   // answers to replies don't count
  const cap = capToday(S, now), capped = today.n >= cap
  const last = await one("select max(sent_at) as t from sales_outbox where status = 'sent'")
  if (last.t && now - last.t < 12 * 60e3) return { sent: false, why: 'Spacing emails out (one every 12 minutes at most).' }
  const due = (await q(`select o.*, c.country, c.region, c.city, c.status as company_status, c.domain, k.email, k.opted_out_at, k.email_status
    from sales_outbox o join sales_companies c on c.id = o.company_id join sales_contacts k on k.id = o.contact_id
    where o.status = 'approved' and (o.send_after is null or o.send_after <= $1) and (o.step between 9 and 11 or not $2) order by (o.step = 9) desc, (o.step between 10 and 11) desc, o.id limit 20`, [now, capped])).rows   // answers first; conversation emails don't count toward the cold limit (introductions and check-ins do)
  if (!due.length && capped) return { sent: false, why: `Today’s limit reached (${cap}).` }
  for (const m of due) {
    // the final checks, as the email leaves
    const d = m.email.split('@')[1]
    let stop = null
    if (m.opted_out_at) stop = 'They opted out.'
    else if (await one('select 1 from sales_dnc where entry = $1 or entry = $2 or entry = $3', [m.email.toLowerCase(), d, m.domain || '-'])) stop = 'On the do-not-contact list.'
    else if (m.email_status !== 'deliverable') stop = 'The address can’t receive mail.'
    else if (m.step <= 3 && ['replied', 'booked', 'won', 'opted_out', 'lost', 'bounced', 'nurture'].includes(m.company_status)) stop = 'They already replied.'
    else if (m.step === 9 && ['opted_out', 'bounced'].includes(m.company_status)) stop = 'They opted out.'
    else if ((m.step === 10 || m.step === 11) && m.company_status !== 'replied') stop = 'The conversation moved on.'          // Install 19: nudges only while it's still open
    else if (m.step === 12 && ['booked', 'won', 'opted_out', 'lost', 'bounced'].includes(m.company_status)) stop = 'The conversation moved on.'
    else if (m.step >= 20 && m.company_status !== 'nurture') stop = 'They’re no longer on “later”.'
    if (stop) { await q("update sales_outbox set status = 'cancelled', error = $2 where id = $1", [m.id, stop]); continue }
    if (m.step !== 9 && !inOfficeHours(zoneOf(m), now)) continue                        // cold emails wait for their office hours (answers don't)
    const from = `${S.sender_name} <${process.env.GMAIL_USER || 'outreach@test.local'}>`
    try {
      const id = await deliver({ from, to: m.email, subject: m.subject, text: m.body + footer(S, m.country), inReplyTo: m.in_reply_to || undefined })
      await q("update sales_outbox set status = 'sent', sent_at = $2, message_id = $3, error = null where id = $1", [m.id, now, id || null])
      await q("update sales_companies set status = 'contacted' where id = $1 and status = 'drafted'", [m.company_id])
      return { sent: true, id: m.id, to: m.email }
    } catch (e) {
      await q("update sales_outbox set status = 'failed', error = $2 where id = $1", [m.id, String(e.message).slice(0, 300)])
      return { sent: false, why: 'Gmail refused: ' + String(e.message).slice(0, 120) }
    }
  }
  return { sent: false, why: due.length ? 'Waiting for office hours in their time zone.' : 'Nothing approved to send.' }
}
