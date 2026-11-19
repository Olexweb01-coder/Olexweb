// Install 40: once a week Olex AI studies the numbers (YouTube: which videos people watched to the end and shared;
// Google Analytics: which pages people read and where they came from; Search Console: searches that show the site but
// don't get clicked) and writes a few plain rules from them. The video and article writers read those rules
// (lessonsFor), so each week's videos and articles lean towards what worked. The old weekly rules are replaced.
import 'server-only'
import { q, one } from '@/lib/admin/db'
import { askJSON } from './llm'
import { addLesson } from './memory'
import { gaSummary, gaReady } from '@/lib/site/ga'
export async function weeklyLearn({ force = false } = {}) {
  if (!force && (await one("select 1 from audit_log where action = 'weekly_learn' and at > now() - interval '6 days 20 hours'").catch(() => null))) return null
  const vids = (await q(`select title, views, avg_view_pct, shares, subs_gained, is_short from yt_videos where published_at > now() - interval '60 days' and views > 0 order by published_at desc limit 40`).catch(() => ({ rows: [] }))).rows
  let ga = null; try { ga = gaReady() ? await gaSummary() : null } catch { ga = null }
  const gsc = (await q("select key, clicks, impressions, position from gsc_queries where kind = 'query' and fetched_on = (select max(fetched_on) from gsc_queries) order by impressions desc limit 20").catch(() => ({ rows: [] }))).rows
  if (vids.length < 3 && !ga && !gsc.length) return { skipped: 'not enough numbers yet' }
  const d = await askJSON({ system: 'You are a growth analyst for a YouTube channel and a website. You turn numbers into a few short, concrete rules that a writer can follow. Only conclusions the numbers support.',
    prompt: `The last weeks' numbers.\n\nVIDEOS (title | views | average % watched | shares | subscribers gained):\n${vids.map((v) => `${v.title} | ${v.views} | ${v.avg_view_pct == null ? '?' : Math.round(v.avg_view_pct)} | ${v.shares ?? '?'} | ${v.subs_gained ?? '?'}`).join('\n') || 'none yet'}\n\nWEBSITE PAGES, last 28 days (path | views | seconds per visit | % engaged):\n${ga ? ga.pages.map((p) => `${p.path} | ${p.views} | ${p.secs} | ${p.engaged}`).join('\n') : 'not connected'}\nWHERE VISITORS COME FROM:\n${ga ? ga.sources.map((s) => `${s.source} | ${s.sessions} sessions | ${s.engaged}% engaged`).join('\n') : 'not connected'}\n\nGOOGLE SEARCHES THE SITE SHOWS UP FOR (search | clicks | times shown | position):\n${gsc.map((g) => `${g.key} | ${g.clicks} | ${g.impressions} | ${Number(g.position).toFixed(1)}`).join('\n') || 'none yet'}\n\nWrite up to 4 rules for the "You build it" videos (titles, the first line, topics, length) and up to 4 for the website's articles and pages (topics, titles, which searches to win). Each rule one sentence, starting with a verb, naming what the numbers showed (e.g. "Pick topics about the internet's hidden machines: the data centre and undersea cable videos were watched to 70%+ and shared most."). Answer as JSON: {"video":[...],"site":[...]}`,
    schema: { type: 'object', properties: { video: { type: 'array', items: { type: 'string' } }, site: { type: 'array', items: { type: 'string' } } }, required: ['video', 'site'] }, temperature: 0.4, kind: 'write' })
  const rules = [...(d.video || []).slice(0, 4).map((t) => 'YouTube video: ' + t), ...(d.site || []).slice(0, 4).map((t) => 'Website article: ' + t)].map((t) => String(t).slice(0, 280)).filter((t) => t.length > 20)
  if (!rules.length) return { skipped: 'no rules' }
  await q("update ai_memory set active = false, updated_at = now() where source = 'weekly'")
  for (const r of rules) await addLesson('rule', r, 'weekly')
  await q("insert into audit_log (action, detail) values ('weekly_learn', $1)", [JSON.stringify({ rules, videos: vids.length, ga: !!ga, searches: gsc.length })])
  return { rules }
}
