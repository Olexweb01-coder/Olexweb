// The posting agent (Install 10): one per platform. It decides how many posts a day (1 to 3) and when, from real results.
// - Starts at 1 a day. Goes up one step only when views per video held (≥ 90% of the period before), the share watched
//   held, and at least 3 days of videos are ready ahead. Goes down when views per video fell by 30% or more, or when
//   there's less than a day of videos ready. Never above 3 a day.
// - Times: the best hours from bestTimes() (niche research, when viewers are awake, his own results), 2 hours apart.
//   Every 4th review one time is swapped for a test hour, so new hours get tried; his own results then teach bestTimes().
// - Reviews once a week (or at once when first switched on), and writes a plain-English note (Today tab + phone).
// - Facebook: we don't read Reel views yet, so it never raises Facebook on guesswork: it only steps down when videos run
//   short and back up to what you had when they're plentiful again. Times stay yours.
// - Setting times by hand switches that platform's agent off (your choice wins). Turn it back on from the Today tab.
import 'server-only'
import { q, one } from '@/lib/admin/db'
import { bestTimes, START_TIMES } from './publish'
import { notify } from '@/lib/assistant/notify'

export const CAP = 3
const WEEK = 7 * 86400e3
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const med = (a) => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); return b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2 }
const spaced = (list, t) => list.every((x) => Math.abs(toMin(x) - toMin(t)) >= 120)
const FB_DEFAULT = { 1: ['20:00'], 2: ['13:00', '20:00'], 3: ['12:00', '16:00', '20:00'] }

async function rowOf(platform) {
  await q("insert into post_agent (platform) values ($1) on conflict do nothing", [platform])
  return one('select platform, enabled, per_day, reviewed_at, reviews, note, history, base_per_day from post_agent where platform = $1', [platform])
}

// ---------- YouTube's numbers: each video's views 3 days after it went up, and the share watched ----------
async function ytPeriods() {
  const rows = (await q(`select v.video_id, v.published_at, v.views, v.avg_view_pct,
      (select s.views from yt_snap s where s.video_id = v.video_id and s.day >= (v.published_at at time zone 'Africa/Lagos')::date + 3 order by s.day limit 1) as d3
    from yt_videos v where v.published_at > now() - interval '24 days' and v.published_at < now() - interval '3 days'`)).rows
  const split = (from, to) => rows.filter((r) => { const age = Date.now() - new Date(r.published_at).getTime(); return age >= from * 86400e3 && age < to * 86400e3 })
  const sum = (list) => ({ n: list.length, views: med(list.map((r) => Number(r.d3 != null ? r.d3 : r.views) || 0)), watched: med(list.filter((r) => r.avg_view_pct != null).map((r) => Number(r.avg_view_pct))) })
  return { recent: sum(split(3, 10)), before: sum(split(10, 24)) }
}
async function ytReady() {
  return (await one(`select count(*)::int n from yt_scripts s left join yt_ideas i on i.id = s.idea_id where s.status = 'rendered' and (s.video->>'bytes') is not null
    and coalesce(i.channels->>'youtube', 'true') <> 'false'`)).n
}
async function fbReady() {
  return (await one(`select count(*)::int n from yt_scripts s where s.kind is distinct from 'long' and s.video is not null and (s.video->>'bytes') is not null
    and coalesce(s.fb->>'status', '') not in ('posted', 'skipped', 'off') and coalesce((s.fb->>'tries')::int, 0) < 3
    and (s.status = 'rendered' or (s.status = 'uploaded' and s.fb->>'status' in ('pending', 'failed') and s.uploaded_at > now() - interval '4 days'))
    and coalesce((select i.channels->>'facebook' from yt_ideas i where i.id = s.idea_id), 'true') <> 'false'`)).n
}

// The frequency rule, kept pure so it can be checked on its own. Returns { perDay, why }.
export function decideFrequency({ perDay, ready, recent, before, hasNumbers = true, ceiling = CAP }) {
  const ahead = perDay ? ready / perDay : 0
  if (ahead < 1 && perDay > 1) return { perDay: perDay - 1, why: `only ${ready} video${ready === 1 ? '' : 's'} ready, less than a day’s worth, so it posts less until production catches up` }
  if (!hasNumbers) {
    if (ahead >= 3 && perDay < ceiling) return { perDay: perDay + 1, why: `videos are plentiful again (${ready} ready), so it goes back to ${perDay + 1} a day` }
    return { perDay, why: 'there are no view numbers for this platform yet, so it isn’t raised on guesswork' }
  }
  if (!recent || !before || recent.n < 3 || before.n < 3 || !before.views) {
    const need = Math.max(0, 3 - (recent ? recent.n : 0)) + Math.max(0, 3 - (before ? before.n : 0))
    return { perDay, why: `not enough results yet to judge (${need} more video${need === 1 ? '' : 's'} with 3 days of views needed)` }
  }
  const ratio = recent.views / before.views, pct = Math.round((ratio - 1) * 100)
  const watchHeld = recent.watched == null || before.watched == null || recent.watched >= before.watched - 5
  if (ratio < 0.7 && perDay > 1) return { perDay: perDay - 1, why: `views per video fell ${-pct}% (${Math.round(recent.views)} vs ${Math.round(before.views)}), so fewer, stronger posts` }
  if (ratio >= 0.9 && watchHeld && ahead >= 3 && perDay < ceiling) return { perDay: perDay + 1, why: `views per video held (${pct >= 0 ? '+' : ''}${pct}%), the share watched held, and ${ready} videos are ready ahead` }
  if (ratio >= 0.9 && watchHeld && perDay < ceiling) return { perDay, why: `results held (${pct >= 0 ? '+' : ''}${pct}%), but fewer than 3 days of videos are ready, so it waits before posting more` }
  return { perDay, why: perDay >= ceiling ? `at the most it allows (${ceiling} a day)` : `views per video ${pct >= 0 ? 'rose ' + pct : 'fell ' + -pct}%, not clear enough to change` }
}

// YouTube's times: the best-scoring hours, 2 hours apart; every 4th review one is swapped for a test hour
async function ytTimes(n, reviews, current) {
  const best = await bestTimes().catch(() => ({ picks: [] }))
  const ranked = [...best.picks.map((p) => p.time), ...START_TIMES.map((s) => s.time), ...current]
  const out = []; for (const t of ranked) if (out.length < n && !out.includes(t) && spaced(out, t)) out.push(t)
  let test = null
  if (reviews % 4 === 3 && out.length) {
    const tried = new Set(ranked), cands = ['11:00', '13:00', '15:00', '19:00', '21:00', '09:00'].filter((t) => !tried.has(t))
    const keep = out.slice(0, -1), pick = cands.find((t) => spaced(keep, t))
    if (pick) { test = { out: out[out.length - 1], in: pick }; out[out.length - 1] = pick }
  }
  return { times: out.sort(), test, evidence: best.picks.length }
}
function fbTimesFor(n, current) {
  const out = []; for (const t of [...current, ...FB_DEFAULT[n], ...FB_DEFAULT[3]]) if (out.length < n && !out.includes(t) && spaced(out, t)) out.push(t)
  return out.sort()
}

// ---------- the weekly review ----------
export async function review(platform, { force = false } = {}) {
  const a = await rowOf(platform)
  if (!a.enabled) return null
  if (!force && a.reviewed_at && Date.now() - new Date(a.reviewed_at).getTime() < WEEK) return null
  const first = !a.reviewed_at
  let res
  if (platform === 'youtube') {
    const st = await one('select publish_time, publish_time2, publish_time3, publish_mode from yt_settings where id = 1')
    const current = [st.publish_time, st.publish_time2, st.publish_time3].filter(Boolean)
    const ready = await ytReady(), p = await ytPeriods()
    const f = first ? { perDay: 1, why: 'it starts at 1 a day and only adds more when results and production allow' } : decideFrequency({ perDay: a.per_day, ready, ...p })
    const t = await ytTimes(f.perDay, a.reviews, current)
    await q('update yt_settings set publish_time = $1, publish_time2 = $2, publish_time3 = $3 where id = 1', [t.times[0], t.times[1] || null, t.times[2] || null])
    res = { perDay: f.perDay, why: f.why, times: t.times, test: t.test, ready, from: { perDay: first ? current.length : a.per_day, times: current }, numbers: p }
  } else {
    const st = await one('select per_day, times, enabled from meta_settings where id = 1')
    const current = String(st.times || '').split(',').map((s) => s.trim()).filter((s) => /^\d\d:\d\d$/.test(s))
    const ready = await fbReady(), base = a.base_per_day || st.per_day || 1
    const f = first ? { perDay: 1, why: 'it starts at 1 a day; Reel view numbers aren’t read yet, so it won’t raise Facebook on guesswork' } : decideFrequency({ perDay: a.per_day, ready, hasNumbers: false, ceiling: first ? 1 : base })
    const times = fbTimesFor(f.perDay, current)
    await q('update meta_settings set per_day = $1, times = $2 where id = 1', [times.length, times.join(',')])
    res = { perDay: times.length, why: f.why, times, test: null, ready, from: { perDay: st.per_day, times: current } }
  }
  const name = platform === 'youtube' ? 'YouTube' : 'Facebook'
  const changed = res.from.perDay !== res.perDay ? `${res.from.perDay} → ${res.perDay} a day` : `stays at ${res.perDay} a day`
  const note = `${name}: ${changed}, at ${res.times.join(', ')} (Lagos), because ${res.why}.${res.test ? ` This week it tries ${res.test.in} instead of ${res.test.out} to learn whether that hour does better.` : ''}`
  const hist = [{ at: new Date().toISOString(), perDay: res.perDay, times: res.times, why: res.why, test: res.test }, ...(a.history || [])].slice(0, 26)
  await q(`update post_agent set per_day = $2, reviewed_at = now(), reviews = reviews + 1, note = $3, history = $4, base_per_day = coalesce(base_per_day, $5) where platform = $1`,
    [platform, res.perDay, note, JSON.stringify(hist), platform === 'facebook' ? Math.max(1, Number(res.from.perDay) || 1) : null])
  await notify('posting', note.slice(0, 170), '/admin/automation#at-agent')
  return { platform, ...res, note }
}
// The frequent run: each platform's agent reviews when its week is up (cheap check otherwise)
export async function postAgentRun() {
  const out = []
  for (const p of ['youtube', 'facebook']) {
    if (p === 'facebook' && !(await one('select 1 from meta_pages where selected'))) continue   // nothing to post to yet
    try { const r = await review(p); if (r) out.push(r) } catch (e) { out.push({ platform: p, error: e.message }) }
  }
  return out
}
export async function setAgent(platform, on) {
  if (!['youtube', 'facebook'].includes(platform)) throw new Error('Unknown platform.')
  await rowOf(platform)
  await q('update post_agent set enabled = $2, reviewed_at = case when $2 then null else reviewed_at end where platform = $1', [platform, on === true])   // on again: reviews at once
  return on === true ? (await review(platform, { force: true })) || { ok: true } : { ok: true }
}
// You chose times yourself: that platform's agent steps aside
export async function agentStepAside(platform) {
  await q("update post_agent set enabled = false, note = $2 where platform = $1 and enabled", [platform, 'You set the posting times yourself, so the agent stepped aside. Switch it on again to let it decide.'])
}
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dayName = (ms) => { const d = new Date(ms + 3600e3); return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` }   // Lagos date, same on server and browser
export async function agentState() {
  const out = {}
  for (const p of ['youtube', 'facebook']) {
    const a = await rowOf(p)
    out[p] = { enabled: a.enabled, perDay: a.per_day, note: a.note, reviewedAt: a.reviewed_at ? a.reviewed_at.toISOString() : null,
      nextReview: a.enabled ? (a.reviewed_at ? dayName(new Date(a.reviewed_at).getTime() + WEEK) : 'now') : null }
  }
  return out
}
