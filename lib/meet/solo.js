// Install 66: meetings held alone. Each meeting a host ends without anyone else having joined adds one to their count
// (meet_users.solo_count). After 2 they're warned; at 3 the account is restricted (restricted_at): they can still sign in,
// but can't make or start meetings. They write an appeal (appeal); Olaitan lets them back in from Admin → Meetings →
// Meet app, which sets the count back to 0. The owner's account is never counted. If the new columns aren't there yet
// (setup not run), every function here quietly does nothing, so nobody is ever blocked by mistake.
import 'server-only'
import { q, one } from './db'
import { Refused } from '@/lib/admin/content'
import { notice } from './plans'
import { send as sendEmail, emailReady } from './email'

export const SOLO_LIMIT = 3
const clean = (s, n) => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, n)
// the decision also goes by email (when email is set up), so they hear even if they don't open Meet
const mail = async (email, subject, text) => { if (email && emailReady()) await sendEmail({ to: email, subject, kind: 'support', text: text + '\n\nOlexweb Meet', html: `<p>${text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</p><p>Olexweb Meet</p>` }).catch(() => {}) }
const tellOwner = async (msg) => { const { notify } = await import('@/lib/assistant/notify'); await notify('support', msg, '/admin/meetings#accounts').catch(() => {}) }

// called once, when a meeting goes from open to ended
export async function soloEnded(code, hostUser) {
  if (hostUser == null) return
  const m = await one(`select started_at, exists (select 1 from meet_usage g where g.code = $1 and g.identity like 'g\\_%') as company from meetings where code = $1`, [code])
  if (!m || !m.started_at || m.company) return
  const u = await one("update meet_users set solo_count = solo_count + 1 where id = $1 and role <> 'owner' and restricted_at is null and banned_at is null returning solo_count", [hostUser])
  if (!u) return
  if (u.solo_count === SOLO_LIMIT - 1) await notice(hostUser, 'Your meetings need people', `Nobody else joined your last ${SOLO_LIMIT - 1} meetings. Meetings held alone don’t count, and after ${SOLO_LIMIT} your account is paused until Olexweb checks it. Share your link so people can join.`)
  if (u.solo_count >= SOLO_LIMIT) {
    const r = await one('update meet_users set restricted_at = now(), appeal = null where id = $1 and restricted_at is null returning name, email', [hostUser])
    if (r) {
      await notice(hostUser, 'Your account is paused', `Nobody else joined ${SOLO_LIMIT} of your meetings, so you can’t make or start meetings for now. Open Olexweb Meet and tell us why to ask to be let back in.`)
      await tellOwner(`A Meet account was paused for holding ${SOLO_LIMIT} meetings alone: ${r.name || r.email || 'an account'}. They can appeal; see Admin → Meetings → Accounts.`)
    }
  }
}
// before making or starting a meeting
export async function mustNotBeRestricted(userId) {
  const u = await one('select restricted_at from meet_users where id = $1', [userId]).catch(() => null)
  if (u && u.restricted_at) throw new Refused('Your account is paused because nobody else joined 3 of your meetings. Ask to be let back in from your Olexweb Meet home page.', 403)
}
export async function myRestriction(userId) {
  const u = await one('select restricted_at, appeal, solo_count from meet_users where id = $1', [userId]).catch(() => null)
  if (!u) return null
  return { restricted: !!u.restricted_at, at: u.restricted_at ? u.restricted_at.toISOString() : null, appealed: !!u.appeal, solo: u.solo_count, limit: SOLO_LIMIT }
}
export async function appeal(user, text) {
  const t = clean(text, 1000)
  if (t.length < 10) throw new Refused('Tell us a little more (at least a sentence).')
  const r = await one('update meet_users set appeal = $2 where id = $1 and restricted_at is not null returning name, email', [user.id, t])
  if (!r) throw new Refused('Your account isn’t paused.')
  await tellOwner(`${r.name || r.email || 'A paused Meet account'} asked to be let back in: “${t.slice(0, 300)}”. Decide in Admin → Meetings → Accounts.`)
  return { ok: true }
}
// Admin
export async function decideAppeal(id, allow) {
  const u = await one('select id, email, restricted_at from meet_users where id = $1', [Number(id)])
  if (!u || !u.restricted_at) throw new Refused('That account isn’t paused.')
  if (allow) {
    await q('update meet_users set restricted_at = null, appeal = null, solo_count = 0 where id = $1', [u.id])
    const t = 'Olexweb checked your account and let you back in. Remember: meetings only count when someone else joins.'
    await notice(u.id, 'You can make meetings again', t); await mail(u.email, 'Olexweb Meet: you can make meetings again', t)
  } else {
    await q('update meet_users set appeal = null where id = $1', [u.id])
    const t = 'Olexweb checked your request and your account stays paused. You can ask again with more detail.'
    await notice(u.id, 'Your account stays paused for now', t); await mail(u.email, 'Olexweb Meet: your account stays paused', t)
  }
  return { ok: true }
}
