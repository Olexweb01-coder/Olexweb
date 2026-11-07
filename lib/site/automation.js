// Automation: one place for every channel. YouTube and Facebook each have their own switch, times and queue, and both pick
// from the same library of finished videos (so if both post 2 a day, the same videos go to both and the factory must keep up).
import 'server-only'
import { q, one } from '@/lib/admin/db'
import { queueList } from './publish'
import { metaStatus } from './meta'
import { sendNext } from './factory'
import { writeNextScript } from './scripts'
import { autonomyState, MAX_RENDER_TRIES } from './autonomy'
import { progressOf } from './progress'
import { agentState } from './postagent'
import { lastRun } from '@/lib/assistant/runlock'

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`

export async function overviewData() {
  const yt = await one('select yt_mode, publish_mode from yt_settings where id = 1')
  const acct = await one('select channel_id from yt_account where id = 1').catch(() => null)
  const queue = await queueList()
  const fb = await metaStatus().catch(() => null)
  const fbOn = !!(fb && fb.ready && fb.enabled && fb.page && !fb.paused)
  const ytAuto = yt.yt_mode === 'autopilot'

  // what the channels need a day: the same videos serve both, so it's the bigger of the two
  const need = Math.max(ytAuto ? queue.perDay : 0, fbOn ? fb.perDay : 0)
  const made = (await one(`select count(*)::int n from yt_scripts where kind not in ('long', 'saga') and video is not null
    and coalesce((video->>'made_at')::timestamptz, updated_at) > now() - interval '7 days' and status in ('rendered', 'uploaded')`)).n
  // finished videos at least one channel still has to post (YouTube: not uploaded yet; Facebook: waiting in its queue)
  // (with the Library's ticks: YouTube still wants it if ticked and not uploaded; Facebook if ticked and not posted or given up)
  const ready = (await one(`select count(*)::int n from yt_scripts s left join yt_ideas i on i.id = s.idea_id where s.kind not in ('long', 'saga') and s.video is not null and (s.video->>'bytes') is not null
    and ((s.status = 'rendered' and coalesce(i.channels->>'youtube', 'true') <> 'false')
      or (coalesce(i.channels->>'facebook', 'true') <> 'false' and coalesce(s.fb->>'status', '') not in ('posted', 'skipped', 'off')
        and (s.status = 'rendered' or (s.status = 'uploaded' and s.fb->>'status' in ('pending', 'failed')))))`)).n
  const perDay = Math.round((made / 7) * 10) / 10
  const days = need ? Math.floor(ready / need) : null
  const short = need > 0 && (perDay < need || days < 3)   // production stays 3 days ahead

  const waitingScripts = ytAuto ? 0 : (await one("select count(*)::int n from yt_scripts where status in ('draft', 'needs_review')")).n
  const blogWaiting = (await one("select count(*)::int n from posts where status = 'waiting'")).n
  const needs = []
  if (waitingScripts) needs.push({ text: `${plural(waitingScripts, 'script')} waiting for approval`, href: '/admin/youtube?view=scripts' })
  const auto = ytAuto ? await autonomyState() : null                 // Autopilot: nothing waits for you; say what it's handling itself
  if (auto) for (const g of auto.gaveUp) needs.push({ text: `${g.name}: the factory failed ${MAX_RENDER_TRIES} times (${String(g.render_error || '').slice(0, 80)})`, href: '/admin/youtube?view=progress' })
  if (blogWaiting) needs.push({ text: `Blog: ${plural(blogWaiting, 'draft')} waiting`, href: '/admin/blog' })
  if (fb && fb.paused) needs.push({ text: 'Facebook posting is paused', href: '/admin/automation/facebook' })
  if (!ytAuto) needs.push({ text: 'YouTube is on Approval: new scripts wait for you', href: '/admin/youtube?view=scripts' })

  const ytToday = queue.todayDone, next = queue.items.find((x) => x.day === queue.today)
  return {
    production: { need, perDay, ready, days, short, channels: [ytAuto ? 'YouTube' : null, fbOn ? 'Facebook' : null].filter(Boolean) },
    youtube: { connected: !!(acct && acct.channel_id), mode: yt.yt_mode, times: queue.times, todayDone: ytToday, nextToday: next ? next.time : null, queue: queue.items.length,
      queueDays: queue.perDay ? Math.round((queue.items.length / queue.perDay) * 2) / 2 : 0, status: yt.publish_mode === 'scheduled' ? 'Public at its posting times' : 'Private until the audit' },
    facebook: fb ? { ready: fb.ready, connected: !!fb.page, page: fb.page && fb.page.name, enabled: fb.enabled, paused: !!fb.paused, times: fb.times, perDay: fb.perDay,
      todayDone: fb.queue.todayDone, nextToday: (fb.queue.items.find((x) => x.when === 'today') || {}).time || null, queue: fb.queue.waiting } : null,
    needs,
    onHold: auto ? auto.held : [],
  }
}

// YouTube Approval / Autopilot (the YouTube screen and Olex AI both use this). Autopilot also releases scripts that were
// waiting for you and passed every check; ones that failed a check still need your eye.
export async function setYoutubeMode(mode) {
  const m = mode === 'autopilot' ? 'autopilot' : 'approval'
  await q('update yt_settings set yt_mode = $1 where id = 1', [m])
  const released = m === 'autopilot' ? (await q("update yt_scripts set status = 'approved', approved_at = now(), updated_at = now() where status = 'draft' returning id")).rowCount : 0
  // scripts that failed a check get their hour from now (then Autopilot mends or replaces them); on Approval they wait for you
  await q(`update yt_scripts set hold_until = ${m === 'autopilot' ? "now() + interval '60 minutes'" : 'null'} where status = 'needs_review'`)
  return { ok: true, mode: m, released }
}

// "Make more": send the next approved script to the factory now; if none is waiting, write the next script from a picked idea
export async function makeMore() {
  const f = await sendNext().catch((e) => { throw new Error('The factory couldn’t start: ' + e.message) })
  if (f) return { ok: true, message: 'The next video is on its way to the factory.' }
  if (await one("select 1 from yt_scripts where status = 'rendering'")) return { ok: true, message: 'The factory is already making a video. The next one starts when it’s done.' }
  const w = await writeNextScript()
  if (w) return { ok: true, message: 'A new script is being written. On Autopilot it goes to the factory by itself.' }
  return { ok: true, message: 'No picked ideas are waiting. Olex AI finds new ones every day, or pick some in YouTube → Ideas.' }
}

// ---------- The Today tab: one look at the day, in sections (works on a phone first) ----------
const lagosDay = (ms) => new Date(ms + 3600e3).toISOString().slice(0, 10)
const lagosHM = (ms) => new Date(ms + 3600e3).toISOString().slice(11, 16)
const slotAt = (day, hhmm) => Date.parse(`${day}T${hhmm}:00Z`) - 3600e3            // Lagos is UTC+1 all year
function inWords(ms) {                                                             // worked out on the server: no clock differences in the browser
  const m = Math.round(ms / 60000); if (m <= 0) return 'Due now'
  if (m < 60) return `In ${m} min`
  const h = Math.floor(m / 60), r = m % 60; return `In ${h} h${r ? ' ' + r + ' min' : ''}`
}
export async function todayData() {
  const o = await overviewData(), now = Date.now(), today = lagosDay(now)
  const queue = await queueList(), fb = await metaStatus().catch(() => null)
  // YouTube: what went out today, then what's queued for today's times, then today's empty times
  // a video belongs to the day of its slot: in scheduled mode it goes up the day before and is public at the time, so it
  // counts for today (not yesterday) and today's time isn't shown as empty
  const kindName = (k) => k === 'long' ? 'Long video' : k === 'saga' ? 'Long story' : 'Short'
  const sagaTime = ((await one('select saga_time from yt_settings where id = 1').catch(() => null)) || {}).saga_time || '16:00'
  const ytDone = (await q(`select s.kind, coalesce(i.name, 'Long video') as name, s.package->>'title' as title, s.upload->>'slot' as slot, s.upload->>'privacy' as privacy, s.upload->>'publishAt' as publish_at, s.uploaded_at
    from yt_scripts s left join yt_ideas i on i.id = s.idea_id where s.uploaded_at > now() - interval '54 hours' order by s.uploaded_at`)).rows
    .filter((r) => r.slot ? r.slot.startsWith(today) : lagosDay(new Date(r.uploaded_at).getTime()) === today)
    .map((r) => { const later = r.publish_at && Date.parse(r.publish_at) > now
      return { time: r.slot ? (r.slot.endsWith(' saga') ? sagaTime : r.slot.slice(11, 16)) : lagosHM(new Date(r.uploaded_at).getTime()), title: r.title || r.name,
        what: `${kindName(r.kind)} · ${later ? 'Goes public at the time' : String(r.privacy || 'private').split(' ')[0] === 'public' ? 'Public' : 'Private'}`, state: 'done', label: later ? 'Scheduled' : 'Posted' } })
  const ytNext = queue.items.filter((x) => x.day === today).map((x) => ({ time: x.time, title: x.title || x.name, what: kindName(x.kind), state: 'next', label: inWords(slotAt(today, x.time) - now) }))
  // the long story has its own time: shown when today's is finished and waiting for it
  if (!ytDone.some((r) => r.what.startsWith('Long story')) && slotAt(today, sagaTime) > now - 3 * 3600e3) {
    const l = await one("select package->>'title' as title from yt_scripts where kind = 'saga' and status = 'rendered' and queue_pos is null order by id limit 1").catch(() => null)
    if (l) ytNext.push({ time: sagaTime, title: l.title || 'Today’s long story', what: 'Long story', state: 'next', label: inWords(slotAt(today, sagaTime) - now) })
  }
  const ytAuto = o.youtube.mode === 'autopilot'
  const ytTimes = new Set([...ytDone, ...ytNext].map((x) => x.time))
  const ytEmpty = ytAuto && o.youtube.connected ? queue.times.filter((t) => !ytTimes.has(t) && slotAt(today, t) > now).map((t) => ({ time: t, title: 'No video ready for this time yet', what: 'Autopilot fills it if one finishes in time', state: 'empty', label: 'Empty' })) : []
  // Facebook: Reels posted today, then today's queue
  let fbRows = []
  if (fb && fb.page) {
    const done = (await q(`select p.slot, p.at, coalesce(i.name, 'Short') as name, s.package->>'title' as title from meta_posts p left join yt_scripts s on s.id = p.script_id
      left join yt_ideas i on i.id = s.idea_id where p.at > now() - interval '30 hours' order by p.at`)).rows
      .filter((r) => lagosDay(new Date(r.at).getTime()) === today)
      .map((r) => ({ time: r.slot && r.slot.startsWith(today) ? r.slot.slice(11, 16) : lagosHM(new Date(r.at).getTime()), title: r.title || r.name, what: 'Reel', state: 'done', label: 'Posted' }))
    const next = fb.queue.items.filter((x) => x.when === 'today').map((x) => ({ time: x.time, title: x.name, what: 'Reel', state: fb.enabled && !fb.paused ? 'next' : 'empty', label: fb.paused ? 'Paused' : fb.enabled ? inWords(slotAt(today, x.time) - now) : 'Off' }))
    fbRows = [...done, ...next]
  }
  const byTime = (a, b) => a.time.localeCompare(b.time)
  // being made: the factory's current video, and what's lined up behind it
  const making = await one("select s.id, s.kind, s.script, coalesce(i.name, 'Long video') as name from yt_scripts s left join yt_ideas i on i.id = s.idea_id where s.status = 'rendering' limit 1")
  const job = making ? await progressOf('render').catch(() => null) : null
  const stage = job && job.stages ? (job.stages.find((s) => s.key === job.stage) || {}).label : null
  const pct = job && job.stages ? Math.round(100 * job.stages.filter((s) => s.secs != null).length / job.stages.length) : 0
  const lined = (await one("select count(*) filter (where status = 'approved')::int as approved, count(*) filter (where status = 'needs_review')::int as held from yt_scripts")) || { approved: 0, held: 0 }
  const toWrite = (await one("select count(*)::int n from yt_ideas i left join yt_scripts s on s.idea_id = i.id where i.status = 'picked' and s.id is null")).n
  // what Autopilot did by itself this week
  const week = await one(`select (select count(*) from yt_scripts where auto_fixes is not null and updated_at > now() - interval '7 days')::int as fixed,
    (select count(*) from audit_log where action = 'yt_script_replaced' and at > now() - interval '7 days')::int as replaced,
    (select count(*) from yt_scripts where render_tries > 1 and updated_at > now() - interval '7 days')::int as remade`)
  // for the simple screen: the five steps of making a video, the video style, and the week's posts
  const STEP = { queued: 1, setup: 1, capture: 1, voice: 2, music: 2, render: 3, upload: 4 }
  const step = job ? (STEP[job.stage] ?? 1) : null, stepPct = job && job.total > 0 ? Math.min(100, Math.round(100 * job.done / job.total)) : null
  const yts = (await one('select short_style, saga_time from yt_settings where id = 1').catch(() => null)) || {}
  const posted = (await one(`select (select count(*) from yt_scripts where uploaded_at > now() - interval '7 days')::int as yt,
    (select count(*) from meta_posts where at > now() - interval '7 days')::int as fb`).catch(() => null)) || { yt: 0, fb: 0 }
  const sagaToday = !!(await one("select 1 from yt_scripts where kind = 'saga' and created_at > now() - interval '20 hours'").catch(() => null))
  const anyOn = o.production.channels.length > 0
  // the frequent run should finish every ~10 minutes; quiet for over 45 minutes means the scheduler stopped calling
  const last = await lastRun(), quietMin = last && last.finishedAt ? Math.round((now - new Date(last.finishedAt).getTime()) / 60000) : null
  const needs = [...o.needs]
  if (anyOn && quietMin != null && quietMin > 45) needs.unshift({ text: `Automation hasn’t run for ${quietMin >= 120 ? Math.round(quietMin / 60) + ' hours' : quietMin + ' minutes'}: check the scheduler (cron-job.org)`, href: '/admin/automation' })
  const state = needs.length ? 'needs' : !anyOn ? 'off' : o.production.short ? 'low' : 'ok'
  return {
    state, production: o.production, needs, onHold: o.onHold,
    lastRun: quietMin == null ? null : { label: quietMin < 1 ? 'just now' : quietMin < 60 ? `${quietMin} min ago` : quietMin < 2880 ? `${Math.round(quietMin / 60)} h ago` : `${Math.round(quietMin / 1440)} days ago`, ok: last.ok !== false },
    youtube: { ...o.youtube, rows: [...ytDone, ...ytNext, ...ytEmpty].sort(byTime) },
    facebook: o.facebook ? { ...o.facebook, rows: fbRows.sort(byTime) } : null,
    making: { now: making ? { name: making.kind === 'long' ? `Long video · Vol. ${(making.script && making.script.volume) || ''}` : making.kind === 'saga' ? `Long story · ${(making.script && making.script.chapters || []).length} chapters` : making.name, stage: job && job.stale ? 'The factory went quiet: Autopilot makes it again if it stops' : stage || 'Starting', pct, eta: job && job.eta != null && !job.stale ? inWords(job.eta * 1000).replace('In ', 'about ') + ' left' : null } : null,
      approved: lined.approved, held: lined.held, toWrite },
    week: { ...week, waiting: needs.length, posted },
    simple: { style: yts.short_style || 'classic', sagaTime: yts.saga_time || '16:00', sagaToday, step, stepPct, note: job && job.note ? String(job.note).slice(0, 120) : null },
    agent: await agentState(),
  }
}
