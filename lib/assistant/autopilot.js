// The daily run (Vercel's scheduler calls it once a day).
// 1. Today's research. 2. A new draft if the weekly pace allows (and the last was at least 2 days ago).
// 3. Autopilot only: drafts not reviewed within 24 hours get the safety pass, then publish if everything passes.
import 'server-only'
import { q, one } from '@/lib/admin/db'
import { refreshResearch } from './research'
import { Busy } from './llm'
import { processDue } from './schedule'
import { notify } from './notify'
import { fetchSearchConsole, gscReady } from '@/lib/site/gsc'
import { writeArticle, safetyPassAndPublish } from './write'

export async function dailyRun({ retry = false } = {}) {
  // retry = the afternoon run: it only redoes research or a draft that failed this morning because Gemini was busy
  const report = { run: retry ? 'afternoon retry' : 'morning', scheduled: [], paused: false, research: null, drafted: null, published: [], held: [], errors: [] }
  try { report.scheduled = await processDue() } catch (e) { report.errors.push('scheduled: ' + e.message) }
  if (!retry && gscReady()) {                                         // Search Console, once a day
    try { const g = await one('select last_fetch from gsc_state where id = 1'); if (!g.last_fetch || new Date(g.last_fetch) < Date.now() - 20 * 3600e3) report.searchConsole = await fetchSearchConsole() }
    catch (e) { report.errors.push('search console: ' + e.message) }
  }   // what you scheduled happens even while paused
  const s = await one('select mode, pace, paused_until from assistant_settings where id = 1')
  if (s.paused_until && new Date(s.paused_until) > new Date()) {
    report.paused = true; await q('update assistant_settings set last_run = now() where id = 1'); return report
  }
  const busyToday = async (what) => !!(await one("select 1 from audit_log where action = 'assistant_busy' and detail->>'step' = $1 and at >= date_trunc('day', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos' limit 1", [what]))
  const noteBusy = (what, e) => q("insert into audit_log (action, detail) values ('assistant_busy', $1)", [JSON.stringify({ step: what, message: e.message })])
  try {
    const haveToday = await one('select 1 from research_items where found_on = current_date limit 1')
    if (!haveToday && (!retry || (await busyToday('research')))) report.research = (await refreshResearch()).length
  } catch (e) { report.errors.push('research: ' + e.message); if (e instanceof Busy) await noteBusy('research', e) }
  try {
    const w = await one("select count(*)::int as n, max(at) as last from audit_log where action = 'assistant_drafted' and at > now() - interval '7 days'")
    const due = w.n < s.pace && (!w.last || new Date(w.last) < Date.now() - 2 * 86400e3)
    if (due && (!retry || (await busyToday('draft')))) {
      const item = await one("select id, topic, why, searches, sources from research_items where used_by is null and jsonb_array_length(sources) > 0 order by found_on desc, id limit 1")
      if (item) report.drafted = (await writeArticle(item, { mode: s.mode })).id
    }
  } catch (e) { report.errors.push('draft: ' + e.message); if (e instanceof Busy) await noteBusy('draft', e) }
  if (s.mode === 'autopilot') {                                       // needs no AI: it runs on both runs, even if Gemini is down
    const due = (await q("select id from posts where origin = 'assistant' and status = 'waiting' and auto_publish_at is not null and auto_publish_at <= now() order by auto_publish_at limit 3")).rows
    for (const d of due) { try { const r = await safetyPassAndPublish(d.id); (r.published ? report.published : report.held).push(d.id) } catch (e) { report.errors.push('publish: ' + e.message) } }
  }
  await q('update assistant_settings set last_run = now() where id = 1')
  if (report.errors.some((e) => /busy/i.test(e))) await notify('busy', retry ? 'Gemini is still busy. Olex AI will try again tomorrow morning.' : 'Gemini was busy this morning. Olex AI will try again this afternoon.', '/admin/assistant')
  else if (!retry && !report.research && !report.drafted && !report.published.length) await notify('run', 'Today’s run is done. Nothing new was due today.', '/admin/assistant')
  return report
}
