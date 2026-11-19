// Install 38: what needs you, and what's new, section by section. The sidebar shows a red number where something needs
// you and a red dot where something new happened; the app icon on your home screen shows the total.
import 'server-only'
import { q, one } from '@/lib/admin/db'

// which sidebar section a link belongs to ("/admin/youtube?view=x" → automation; "/admin" → overview)
export function sectionOf(url) {
  const m = /^\/admin\/([a-z0-9-]+)/.exec(String(url || '')), s = m ? m[1] : 'overview'
  return { youtube: 'automation' }[s] || s
}
const n = async (sql) => { try { const r = await one(sql); return r ? Number(Object.values(r)[0]) || 0 : 0 } catch { return 0 } }

export async function attention() {
  const need = {
    reviews: await n("select count(*) from testimonials where status = 'waiting'"),
    leads: await n("select count(*) from leads where status = 'new'"),
    downloads: await n("select count(*) from app_access where status = 'waiting'"),
    // only what is really yours to do: on Autopilot, videos and articles don't wait for you
    automation: (await n("select case when yt_mode = 'autopilot' then 0 else (select count(*) from yt_scripts where status in ('draft', 'needs_review')) end from yt_settings where id = 1"))
      + (await n("select case when enabled and paused_reason is not null then 1 else 0 end from meta_settings where id = 1"))
      + (await n("select case when finished_at < now() - interval '45 minutes' then 1 else 0 end from run_locks where name = 'quick'")),
    blog: await n("select case when mode = 'autopilot' then 0 else (select count(*) from posts where status = 'waiting') end from assistant_settings where id = 1"),
  }
  const fresh = {}
  try { for (const r of (await q("select section, count(*)::int c from admin_updates where seen_at is null and at > now() - interval '14 days' group by section")).rows) fresh[r.section] = r.c } catch {}
  const sections = {}
  for (const k of new Set([...Object.keys(need), ...Object.keys(fresh)])) sections[k] = { need: need[k] || 0, fresh: fresh[k] || 0 }
  const total = Object.values(sections).reduce((a, s) => a + s.need + s.fresh, 0)
  return { sections, total }
}
export async function markSeen(section) {
  await q('update admin_updates set seen_at = now() where section = $1 and seen_at is null', [String(section || '').slice(0, 40)])
}
export async function addUpdate(body, url) {
  await q('insert into admin_updates (section, body, url) values ($1, $2, $3)', [sectionOf(url), String(body).slice(0, 300), String(url || '/admin').slice(0, 300)])
  await q("delete from admin_updates where at < now() - interval '30 days'").catch(() => {})
}
