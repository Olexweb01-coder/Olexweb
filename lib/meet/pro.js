// Olexweb Meet's Pro tools (Install D), server side: sign-ups and email reminders before a scheduled meeting, the AI
// follow-up (notes emailed to everyone who left an email), certificates of attendance, meeting flyers for link previews,
// and each host's personal room (meet.olexweb.com/<their profile name>). With pricing off, everyone has all of them.
import 'server-only'
import { q, one } from './db'
import { Refused } from '@/lib/admin/content'
import { send as sendEmail, emailReady } from './email'
import { meetingPro } from './plans'
import { limit, clientIp } from './limit'

const clean = (s, n) => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, n)
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const EMAIL = /^[^\s@<>]{1,64}@[^\s@<>]{1,190}\.[a-z]{2,24}$/i
const lagos = (d) => new Date(d).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' }) + ' (Lagos time)'
const hostName = async (m) => (m.host_user ? ((await one('select name from meet_users where id = $1', [m.host_user])) || {}).name : 'Olaitan Adebayo') || 'Your host'
const linkOf = async (code) => (await import('@/lib/site/meet')).meetLink(code)

// ---------- sign-ups before a scheduled meeting ----------
export async function register({ code, name, email }) {
  await limit('reg:' + clientIp(), 10, 600)
  const n = clean(name, 60), e = String(email || '').trim().toLowerCase().slice(0, 200)
  if (!n) throw new Refused('Type your name.')
  if (!EMAIL.test(e)) throw new Refused('That email doesn’t look right.')
  const m = await one('select code, title, starts_at, ended_at, host_user, pro from meetings where code = $1', [String(code || '')])
  if (!m || m.ended_at) throw new Refused('This meeting isn’t taking sign-ups.', 404)
  const r = await one('insert into meet_regs (code, name, email) values ($1, $2, $3) on conflict do nothing returning id', [m.code, n, e])
  if (r && emailReady() && m.starts_at) {
    const link = await linkOf(m.code)
    await sendEmail({ to: e, kind: 'meet-reg', subject: `You’re in: ${m.title}`, text: `Hi ${n},\n\nYou’re signed up for “${m.title}” on ${lagos(m.starts_at)}.\nJoin here when it starts: ${link}\n\nWe’ll remind you before it starts.\n\nOlexweb Meet`,
      html: `<p>Hi ${esc(n)},</p><p>You’re signed up for <b>${esc(m.title)}</b> on ${esc(lagos(m.starts_at))}.</p><p><a href="${esc(link)}">Join here when it starts</a></p><p>We’ll remind you before it starts.</p><p>Olexweb Meet</p>` }).catch(() => {})
  }
  return { ok: true }
}
// every 10 minutes: reminders a day before and an hour before (Pro meetings; all meetings while pricing is off)
export async function remindRegs() {
  if (!emailReady()) return 0
  const ms = (await q(`select code, title, starts_at, host_user, pro from meetings where ended_at is null and starts_at > now() and starts_at < now() + interval '24 hours'
    and exists (select 1 from meet_regs r where r.code = meetings.code)`)).rows
  let sent = 0
  for (const m of ms) {
    if (!(await meetingPro(m))) continue
    const soon = m.starts_at - Date.now() <= 70 * 60_000, slot = soon ? '1h' : '24h', link = await linkOf(m.code)
    const regs = (await q(`select id, name, email from meet_regs where code = $1 and not (sent ? $2) limit 500`, [m.code, slot])).rows
    const when = lagos(m.starts_at)
    for (const r of regs) {
      await q('update meet_regs set sent = sent || to_jsonb($2::text) where id = $1', [r.id, slot])
      await sendEmail({ to: r.email, kind: 'meet-reminder', subject: soon ? `Starting soon: ${m.title}` : `Reminder: ${m.title}`,
        text: `Hi ${r.name},\n\n“${m.title}” starts ${soon ? 'in about an hour' : 'on ' + when}.\nJoin here: ${link}\n\nOlexweb Meet`,
        html: `<p>Hi ${esc(r.name)},</p><p><b>${esc(m.title)}</b> starts ${soon ? 'in about an hour' : 'on ' + esc(when)}.</p><p><a href="${esc(link)}">Join the meeting</a></p><p>Olexweb Meet</p>` }).then(() => sent++, () => {})
    }
  }
  return sent
}

// ---------- the AI follow-up: once the notes exist, everyone who left an email gets them ----------
export async function followUp(code) {
  const m = await one('select code, title, host_user, pro, followup, followup_at, notes from meetings where code = $1', [code])
  if (!m || !m.followup || m.followup_at || !m.notes || !emailReady() || !(await meetingPro(m))) return 0
  const won = await one('update meetings set followup_at = now() where code = $1 and followup_at is null returning code', [code]); if (!won) return 0
  const to = (await q(`select distinct on (lower(email)) name, lower(email) as email from (select name, email from meet_regs where code = $1 union all select name, email from meet_attendees where code = $1 and email is not null) x
    where email is not null order by lower(email) limit 1000`, [code])).rows
  const n = m.notes, host = await hostName(m), li = (a) => (a || []).map((x) => `<li>${esc(typeof x === 'string' ? x : `${x.what}${x.who ? ' · ' + x.who : ''}${x.when ? ' · ' + x.when : ''}`)}</li>`).join('')
  const html = `<p>Here are the notes from <b>${esc(m.title)}</b> with ${esc(host)}.</p><p>${esc(n.summary)}</p>${(n.decisions || []).length ? `<p><b>Decided</b></p><ul>${li(n.decisions)}</ul>` : ''}${(n.actions || []).length ? `<p><b>Next steps</b></p><ul>${li(n.actions)}</ul>` : ''}${(n.points || []).length ? `<p><b>What was covered</b></p><ul>${li(n.points)}</ul>` : ''}<p style="color:#777">Written by Olex AI from the meeting. Olexweb Meet</p>`
  const text = `Notes from “${m.title}” with ${host}\n\n${n.summary}\n\n${(n.actions || []).length ? 'Next steps:\n' + n.actions.map((a) => `- ${a.what}${a.who ? ' (' + a.who + ')' : ''}${a.when ? ', ' + a.when : ''}`).join('\n') + '\n\n' : ''}Olexweb Meet`
  let sent = 0
  for (const r of to) await sendEmail({ to: r.email, kind: 'meet-followup', subject: `Notes: ${m.title}`, html: `<p>Hi ${esc(r.name)},</p>` + html, text: `Hi ${r.name},\n\n` + text }).then(() => sent++, () => {})
  return sent
}

// ---------- certificates of attendance (for people who stayed at least half the meeting) ----------
export async function certificate(code, identity, key) {
  const { leaveKey } = await import('./guests')
  const id = String(identity || ''), a = Buffer.from(String(key || '')), b = Buffer.from(leaveKey(id))
  const { timingSafeEqual } = await import('node:crypto')
  if (!/^[hg]_[a-z0-9]{10}$/.test(id) || a.length !== b.length || !timingSafeEqual(a, b)) throw new Refused('That certificate link isn’t valid.', 403)
  const m = await one('select code, title, host_user, pro, certs, started_at, ended_at from meetings where code = $1', [String(code || '')])
  if (!m || !m.certs || !m.started_at) throw new Refused('This meeting doesn’t give certificates.', 404)
  if (!(await meetingPro(m))) throw new Refused('Certificates are part of Pro for this meeting.', 402)
  const u = await one(`select coalesce(max(name), '') as name, coalesce(sum(extract(epoch from (coalesce(left_at, now()) - joined_at))), 0)::float as secs from meet_usage where code = $1 and identity = $2`, [m.code, id])
  const att = await one('select name from meet_attendees where identity = $1', [id])
  const length = ((m.ended_at || new Date()) - m.started_at) / 1000
  if (!u || u.secs < Math.min(length * 0.5, 3600) || u.secs < 300) throw new Refused('Certificates are for people who stayed for at least half the meeting.', 403)
  return { name: (att && att.name) || u.name || 'Participant', title: m.title, host: await hostName(m), date: (m.ended_at || m.started_at), minutes: Math.round(u.secs / 60), code: m.code }
}

// ---------- flyers (the picture shown when a Pro meeting's link is shared) ----------
export async function flyer(code) {
  const m = await one('select code, title, starts_at, mode, host_user, pro, e2ee_key is not null as locked from meetings where code = $1', [String(code || '')])
  if (!m) return null
  const host = m.host_user ? await one('select name, picture from meet_users where id = $1', [m.host_user]) : { name: 'Olaitan Adebayo', picture: null }
  return { title: m.title, startsAt: m.starts_at, mode: m.mode, host: (host && host.name) || '', picture: host && host.picture, locked: m.locked, pro: await meetingPro(m) }
}

// ---------- personal rooms ----------
export async function myRoom(user) {
  const u = await one('select handle, name from meet_users where id = $1', [user.id])
  if (!u || !u.handle) throw new Refused('Choose a profile name in your dashboard first: it becomes your room’s address.')
  const open = await one('select code from meetings where host_user = $1 and personal and ended_at is null order by created_at desc limit 1', [user.id])
  if (open) return { code: open.code, handle: u.handle }
  const { createMeeting } = await import('@/lib/site/meet')
  const r = await createMeeting({ title: `${(u.name || 'My').split(' ')[0]}’s room` }, null, { hostUser: user.id, pushes: false })
  await q('update meetings set personal = true where code = $1', [r.code])
  return { code: r.code, handle: u.handle }
}
export async function roomOf(handle) {
  const u = await one('select id, name, handle from meet_users where lower(handle) = lower($1) and banned_at is null', [String(handle || '').slice(0, 40)])
  if (!u) return null
  const m = await one('select code from meetings where host_user = $1 and personal and ended_at is null and started_at is not null order by started_at desc limit 1', [u.id])
  return { name: u.name, handle: u.handle, code: m ? m.code : null }
}
