// "Book a call with Olaitan" (meet.olexweb.com/book): 30-minute slots inside his call hours (Lagos time), for the next
// 14 days, at least 12 hours ahead, never overlapping a meeting he already has. A booking creates the meeting in Olexweb
// Meet (with its reminders), emails the booker a confirmation (their own time zone, the join link, a calendar invite),
// notifies Olaitan, and, if they came from an Olex Sales email (?t=…), marks that business as booked.
// Abuse: a hidden field only bots fill in, 3 bookings per network per hour, one upcoming booking per email address.
import 'server-only'
import { createHash } from 'node:crypto'
import { q, one } from '@/lib/admin/db'
import { createMeeting } from '@/lib/site/meet'
import { sendMail } from '@/lib/mail'
import { frame, p, esc } from '@/lib/mail/design'
import { notify } from '@/lib/assistant/notify'
import { companyFromToken } from './inbox'
import { Refused } from '@/lib/admin/content'

const LAGOS = 60, SLOT = 30, DAYS = 14, LEAD_H = 12, EMAIL = /^[^\s@<>]{1,64}@[^\s@<>]{1,190}\.[a-z]{2,24}$/i
const meetBase = () => String(process.env.MEET_ORIGIN || 'https://meet.olexweb.com').replace(/\/$/, '')
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n)
const okZone = (z) => { try { new Intl.DateTimeFormat('en', { timeZone: z }); return z } catch { return 'UTC' } }

export async function slots(now = Date.now()) {
  const S = await one('select call_hours from sales_settings where id = 1'), h = (S && S.call_hours) || { days: [1, 2, 3, 4, 5], from: '14:00', to: '18:00' }
  const [fh, fm] = h.from.split(':').map(Number), [th, tm] = h.to.split(':').map(Number)
  const busy = (await q("select starts_at, minutes from meetings where starts_at is not null and ended_at is null and starts_at between now() - interval '1 day' and now() + interval '16 days'")).rows
    .map((m) => [m.starts_at.getTime(), m.starts_at.getTime() + (m.minutes || 60) * 60e3])
  const out = [], lagosNow = new Date(now + LAGOS * 60e3)
  for (let d = 0; d <= DAYS; d++) {
    const day = new Date(Date.UTC(lagosNow.getUTCFullYear(), lagosNow.getUTCMonth(), lagosNow.getUTCDate() + d))
    if (!h.days.includes(day.getUTCDay())) continue
    for (let m = fh * 60 + fm; m + SLOT <= th * 60 + tm; m += SLOT) {
      const start = day.getTime() + m * 60e3 - LAGOS * 60e3, end = start + SLOT * 60e3                     // Lagos is UTC+1 all year
      if (start < now + LEAD_H * 3600e3) continue
      if (busy.some(([a, b]) => start < b && end > a)) continue
      out.push(new Date(start).toISOString())
    }
  }
  return out
}

export async function book({ slot, name, email, company, note, t, tz, website }, ip) {
  if (website) throw new Refused('Something went wrong. Try again.')                                         // the hidden field only bots fill in
  const n = clean(name, 80), e = String(email || '').trim().toLowerCase(), co = clean(company, 120), nt = clean(note, 500), zone = okZone(String(tz || 'UTC'))
  if (!n) throw new Refused('Type your name.')
  if (!EMAIL.test(e)) throw new Refused('Check your email address.')
  const iph = createHash('sha256').update('book:' + (process.env.AUTH_SECRET || '') + ':' + (ip || '')).digest('hex').slice(0, 32)
  const lim = await one("select count(*) filter (where ip_hash = $1 and created_at > now() - interval '1 hour')::int as ip, count(*) filter (where lower(email) = $2 and starts_at > now())::int as mine from sales_bookings", [iph, e])
  if (lim.ip >= 3) throw new Refused('Too many bookings from here. Try again later.', 429)
  if (lim.mine >= 1) throw new Refused('You already have a call booked. Check your email for the details.')
  if (!(await slots()).includes(String(slot))) throw new Refused('That time was just taken. Please pick another.')
  const owner = await one("select id, email, name from admin_users where role = 'owner' and disabled_at is null order by id limit 1")
  const m = await createMeeting({ title: `Call with ${n}${co ? ` (${co})` : ''}`, startsAt: slot, minutes: SLOT, speakers: 'everyone' }, owner)
  const companyId = companyFromToken(t)
  await q('insert into sales_bookings (meeting_code, starts_at, name, email, company, note, company_id, ip_hash) values ($1, $2, $3, $4, $5, $6, $7, $8)', [m.code, slot, n, e, co || null, nt || null, companyId, iph])
  if (companyId) await q("update sales_companies set status = 'booked' where id = $1", [companyId])
  const place = zone === 'UTC' ? 'UTC' : `${zone.split('/').pop().replace(/_/g, ' ')} time`              // "Chicago time": clearer than "GMT-6"
  const when = `${new Intl.DateTimeFormat('en-GB', { timeZone: zone, weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(slot))} (${place})`
  const lagos = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(slot))
  notify('sales', `${n}${co ? ` (${co})` : ''} booked a call: ${lagos} Lagos time.`, '/admin/meetings')
  const link = `${meetBase()}/${m.code}`, cal = `${meetBase()}/api/meet?code=${m.code}&calendar=1`
  const btn = (href, label, solid) => `<a href="${href}" style="display:inline-block;margin:4px 8px 4px 0;padding:12px 20px;border-radius:999px;font-weight:700;font-size:15px;text-decoration:none;${solid ? 'background:#8fe36a;color:#0e1a0b' : 'border:1px solid #cfd6c9;color:#151815'}">${label}</a>`
  sendMail({ to: e, kind: 'system', source: 'booking', subject: `Your call with Olaitan: ${when}`,
    html: frame({ brand: 'meet', preheader: `Booked for ${when}. The join link is inside.`, heading: 'Your call is booked',
      body: p(`Hi ${esc(n.split(' ')[0])}, thanks for booking a call with Olaitan Adebayo of Olexweb.`) + p(`<b>${esc(when)}</b> (30 minutes)`)
        + `<p style="margin:6px 0 18px">${btn(link, 'Join the call', true)}${btn(cal, 'Add to calendar', false)}</p>`
        + p('<span style="color:#6b6f69;font-size:14px">The call is on Olexweb Meet, in your browser: no app or account needed. Need another time? Just reply to this email.</span>'),
      foot: 'You booked this call at meet.olexweb.com/book.' }),
    text: `Your call with Olaitan Adebayo (Olexweb) is booked: ${when}, 30 minutes.\n\nJoin: ${link}\nAdd to calendar: ${cal}\n\nNeed another time? Just reply to this email.` }).catch(() => {})
  return { ok: true, when, link }
}
