// The daily run (Vercel's scheduler calls it once a day).
// 1. Today's research. 2. A new draft if the weekly pace allows (and the last was at least 2 days ago).
// 3. Drafts whose review window (7, 12 or 24 hours) ran out get the safety pass, then publish if everything passes.
import { salesRun } from '@/lib/sales'
import 'server-only'
import { q, one } from '@/lib/admin/db'
import { refreshResearch } from './research'
import { Busy } from './llm'
import { processDue } from './schedule'
import { notify } from './notify'
import { fetchSearchConsole, gscReady } from '@/lib/site/gsc'
import { syncYouTube, youtubeConnected, ytReady, youtubeHousekeeping } from '@/lib/site/youtube'
import { directoryRun } from '@/lib/site/directory'
import { postNext as facebookNext } from '@/lib/site/meta'
import { findIdeas, ideasDue } from '@/lib/site/ideas'
import { writeNextScript } from '@/lib/site/scripts'
import { longDue, writeLong } from '@/lib/site/longform'
import { sagaDue, writeSaga } from '@/lib/site/saga'
import { storyStyle } from '@/lib/site/story'
import { sendNext, sweepStuck } from '@/lib/site/factory'
import { uploadNext, autoQueue, sagaNext } from '@/lib/site/publish'
import { autonomySweep } from '@/lib/site/autonomy'
import { postAgentRun } from '@/lib/site/postagent'
import { writeArticle } from './write'
import { processWindows, ensureTools } from './tools'
import { meetingReminders } from '@/lib/site/meet'
import { forgetOldDetails } from '@/lib/meet/guests'
import { usageWatch } from '@/lib/meet/usage'

// The quick run (every few minutes if you set up the free pinger): scheduled items and review windows only.
// Spacing between blog drafts: 3 a week or fewer keeps "at least 2 days apart"; more spreads them evenly through the week.
export const gapHours = (pace) => (pace <= 3 ? 48 : Math.max(6, Math.floor((168 / pace) * 0.8)))
// Above 3 a week the morning run alone can't keep up, so the frequent run also writes when a draft is due.
async function draftIfDue(report) {
  const s = await one('select mode, pace, paused_until from assistant_settings where id = 1')
  if (!s || s.pace <= 3 || (s.paused_until && new Date(s.paused_until) > new Date())) return
  const w = await one("select count(*)::int as n, max(at) as last from audit_log where action = 'assistant_drafted' and at > now() - interval '7 days'")
  if (!(w.n < s.pace && (!w.last || new Date(w.last) < Date.now() - gapHours(s.pace) * 3600e3))) return
  let item = await one("select id, topic, why, searches, sources from research_items where used_by is null and jsonb_array_length(sources) > 0 order by found_on desc, id limit 1")
  if (!item) {                                                        // topics used up: fresh research, at most every 6 hours
    const go = await one("update assistant_settings set research_at = now() where id = 1 and (research_at is null or research_at < now() - interval '6 hours') returning id")
    if (!go) return
    await refreshResearch(); item = await one("select id, topic, why, searches, sources from research_items where used_by is null and jsonb_array_length(sources) > 0 order by found_on desc, id limit 1")
  }
  if (item) report.drafted = (await writeArticle(item, { mode: s.mode })).id
}
export async function quickRun() {
  const report = { run: 'quick', scheduled: [], errors: [] }
  try { report.scheduled = await processDue() } catch (e) { report.errors.push('scheduled: ' + e.message) }
  try { Object.assign(report, await processWindows()) } catch (e) { report.errors.push('windows: ' + e.message) }
  try { const m = await meetingReminders(); if (m.length) report.meetings = m } catch (e) { report.errors.push('meetings: ' + e.message) }   // scheduled meetings' reminders
  try { const n = await forgetOldDetails(); if (n) report.forgotGuests = n } catch (e) { report.errors.push('meet guests: ' + e.message) }   // guests' details past their keeping time
  try { const w = await usageWatch(); if (w.length) report.usageWarned = w } catch (e) { report.errors.push('meet usage: ' + e.message) }   // Meet's monthly limits
  try { if (ytReady() && await ideasDue()) report.ideas = await findIdeas() } catch (e) { if (!/already running/.test(e.message)) report.errors.push('youtube ideas: ' + e.message) }   // once a day
  // Story style (Install 13): the day's long story is the main video and its Shorts are cut from it, so picked ideas wait for
  // the long story instead of becoming Shorts one by one. Classic style: one Short per picked idea, and the old long video.
  const story = await storyStyle().catch(() => 'classic') === 'story'
  if (!report.ideas && !story) try { const w = await writeNextScript(); if (w) report.script = w } catch (e) { report.errors.push('youtube script: ' + e.message) }   // one picked idea at a time
  if (!report.ideas && !report.script) try {
    if (story) { if (ytReady() && await sagaDue()) report.long = await writeSaga() }                  // the long story, on the long-video days
    else if (ytReady() && await longDue()) report.long = await writeLong()                         // twice a week
  } catch (e) { report.errors.push((story ? 'youtube long story: ' : 'youtube long video: ') + e.message) }
  try { const p = await postAgentRun(); if (p.length) report.posting = p.map((x) => x.error ? x.platform + ': ' + x.error : x.note) } catch (e) { report.errors.push('posting agent: ' + e.message) }   // weekly: how often and when
  try {                                                                 // the factory: clear a stuck render; in Autopilot, send the next approved script
    await sweepStuck()
    const m = await one('select yt_mode as mode from yt_settings where id = 1')              // YouTube's own switch (separate from the blog)
    if (m && m.mode === 'autopilot') {
      try { const a = await autonomySweep(); if (a && (a.approved || a.replaced || a.remade)) report.autonomy = a } catch (e) { report.errors.push('autopilot fixes: ' + e.message) }   // no human gate
      const f = await sendNext(); if (f) report.factory = f
      try { const l = await sagaNext(); if (l) report.uploadedLong = l } catch (e) { report.errors.push('youtube long story upload: ' + e.message) }   // the long story's own time (first, so its Shorts can queue now)
      await autoQueue(); const u = await uploadNext(); if (u) report.uploaded = u }
  } catch (e) { report.errors.push('youtube factory: ' + e.message) }
  try { const f = await facebookNext(); if (f) report.facebook = f } catch (e) { report.errors.push('facebook: ' + e.message) }   // the day's Reel, when Facebook posting is on
  try { const s = await salesRun(); if (s) report.sales = s } catch (e) { report.errors.push('sales: ' + e.message) }   // Olex Sales: read a few sites, draft, send at most one
  try { await draftIfDue(report) } catch (e) { report.errors.push('blog draft: ' + e.message) }   // only when the pace is above 3 a week
  if (!report.ideas && !report.script && !report.long && !report.drafted) try { const d = await directoryRun({ max: 2, deadlineMs: 30000 }); if (d && d.wrote) report.directory = d } catch (e) { report.errors.push('directory: ' + e.message) }   // the Directory grows by itself
  return report
}

export async function dailyRun({ retry = false } = {}) {
  // retry = the afternoon run: it only redoes research or a draft that failed this morning because Gemini was busy
  const report = { run: retry ? 'afternoon retry' : 'morning', scheduled: [], paused: false, research: null, drafted: null, published: [], held: [], errors: [] }
  try { report.scheduled = await processDue() } catch (e) { report.errors.push('scheduled: ' + e.message) }
  if (!retry && gscReady()) {                                         // Search Console, once a day
    try { const g = await one('select last_fetch from gsc_state where id = 1'); if (!g.last_fetch || new Date(g.last_fetch) < Date.now() - 20 * 3600e3) report.searchConsole = await fetchSearchConsole() }
    catch (e) { report.errors.push('search console: ' + e.message) }
  }   // what you scheduled happens even while paused
  if (ytReady()) try { report.youtubeRules = await youtubeHousekeeping() } catch (e) { report.errors.push('youtube housekeeping: ' + e.message) }   // YouTube's data rules, daily
  if (ytReady()) {                                                    // YouTube numbers, morning and afternoon (a few units of the daily allowance)
    try { const y = await youtubeConnected(); if (y.connected && (!y.last_sync || new Date(y.last_sync) < Date.now() - 6 * 3600e3)) report.youtube = await syncYouTube() }
    catch (e) { report.errors.push('youtube: ' + e.message) }
  }
  if (retry && ytReady()) {                                           // ideas, if the frequent run (the pinger) hasn't found them today
    try { if (await ideasDue()) report.ideas = await findIdeas() } catch (e) { if (!/already running/.test(e.message)) report.errors.push('youtube ideas: ' + e.message) }
    try { const w = await writeNextScript(); if (w) report.script = w } catch (e) { report.errors.push('youtube script: ' + e.message) }
  }
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
    const due = w.n < s.pace && (!w.last || new Date(w.last) < Date.now() - gapHours(s.pace) * 3600e3)
    if (due && (!retry || (await busyToday('draft')))) {
      const item = await one("select id, topic, why, searches, sources from research_items where used_by is null and jsonb_array_length(sources) > 0 order by found_on desc, id limit 1")
      if (item) report.drafted = (await writeArticle(item, { mode: s.mode })).id
    }
  } catch (e) { report.errors.push('draft: ' + e.message); if (e instanceof Busy) await noteBusy('draft', e) }
  try { const w = await processWindows(); report.published = w.published; report.held = w.held } catch (e) { report.errors.push('publish: ' + e.message) }   // needs no AI
  await q('update assistant_settings set last_run = now() where id = 1')
  if (report.errors.some((e) => /busy/i.test(e))) await notify('busy', retry ? 'Gemini is still busy. Olex AI will try again tomorrow morning.' : 'Gemini was busy this morning. Olex AI will try again this afternoon.', '/admin/assistant')
  else if (!retry && !report.research && !report.drafted && !report.published.length) await notify('run', 'Today’s run is done. Nothing new was due today.', '/admin/assistant')
  return report
}
