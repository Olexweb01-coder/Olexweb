// Install 58k: bonus Pro from Olexweb. Gifts to one account or everyone, and a welcome bonus for every new account (also
// people who came through an invite), each with a reason the person sees. Each gift is its own stretch of Pro time:
// it ends by itself on its date, and cancelling one removes only what is left of that gift (paid Pro is never touched).
// Money already earned while on bonus Pro still reaches the host's bank; new paid sales stop once Pro ends (proById).
import 'server-only'
import { q, one } from './db'
import { Refused } from '@/lib/admin/content'
import { notice } from './plans'

const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n)
const dayOf = (d) => new Date(d).toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'long', year: 'numeric' })

export async function grant(userId, days, reason, kind = 'gift') {
  const r = await one(`with u as (select id, greatest(coalesce(pro_until, now()), now()) as s from meet_users where id = $1 and banned_at is null for update)
    update meet_users m set pro_until = u.s + ($2 || ' days')::interval from u where m.id = u.id returning u.s as starts, m.pro_until as ends`, [userId, String(days)])
  if (!r) return null
  await q('insert into meet_pro_grants (user_id, kind, days, reason, starts_at, ends_at) values ($1, $2, $3, $4, $5, $6)', [userId, kind, days, reason, r.starts, r.ends])
  await notice(userId, kind === 'welcome' ? `Welcome! ${days} days of Pro, on us` : `A gift from Olexweb: ${days} days of Pro`,
    `${reason ? reason + ' ' : ''}Your Pro runs until ${dayOf(r.ends)}. It ends by itself; nothing is charged.`)
  return r
}
export async function givePro(email, days, reason) {
  const d = Math.round(Number(days)), why = clean(reason, 300)
  if (!(d >= 1 && d <= 3650)) throw new Refused('Days must be between 1 and 3,650.')
  const all = String(email || '').trim().toLowerCase() === 'all'
  const rows = (await q(all ? "select id from meet_users where role = 'user' and banned_at is null" : 'select id from meet_users where lower(email) = lower($1) and banned_at is null', all ? [] : [String(email || '').trim()])).rows
  if (!rows.length) throw new Refused('No Meet account with that email.', 404)
  let people = 0
  for (const r of rows) if (await grant(r.id, d, why, 'gift')) people++
  return { ok: true, people }
}
// a brand-new account (any sign-in, invited or not)
export async function welcomeBonus(userId) {
  const s = await one('select welcome_days, welcome_reason, welcome_until from meet_settings where id = 1').catch(() => null)
  if (!s || !(s.welcome_days > 0) || (s.welcome_until && s.welcome_until <= new Date())) return null
  const had = await one("select 1 from meet_pro_grants where user_id = $1 and kind = 'welcome'", [userId]); if (had) return null
  return grant(userId, s.welcome_days, s.welcome_reason, 'welcome')
}
export async function setWelcome({ days, reason, until }) {
  const d = Math.round(Number(days) || 0)
  if (!(d >= 0 && d <= 365)) throw new Refused('Welcome Pro is 0 (off) to 365 days.')
  const u = until ? new Date(until + (String(until).length === 10 ? 'T23:59:59+01:00' : '')) : null
  if (u && isNaN(u)) throw new Refused('That end date doesn’t look right.')
  await q('update meet_settings set welcome_days = $1, welcome_reason = $2, welcome_until = $3 where id = 1', [d, clean(reason, 300), u])
  return { ok: true }
}
// cancel one gift: take off only the part not used yet, move any later Pro time earlier by the same amount, tell them why
export async function cancelGrant(id, reason) {
  const why = clean(reason, 300)
  if (!why) throw new Refused('Say why, so they understand.')
  const g = await one('update meet_pro_grants set cancelled_at = now(), cancel_reason = $2 where id = $1 and cancelled_at is null and ends_at > now() returning *', [Number(id) || 0, why])
  if (!g) throw new Refused('That bonus has already ended or was cancelled.', 404)
  const left = Math.max(0, g.ends_at.getTime() - Math.max(Date.now(), g.starts_at.getTime()))
  if (left > 0) {
    await q("update meet_users set pro_until = case when pro_until - ($2 || ' milliseconds')::interval > now() then pro_until - ($2 || ' milliseconds')::interval else now() end where id = $1", [g.user_id, String(left)])
    await q("update meet_pro_grants set starts_at = starts_at - ($3 || ' milliseconds')::interval, ends_at = ends_at - ($3 || ' milliseconds')::interval where user_id = $1 and id <> $2 and cancelled_at is null and starts_at >= $4", [g.user_id, g.id, String(left), g.ends_at])
    await q("update meet_pro_grants set ends_at = now() where id = $1", [g.id])
  }
  await notice(g.user_id, 'Your bonus Pro has ended', `${why} Money you already earned still goes to your bank. Any Pro you paid for is unchanged.`)
  return { ok: true }
}
export async function bonusList() {
  const s = await one('select welcome_days, welcome_reason, welcome_until from meet_settings where id = 1')
  const rows = (await q(`select g.id, g.kind, g.days, g.reason, g.starts_at, g.ends_at, g.cancelled_at, g.cancel_reason, u.name, u.email from meet_pro_grants g join meet_users u on u.id = g.user_id
    order by (g.cancelled_at is null and g.ends_at > now()) desc, g.created_at desc limit 200`)).rows
  return { welcome: { days: s.welcome_days, reason: s.welcome_reason, until: s.welcome_until && s.welcome_until.toISOString().slice(0, 10) },
    grants: rows.map((r) => ({ id: r.id, kind: r.kind, days: r.days, reason: r.reason, name: r.name, email: r.email, ends: r.ends_at.toISOString(), active: !r.cancelled_at && r.ends_at > new Date(), cancelled: !!r.cancelled_at, cancelReason: r.cancel_reason })) }
}
