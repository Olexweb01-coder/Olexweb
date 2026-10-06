// The daily run (Vercel's scheduler calls it once a day).
// 1. Today's research. 2. A new draft if the weekly pace allows (and the last was at least 2 days ago).
// 3. Autopilot only: drafts not reviewed within 24 hours get the safety pass, then publish if everything passes.
import 'server-only'
import { q, one } from '@/lib/admin/db'
import { refreshResearch } from './research'
import { writeArticle, safetyPassAndPublish } from './write'

export async function dailyRun() {
  const s = await one('select mode, pace from assistant_settings where id = 1'), report = { research: null, drafted: null, published: [], held: [], errors: [] }
  try { if (!(await one('select 1 from research_items where found_on = current_date limit 1'))) report.research = (await refreshResearch()).length } catch (e) { report.errors.push('research: ' + e.message) }
  try {
    const w = await one("select count(*)::int as n, max(at) as last from audit_log where action = 'assistant_drafted' and at > now() - interval '7 days'")
    if (w.n < s.pace && (!w.last || new Date(w.last) < Date.now() - 2 * 86400e3)) {
      const item = await one("select id, topic, why, searches, sources from research_items where used_by is null and jsonb_array_length(sources) > 0 order by found_on desc, id limit 1")
      if (item) report.drafted = (await writeArticle(item, { mode: s.mode })).id
    }
  } catch (e) { report.errors.push('draft: ' + e.message) }
  if (s.mode === 'autopilot') {
    const due = (await q("select id from posts where origin = 'assistant' and status = 'waiting' and auto_publish_at is not null and auto_publish_at <= now() order by auto_publish_at limit 3")).rows
    for (const d of due) { try { const r = await safetyPassAndPublish(d.id); (r.published ? report.published : report.held).push(d.id) } catch (e) { report.errors.push('publish: ' + e.message) } }
  }
  await q('update assistant_settings set last_run = now() where id = 1')
  return report
}
