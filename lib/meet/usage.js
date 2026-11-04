// Olexweb Meet's usage meter and protections. Minutes are counted the way LiveKit bills them: each person's time in a
// meeting, from LiveKit's own signed webhook events (participant joined / left, room finished), one row per session.
// Limits are yours to set (Admin → Meetings → Usage): monthly minutes and people at once, matching your LiveKit plan.
//   80% of the minutes: one push notification a month, and a warning in the admin.
//   95%: other hosts can't create or start meetings until the month resets; Olaitan's meetings carry on, and meetings
//        already started are never cut off (people can still join them).
//   People at once: when full, the next person is told "Meet is full right now" instead of failing silently.
import 'server-only'
import { q, one } from './db'
import { q as mainQ } from '@/lib/admin/db'
import { notify } from '@/lib/assistant/notify'
import { Refused } from '@/lib/admin/content'

export const PRESETS = [{ id: 'build', name: 'LiveKit free plan', minutes: 5000, people: 100 }, { id: 'ship', name: 'LiveKit $50 plan', minutes: 150000, people: 1000 },
  { id: 'scale', name: 'LiveKit $500 plan', minutes: 1500000, people: 5000 }]
const monthStart = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
const nextMonth = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
export const settings = async () => (await one('select minutes_allowance, max_people, warned from meet_settings where id = 1')) || { minutes_allowance: 5000, max_people: 100, warned: {} }

// LiveKit's events (called from lib/meet/guests.js livekitEvent, which has already checked LiveKit's signature)
export async function usageEvent(ev) {
  const id = ev.participant && ev.participant.identity, room = ev.room && ev.room.name
  if (!room || !room.startsWith('m_')) return
  if (ev.event === 'participant_joined' && id) await q('insert into meet_usage (identity, code) values ($1, $2) on conflict (identity) do update set left_at = null', [id, room.slice(2)])
  if (ev.event === 'participant_left' && id) await q('update meet_usage set left_at = now() where identity = $1 and left_at is null', [id])
  if (ev.event === 'room_finished') await q('update meet_usage set left_at = now() where code = $1 and left_at is null', [room.slice(2)])
}

// this month: minutes used (people in meetings now count up to now), people in meetings now, and the pace
export async function usageNow() {
  const s = await settings(), from = monthStart(), to = nextMonth()
  // someone whose leaving was never reported (phone died, no webhook) stops counting after 6 hours
  await q("update meet_usage set left_at = joined_at + interval '6 hours' where left_at is null and joined_at < now() - interval '6 hours'")
  const r = await one(`select coalesce(sum(extract(epoch from (least(coalesce(left_at, now()), now()) - greatest(joined_at, $1))) / 60), 0)::float as minutes,
      count(*) filter (where left_at is null)::int as live from meet_usage where coalesce(left_at, now()) > $1`, [from])
  const minutes = Math.round(r.minutes), elapsed = (Date.now() - from) / (to - from)
  const pct = s.minutes_allowance ? Math.round((minutes / s.minutes_allowance) * 100) : 0
  return { minutes, allowance: s.minutes_allowance, pct, live: r.live, maxPeople: s.max_people, resetsAt: to.toISOString(),
    projected: elapsed > 0.03 ? Math.round(minutes / elapsed) : null, level: pct >= 95 ? 'stop' : pct >= 80 ? 'warn' : 'ok' }
}
export async function databases() {
  const size = async (run) => { try { const r = (await run("select pg_database_size(current_database())::bigint as b")).rows[0]; return Number(r.b) } catch { return null } }
  const meetOwn = !!(process.env.MEET_DATABASE_URL_POOLED || process.env.MEET_DATABASE_URL)
  return { main: await size(mainQ), meet: meetOwn ? await size(q) : null, meetOwn, freeBytes: 1024 ** 3 }   // Neon's free plan: 1 GB per project
}
export async function saveLimits({ minutes, people }) {
  const m = Math.round(Number(minutes)), p = Math.round(Number(people))
  if (!(m >= 100 && m <= 100_000_000)) throw new Refused('Monthly minutes must be between 100 and 100,000,000.')
  if (!(p >= 2 && p <= 100_000)) throw new Refused('People at once must be between 2 and 100,000.')
  await q("update meet_settings set minutes_allowance = $1, max_people = $2, warned = '{}', updated_at = now() where id = 1", [m, p])
  return { ok: true }
}

// the gates, used when meetings are created and joined
export async function canCreate(isOwner) {
  if (isOwner) return
  const u = await usageNow()
  if (u.level === 'stop') throw new Refused(`Olexweb Meet is very busy this month, so new meetings are paused until ${new Date(u.resetsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}. Meetings already scheduled by Olexweb still run.`, 429)
}
export async function canJoin({ hostStarting, ownerMeeting }) {
  const u = await usageNow()
  if (u.live >= u.maxPeople) throw new Refused('Olexweb Meet is full right now. Please try again in a few minutes.', 429)
  if (hostStarting && !ownerMeeting && u.level === 'stop') await canCreate(false)
}

// the 10-minute run: warn Olaitan once a month at 80% and at 95%; tidy rows older than 13 months
export async function usageWatch() {
  const u = await usageNow(), s = await settings(), month = monthStart().toISOString().slice(0, 7), sent = []
  for (const [lvl, at] of [['warn', 80], ['stop', 95]]) {
    if (u.pct >= at && s.warned[lvl] !== month) {
      await q("update meet_settings set warned = warned || jsonb_build_object($1::text, $2::text) where id = 1", [lvl, month])
      await notify('usage', at === 95 ? `Olexweb Meet has used ${u.pct}% of this month’s ${u.allowance.toLocaleString('en-GB')} minutes. Other hosts can’t start new meetings until the month resets; yours still work.`
        : `Olexweb Meet has used ${u.pct}% of this month’s ${u.allowance.toLocaleString('en-GB')} minutes (${u.minutes.toLocaleString('en-GB')}).`, '/admin/meetings#usage')
      sent.push(lvl)
    }
  }
  await q("delete from meet_usage where joined_at < now() - interval '13 months'")
  return sent
}
