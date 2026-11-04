// Olexweb Meet: the optional guest details form, the attendance list, reports and bans.
// FORM (per meeting, the host's choice; null = none): name is always asked; phone and email are each 'required',
// 'optional' or 'off'; organisation (optional) and one custom question (optional) can be added; `keep` = days the details
// are kept after the meeting (30 by default; 0 = until the host deletes them). Guests are told all of this before joining.
// ATTENDANCE: one row per join of a meeting with a form. Joined at = when the join was granted; left at = LiveKit's
// "participant left" event (its webhook, signed), or the guest's browser saying so on leaving (a signed key), or the
// meeting ending. Shown to the host only after the meeting ends, with a CSV. Deleted automatically when `keep` runs out.
// Attendee details never go to an AI provider.
import 'server-only'
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { WebhookReceiver } from 'livekit-server-sdk'
import { q, one } from './db'
import { Refused } from '@/lib/admin/content'
import { usageEvent } from './usage'

const clean = (s, n) => String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n)
const LEVELS = ['required', 'optional', 'off']
export const KEEP = [30, 90, 365, 0]

// ---------- the host's form settings ----------
export function cleanForm(f) {
  if (!f || f.on === false) return null
  const level = (v, d) => (LEVELS.includes(v) ? v : d)
  const keep = KEEP.includes(Number(f.keep)) ? Number(f.keep) : 30
  const question = clean(f.question, 160) || null
  return { phone: level(f.phone, 'required'), email: level(f.email, 'optional'), org: f.org === true, question, keep }
}
// what a guest sees (no secrets in it): the fields and how long they're kept
export const publicForm = (form) => (form ? { phone: form.phone, email: form.email, org: !!form.org, question: form.question || null, keep: form.keep } : null)

// ---------- a guest's details, checked against the form ----------
const PHONE = /^\+?[0-9][0-9\s().-]{5,22}$/
const EMAIL = /^[^\s@<>]{1,64}@[^\s@<>]{1,190}\.[a-z]{2,24}$/i
export function checkDetails(form, d, name) {
  const out = { name: clean(name, 40) }
  if (!out.name) throw new Refused('Type your name to join.')
  if (d && d.consent !== true) throw new Refused('Tick the box to share your details with the host.')
  for (const [k, re, what] of [['phone', PHONE, 'phone number'], ['email', EMAIL, 'email address']]) {
    const v = clean(d && d[k], k === 'email' ? 200 : 30)
    if (form[k] === 'off') continue
    if (!v) { if (form[k] === 'required') throw new Refused(`Add your ${what} to join.`); continue }
    if (!re.test(v)) throw new Refused(`That ${what} doesn’t look right.`)
    out[k] = k === 'email' ? v.toLowerCase() : v
  }
  if (form.org) out.org = clean(d && d.org, 100) || null
  if (form.question) out.answer = clean(d && d.answer, 500) || null
  return out
}
export async function recordJoin(code, identity, det) {
  await q('insert into meet_attendees (code, identity, name, phone, email, org, answer) values ($1, $2, $3, $4, $5, $6, $7) on conflict (identity) do nothing',
    [code, identity, det.name, det.phone || null, det.email || null, det.org || null, det.answer || null])
  return leaveKey(identity)
}

// ---------- when people leave ----------
// the guest's browser can say "I left" with a key only the server can make (HMAC of its identity), so nobody can mark others as gone
const secret = () => process.env.AUTH_SECRET || ''
export const leaveKey = (identity) => createHmac('sha256', secret()).update('meet-leave:' + identity).digest('base64url')
export async function leftByKey(identity, key) {
  const a = Buffer.from(String(key || '')), b = Buffer.from(leaveKey(String(identity || '')))
  if (!identity || a.length !== b.length || !timingSafeEqual(a, b)) return false
  await q('update meet_attendees set left_at = coalesce(left_at, now()) where identity = $1', [identity])
  return true
}
// LiveKit's webhook (Settings → Webhooks → https://meet.olexweb.com/api/meet/livekit): signed with the API key and secret
export async function livekitEvent(body, auth) {
  const ev = await new WebhookReceiver(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET).receive(body, auth)   // throws if not signed by LiveKit
  const id = ev.participant && ev.participant.identity, room = ev.room && ev.room.name
  if (ev.event === 'participant_joined' && id) await q('update meet_attendees set left_at = null, last_seen = now() where identity = $1', [id])
  if (ev.event === 'participant_left' && id) await q('update meet_attendees set left_at = now() where identity = $1', [id])
  if (ev.event === 'room_finished' && room && room.startsWith('m_')) await q('update meet_attendees set left_at = coalesce(left_at, now()) where code = $1', [room.slice(2)])
  await usageEvent(ev)                                                    // the usage meter (lib/meet/usage.js)
  return { ok: true, event: ev.event }
}

// ---------- the attendance list (the host, after the meeting ends) ----------
export async function attendance(code) {
  const m = await one('select code, title, form, started_at, ended_at from meetings where code = $1', [code])
  if (!m) throw new Refused('That meeting doesn’t exist.', 404)
  if (!m.form) throw new Refused('This meeting didn’t ask people for details, so there’s no attendance list.', 404)
  if (!m.ended_at) throw new Refused('The attendance list is ready when the meeting ends.')
  const rows = (await q(`select name, phone, email, org, answer, joined_at, coalesce(left_at, $2) as left_at from meet_attendees where code = $1 order by joined_at`, [code, m.ended_at])).rows
  const keepUntil = m.form.keep ? new Date(m.ended_at.getTime() + m.form.keep * 86400e3).toISOString() : null
  return { title: m.title, form: publicForm(m.form), endedAt: m.ended_at.toISOString(), keepUntil,
    people: rows.map((r) => ({ name: r.name, phone: r.phone, email: r.email, org: r.org, answer: r.answer, joinedAt: r.joined_at.toISOString(), leftAt: r.left_at.toISOString(),
      minutes: Math.max(0, Math.round((r.left_at - r.joined_at) / 60e3)) })) }
}
const cell = (v) => { const s = String(v ?? ''); return /[",\n\r]|^[=+\-@\t]/.test(s) ? '"' + (/^[=+\-@\t]/.test(s) ? "'" : '') + s.replace(/"/g, '""') + '"' : s }   // safe in Excel and Sheets
export function attendanceCsv(a) {
  const head = ['Name', a.form.phone !== 'off' && 'Phone', a.form.email !== 'off' && 'Email', a.form.org && 'Organisation or role', a.form.question && a.form.question, 'Joined (UTC)', 'Left (UTC)', 'Minutes'].filter(Boolean)
  const rows = a.people.map((p) => [p.name, a.form.phone !== 'off' ? p.phone : false, a.form.email !== 'off' ? p.email : false, a.form.org ? p.org : false, a.form.question ? p.answer : false,
    p.joinedAt.replace('T', ' ').slice(0, 19), p.leftAt.replace('T', ' ').slice(0, 19), p.minutes].filter((x) => x !== false))
  return '\ufeff' + [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'      // BOM: Excel reads names with accents correctly
}
export async function deleteAttendance(code) { const r = await q('delete from meet_attendees where code = $1', [code]); return { ok: true, deleted: r.rowCount } }
// the 10-minute run: details past their keeping time are deleted (counted from when the meeting ended, or the join if it never ended)
export async function forgetOldDetails() {
  const r = await q(`delete from meet_attendees a using meetings m where m.code = a.code and m.form is not null and coalesce((m.form->>'keep')::int, 30) > 0
    and coalesce(m.ended_at, a.joined_at) + make_interval(days => coalesce((m.form->>'keep')::int, 30)) < now()`)
  return r.rowCount
}

// ---------- reports ----------
const REASONS = ['spam', 'abuse', 'illegal', 'other']
const ipHash = (ip) => createHash('sha256').update('meet-report:' + secret() + ':' + String(ip || '')).digest('hex').slice(0, 32)
export async function report(code, { reason, note, name }, ip) {
  if (!REASONS.includes(reason)) throw new Refused('Choose a reason.')
  const m = await one('select code from meetings where code = $1', [code]); if (!m) throw new Refused('That meeting doesn’t exist.', 404)
  const h = ipHash(ip), c = await one("select count(*) filter (where created_at > now() - interval '1 hour')::int as hour, count(*) filter (where code = $2 and created_at > now() - interval '10 minutes')::int as here from meet_reports where ip_hash = $1", [h, code])
  if (c.here) throw new Refused('Thanks: you’ve already reported this meeting. We’ll look at it.')
  if (c.hour >= 5) throw new Refused('Too many reports from here. Try again later.', 429)
  await q('insert into meet_reports (code, reason, note, reporter_name, ip_hash) values ($1, $2, $3, $4, $5)', [code, reason, clean(note, 500) || null, clean(name, 40) || null, h])
  return { ok: true }
}

// ---------- your admin: accounts, reports, bans ----------
export async function adminMeetData(search = '') {
  const s = clean(search, 80).toLowerCase()
  const users = (await q(`select u.id, u.name, u.email, u.email_verified, u.role, u.created_at, u.last_seen, u.banned_at, u.banned_reason,
      (select string_agg(provider, ', ' order by provider) from meet_identities i where i.user_id = u.id) as via,
      (select count(*)::int from meetings m where m.host_user = u.id) as meetings
    from meet_users u where ($1 = '' or lower(u.name) like '%' || $1 || '%' or lower(coalesce(u.email, '')) like '%' || $1 || '%') order by u.created_at desc limit 200`, [s])).rows
  const reports = (await q(`select r.id, r.code, r.reason, r.note, r.reporter_name, r.status, r.created_at, m.title, m.ended_at, m.host_user, u.name as host_name, u.email as host_email, u.banned_at as host_banned
    from meet_reports r left join meetings m on m.code = r.code left join meet_users u on u.id = m.host_user order by (r.status = 'open') desc, r.created_at desc limit 100`)).rows
  const counts = await one("select (select count(*)::int from meet_users) as users, (select count(*)::int from meet_users where banned_at is not null) as banned, (select count(*)::int from meet_reports where status = 'open') as open")
  const iso = (d) => d && d.toISOString()
  return { counts, users: users.map((u) => ({ ...u, created_at: iso(u.created_at), last_seen: iso(u.last_seen), banned_at: iso(u.banned_at) })),
    reports: reports.map((r) => ({ ...r, created_at: iso(r.created_at), ended_at: iso(r.ended_at), host_banned: !!r.host_banned })) }
}
// ban: signed out everywhere, their open meetings end (everyone in them is removed), and they can't sign in again
export async function banUser(id, reason, endMeeting) {
  const u = await one('select id, role from meet_users where id = $1', [Number(id)]); if (!u) throw new Refused('That account no longer exists.')
  if (u.role === 'owner') throw new Refused('The owner’s account can’t be banned.')
  await q('update meet_users set banned_at = now(), banned_reason = $2 where id = $1', [u.id, clean(reason, 200) || null])
  await q('delete from meet_sessions where user_id = $1', [u.id])
  const open = (await q('select code from meetings where host_user = $1 and ended_at is null', [u.id])).rows
  for (const m of open) await endMeeting(m.code).catch(() => {})
  await q("update meet_reports set status = 'actioned', decided_at = now() where status = 'open' and code in (select code from meetings where host_user = $1)", [u.id])
  return { ok: true, ended: open.length }
}
export async function unbanUser(id) { await q('update meet_users set banned_at = null, banned_reason = null where id = $1', [Number(id)]); return { ok: true } }
export async function dismissReport(id) { await q("update meet_reports set status = 'dismissed', decided_at = now() where id = $1", [Number(id)]); return { ok: true } }
