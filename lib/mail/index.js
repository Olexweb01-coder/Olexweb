// Olexweb Mail: Olaitan's own email platform for the whole site. Every email goes through sendMail():
//  1. The do-not-send list (bounces, complaints, added by hand) is checked first.
//  2. The email is logged (mail_messages), then the pipes are tried in order: your own server, Resend, Mailjet.
//     A pipe is used only if it's set up, not resting after failures, and under its daily and monthly limits. The slot
//     is claimed before sending (so two emails at once can't go over a limit) and given back if the send fails.
//  3. A temporary failure rests that pipe (1, 2, 4… up to 30 minutes) and the same email goes through the next pipe
//     at once; a bad address stops (no pipe would do better).
// kind: 'code' (sign-in and confirmation codes: always first), 'welcome' and other non-urgent mail (only up to 80% of a
// pipe's day, so codes keep a reserve), 'system' (alerts to Olaitan).
import 'server-only'
import { q, one } from '@/lib/admin/db'
import { PIPES, ORDER, PipeError } from './pipes'

export class MailError extends Error {}
const EMAIL = /^[^\s@<>]{1,64}@[^\s@<>]{1,190}\.[a-z]{2,24}$/i
const today = () => new Date().toISOString().slice(0, 10)
const monthStart = () => today().slice(0, 8) + '01'
export const mailReady = () => ORDER.some((p) => PIPES[p].ready())
const from = () => process.env.EMAIL_FROM || 'Olexweb <hello@olexweb.com>'

export async function sendMail({ to, subject, html, text, kind = 'system', source = 'site' }) {
  const addr = String(to || '').trim().toLowerCase()
  if (!EMAIL.test(addr)) throw new MailError('That email address doesn’t look right.')
  if (!mailReady()) throw new MailError('Email isn’t set up yet.')
  const msg = await one('insert into mail_messages (to_email, subject, kind, source) values ($1, $2, $3, $4) returning id', [addr, String(subject).slice(0, 300), kind, source])
  if (await one('select 1 from mail_suppressions where email = $1', [addr])) {
    await q("update mail_messages set status = 'suppressed' where id = $1", [msg.id])
    throw new MailError('We can’t send email to that address. Check it, or use another one.')
  }
  const tries = [], urgent = kind === 'code' || kind === 'system'
  for (const name of ORDER) {
    const P = PIPES[name]
    if (!P.ready()) continue
    const h = await one('select rest_until from mail_pipes where pipe = $1', [name])
    if (h && h.rest_until && h.rest_until > new Date()) { tries.push({ pipe: name, skipped: 'resting' }); continue }
    const dayCap = urgent ? P.day() : Math.floor(P.day() * 0.8)
    const month = await one('select coalesce(sum(sent), 0)::int as n from mail_pipe_days where pipe = $1 and day >= $2', [name, monthStart()])
    if (month.n >= P.month()) { tries.push({ pipe: name, skipped: 'month full' }); continue }
    const slot = await one(`insert into mail_pipe_days (pipe, day, sent) values ($1, $2, 1) on conflict (pipe, day) do update set sent = mail_pipe_days.sent + 1
      where mail_pipe_days.sent < $3 returning sent`, [name, today(), dayCap])
    if (!slot) { tries.push({ pipe: name, skipped: 'day full' }); continue }
    try {
      const r = await P.send({ from: from(), replyTo: process.env.EMAIL_REPLY_TO || '', to: addr, subject, html, text })
      tries.push({ pipe: name, ok: true })
      await q("update mail_messages set status = 'sent', pipe = $2, provider_id = $3, tries = $4, sent_at = now() where id = $1", [msg.id, name, r.id, JSON.stringify(tries)])
      await q('insert into mail_pipes (pipe, last_ok, fails) values ($1, now(), 0) on conflict (pipe) do update set last_ok = now(), fails = 0, rest_until = null', [name])
      return { ok: true, id: msg.id, pipe: name }
    } catch (e) {
      await q('update mail_pipe_days set sent = greatest(sent - 1, 0) where pipe = $1 and day = $2', [name, today()])   // a failed send doesn't count
      tries.push({ pipe: name, error: String(e.message).slice(0, 200) })
      if (e instanceof PipeError && e.hard) {
        await q("update mail_messages set status = 'failed', tries = $2, error = $3 where id = $1", [msg.id, JSON.stringify(tries), String(e.message).slice(0, 300)])
        throw new MailError('That email address was rejected. Check it, or use another one.')
      }
      await q(`insert into mail_pipes (pipe, fails, last_error, last_fail, rest_until) values ($1, 1, $2, now(), now() + interval '1 minute')
        on conflict (pipe) do update set fails = mail_pipes.fails + 1, last_error = $2, last_fail = now(),
        rest_until = now() + make_interval(mins => least(30, power(2, mail_pipes.fails)::int))`, [name, String(e.message).slice(0, 300)])
    }
  }
  const allFull = tries.length && tries.every((t) => t.skipped && t.skipped !== 'resting')
  await q('update mail_messages set status = $2, tries = $3, error = $4 where id = $1', [msg.id, allFull && !urgent ? 'skipped' : 'failed', JSON.stringify(tries), allFull ? 'every pipe is at its limit' : 'every pipe failed or is resting'])
  if (!urgent && allFull) return { skipped: true, id: msg.id }
  throw new MailError(allFull ? 'We can’t send more emails today. Please sign in with Google, or try again tomorrow.' : 'The email couldn’t be sent right now. Try again in a minute.')
}

// ---------- Admin → Mail ----------
export async function mailOverview() {
  const days = (await q('select pipe, day, sent from mail_pipe_days where day >= $1', [monthStart()])).rows
  const health = Object.fromEntries((await q('select * from mail_pipes')).rows.map((r) => [r.pipe, r]))
  const pipes = ORDER.map((name) => {
    const P = PIPES[name], h = health[name] || {}
    const todayN = (days.find((d) => d.pipe === name && d.day.toISOString().slice(0, 10) === today()) || {}).sent || 0
    const monthN = days.filter((d) => d.pipe === name).reduce((a, d) => a + d.sent, 0)
    return { pipe: name, name: P.name, ready: P.ready(), today: todayN, dayLimit: P.day(), month: monthN, monthLimit: P.month(),
      resting: !!(h.rest_until && h.rest_until > new Date()), restUntil: h.rest_until && h.rest_until.toISOString(), lastError: h.last_error || null,
      lastOk: h.last_ok && h.last_ok.toISOString(), lastFail: h.last_fail && h.last_fail.toISOString() }
  })
  const totals = await one(`select count(*) filter (where created_at > now() - interval '1 day')::int as day, count(*) filter (where status = 'sent' and created_at > now() - interval '1 day')::int as sent_day,
    count(*) filter (where status in ('failed', 'bounced', 'complained') and created_at > now() - interval '30 days')::int as bad_month, count(*) filter (where created_at > now() - interval '30 days')::int as month
    from mail_messages`)
  return { ready: mailReady(), from: from(), pipes, totals }
}
export async function mailLog({ search = '', limit = 100 } = {}) {
  const s = String(search).trim().toLowerCase().slice(0, 120)
  return (await q(`select id, created_at, to_email, subject, kind, source, status, pipe, error, tries from mail_messages
    where ($1 = '' or lower(to_email) like '%' || $1 || '%' or lower(subject) like '%' || $1 || '%') order by id desc limit $2`, [s, Math.min(300, limit)])).rows
    .map((r) => ({ ...r, created_at: r.created_at.toISOString() }))
}
export async function suppressions() { return (await q('select email, reason, note, created_at from mail_suppressions order by created_at desc limit 500')).rows.map((r) => ({ ...r, created_at: r.created_at.toISOString() })) }
export async function suppress(email, reason = 'manual', note = '') {
  const e = String(email || '').trim().toLowerCase(); if (!EMAIL.test(e)) throw new MailError('That email address doesn’t look right.')
  await q('insert into mail_suppressions (email, reason, note) values ($1, $2, $3) on conflict (email) do update set reason = excluded.reason, note = excluded.note', [e, reason, String(note || '').slice(0, 200)])
  return { ok: true }
}
export async function unsuppress(email) { await q('delete from mail_suppressions where email = $1', [String(email || '').trim().toLowerCase()]); return { ok: true } }
