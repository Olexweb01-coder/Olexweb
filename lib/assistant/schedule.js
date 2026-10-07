// Scheduling for Olex AI: publish a draft on a date, change mode or pace from a date, pause until a date.
// Scheduled changes run on the next daily run (about 8 am or 4 pm Lagos), each exactly once.
import 'server-only'
import { q, one } from '@/lib/admin/db'
import { run, Refused } from '@/lib/admin/content'
import { notify } from './notify'

export const SLOTS = { morning: '07:00:00Z', afternoon: '15:00:00Z' }            // the two daily runs: 8 am and 4 pm in Lagos
export const lagosToday = () => new Date(Date.now() + 3600e3).toISOString().slice(0, 10)
const fmt = (iso, slot) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) + (slot ? (slot === 'afternoon' ? ', afternoon (about 4 pm)' : ', morning (about 8 am)') : '')
export function checkDate(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) || isNaN(new Date(d + 'T12:00:00Z'))) throw new Refused('Choose a date like 2026-10-15.')
  const t = lagosToday(), max = new Date(Date.now() + 366 * 86400e3).toISOString().slice(0, 10)
  if (d < t) throw new Refused('That date has already passed.')
  if (d > max) throw new Refused('Choose a date within the next year.')
  return d
}
export const describeDate = fmt
export const runAt = (date, slot) => new Date(`${date}T${SLOTS[slot] || SLOTS.morning}`)

export async function schedule(kind, at, data, label) {
  const r = await one('insert into scheduled_changes (run_at, kind, data, label) values ($1, $2, $3, $4) returning id, run_at, label', [at, kind, JSON.stringify(data), label])
  return r
}
export const pending = async () => (await q("select id, run_at, kind, data, label from scheduled_changes where done_at is null order by run_at limit 50")).rows
export async function cancelScheduled(id) {
  const r = await one("update scheduled_changes set done_at = now(), result = 'cancelled' where id = $1 and done_at is null returning id", [id])
  if (!r) throw new Refused('That was already done or cancelled.')
  return { ok: true }
}

// Run everything that is due. Each row is claimed first, so it can never run twice.
export async function processDue() {
  const done = []
  const due = (await q("update scheduled_changes set done_at = now() where id in (select id from scheduled_changes where done_at is null and run_at <= now() order by run_at limit 20) returning id, kind, data, label")).rows
  for (const c of due) {
    let result = 'done'
    try {
      if (c.kind === 'publish_post') {
        const owner = await one("select id, email, name, role, perms from admin_users where role = 'owner' and disabled_at is null limit 1")
        const p = await one("select id, title, slug, status from posts where id = $1", [c.data.postId])
        if (!p) result = 'skipped: the draft no longer exists'
        else if (p.status === 'live') result = 'skipped: it was already live'
        else { await run(owner, null, { action: 'publish', type: 'post', id: p.id }); await notify('published', `Your scheduled post is live: “${p.title}”.`, '/admin/blog') }
      } else if (c.kind === 'set_mode') {
        await q('update assistant_settings set mode = $1, updated_at = now() where id = 1', [c.data.mode === 'autopilot' ? 'autopilot' : 'approval'])
        if (c.data.mode !== 'autopilot') await q("update posts set auto_publish_at = null where origin = 'assistant' and status = 'waiting'")
      } else if (c.kind === 'set_pace') await q('update assistant_settings set pace = $1, updated_at = now() where id = 1', [Math.min(3, Math.max(1, Number(c.data.pace) || 2))])
    } catch (e) { result = 'failed: ' + e.message }
    await q('update scheduled_changes set result = $2 where id = $1', [c.id, result.slice(0, 300)])
    done.push({ id: c.id, label: c.label, result })
  }
  return done
}
