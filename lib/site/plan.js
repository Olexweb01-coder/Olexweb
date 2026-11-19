// The plan (Install 26): YouTube and Facebook each get their own video for every posting time, planned three days ahead,
// and nothing posts until it's approved (on Approval) and finished. You can see every planned video before it goes out:
// its format, title, words and, once made, the video itself. Approve, swap for a different one, change the title, or leave
// a time empty.
//   - Each channel has its own videos: YouTube and Facebook never get the same one.
//   - The format changes every time: never the same format twice in a row on a channel, never the same format on both
//     channels on the same day, and Poor vs Rich at most once a week per channel. The free-tool stories (your best Shorts)
//     come in four formats; "You build it" comes in only when a new world exists for it.
//   - A video that missed its time (not approved or not finished) isn't wasted: it moves to that channel's next free time.
// While the plan is on (yt_settings.plan_on) it replaces the old queue for both channels and the long videos stop.
import 'server-only'
import { q, one } from '@/lib/admin/db'
import { writeScript, approveScript } from './scripts'
import { writeExplain, WORLDS, leastUsedWorld } from './explain'
import { writeShortTale } from './shorttale'
import { sendToFactory, factoryReady, sweepStuck, dropVideo } from './factory'
import { uploadVideo } from './publish'
import { postPlannedReel, fbTimes, metaReady } from './meta'
import { notify } from '@/lib/assistant/notify'

export const DAYS = 3                                                         // today and the next two days
// Install 32: every video is a real story now (a cast, places that change, a camera that moves), one main video a day.
// The four website stories (type 'story') are no longer planned; they stay here so older videos keep their names.
export const FORMATS = {
  turnaround: { name: 'Story: The comeback', type: 'tale' },
  relatable: { name: 'Story: Can you relate?', type: 'tale' },
  scam: { name: 'Story: The scam', type: 'tale' },
  mystery: { name: 'Story: The mystery', type: 'tale' },
  tested: { name: 'I tested it so you don’t have to', type: 'story' },
  'stop-paying': { name: 'Stop paying for this', type: 'story' },
  'hard-way': { name: 'You’re doing it the hard way', type: 'story' },
  hidden: { name: 'The hidden feature nobody uses', type: 'story' },
  versus: { name: 'Poor vs Rich', type: 'explain' },
  chain: { name: 'You build it', type: 'explain' },
  build: { name: 'You build it (fixed world)', type: 'explain' },
}
// Install 33: every planned video is "You build it" in 3D. Everything else (stories, Poor vs Rich, the website stories)
// stays named here for older videos, and is replaced in the plan before it goes out.
// Install 34: every planned video is a chain of problems (lib/site/chain.js), on a new tech topic each time
const ORDER = ['chain']
const OLD = new Set(Object.keys(FORMATS).filter((f) => f !== 'chain'))
const LATE = 3 * 3600e3                                                        // a time missed by more than 3 hours is gone
const lagosDay = (ms = Date.now()) => new Date(ms + 3600e3).toISOString().slice(0, 10)
const slotMs = (day, hhmm) => Date.parse(`${day}T${hhmm}:00Z`) - 3600e3          // Lagos is UTC+1 all year
const addDays = (day, n) => lagosDay(Date.parse(day + 'T12:00:00Z') - 3600e3 + n * 86400e3)
const p2 = (n) => String(n).padStart(2, '0')
// a Postgres date comes back as local midnight: read its local parts (toISOString would slip a day east of UTC)
const dayStr = (d) => (d instanceof Date ? `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}` : String(d).slice(0, 10))
const okTime = (t) => /^\d\d:\d\d$/.test(t || '')

export async function planOn() { const s = await one('select plan_on from yt_settings where id = 1').catch(() => null); return !!(s && s.plan_on) }
export async function setPlanOn(on) { await q('update yt_settings set plan_on = $1 where id = 1', [!!on]); return { ok: true, on: !!on } }

// which channels the plan fills, and their times (Lagos)
async function channels() {
  const out = []
  const yt = await one('select channel_id from yt_account where id = 1').catch(() => null)
  if (yt && yt.channel_id) {
    const st = await one('select publish_time, publish_time2, publish_time3 from yt_settings where id = 1')
    out.push({ key: 'youtube', times: [okTime(st.publish_time) ? st.publish_time : '18:00'] })   // Install 32: one main video a day, at the first posting time
  }
  if (metaReady() && await one('select 1 from meta_pages where selected').catch(() => null)) {
    const m = await one('select per_day, times, video_days from meta_settings where id = 1')
    // Install 29: Facebook gets videos on its video days only (Mon, Wed, Fri by default); the daily story fills the others
    const days = String(m.video_days || '').split(',').map((x) => x.trim()).filter((x) => /^[0-6]$/.test(x)).map(Number)   // empty = every day
    out.push({ key: 'facebook', times: fbTimes(m), days: days.length ? days : null })
  }
  return out
}

// ---------- choosing a format ----------
// rows: every slot near this one (both channels). Returns the format key for a new slot on `channel` at day/time.
export function chooseFormat() { return 'chain' }   // Install 34: one format; the topic changes every time
export function chooseStoryFormat(channel, day, time, rows, { buildFree = false, scamFree = false, avoid = null } = {}) {
  const at = slotMs(day, time), mine = rows.filter((r) => r.channel === channel && r.status !== 'skipped')
  const before = mine.filter((r) => slotMs(dayStr(r.day), r.time) < at).sort((a, b) => slotMs(dayStr(b.day), b.time) - slotMs(dayStr(a.day), a.time))
  const after = mine.filter((r) => slotMs(dayStr(r.day), r.time) > at).sort((a, b) => slotMs(dayStr(a.day), a.time) - slotMs(dayStr(b.day), b.time))
  const banned = new Set(avoid ? [avoid] : [])
  if (before[0]) banned.add(before[0].format)                                  // never twice in a row
  if (after[0]) banned.add(after[0].format)
  for (const r of rows) if (r.channel !== channel && r.status !== 'skipped' && dayStr(r.day) === day) banned.add(r.format)   // the two channels differ each day
  if (mine.some((r) => r.format === 'versus' && Math.abs(slotMs(dayStr(r.day), r.time) - at) < 2.5 * 86400e3)) banned.add('versus')   // Poor vs Rich: about twice a week
  if (!buildFree || rows.some((r) => r.format === 'build' && ['planned'].includes(r.status))) banned.add('build')
  if (!scamFree || rows.some((r) => r.format === 'scam' && r.status === 'planned')) banned.add('scam')   // a scam story needs a real alert no story has used; one planned at a time
  const lastUse = (f) => { const r = before.find((x) => x.format === f); return r ? slotMs(dayStr(r.day), r.time) : -Infinity }
  const ok = ORDER.filter((f) => !banned.has(f))
  // everything ruled out (a crowded week): any story series that isn't the one to avoid or the one just before
  const stories = ORDER.filter((f) => FORMATS[f].type === 'tale' && f !== avoid)
  const pool = ok.length ? ok : (stories.filter((f) => f !== (before[0] || {}).format).length ? stories.filter((f) => f !== (before[0] || {}).format) : stories)
  return pool.sort((a, b) => lastUse(a) - lastUse(b) || ORDER.indexOf(a) - ORDER.indexOf(b))[0]
}
// the world for a planned build: the least-used one that neither channel shows within three days (never the one swapped out)
async function pickWorld(slot) {
  const near = (await q(`select s.script->>'world' as w from plan_slots p join yt_scripts s on s.id = p.script_id
      where p.id <> $1 and p.status in ('planned', 'posted') and p.day between $2::date - 3 and $2::date + 3`, [slot.id, dayStr(slot.day)])).rows.map((r) => r.w).filter(Boolean)
  return (await leastUsedWorld([...near, ...(slot.avoidWorld ? [slot.avoidWorld] : [])])).key
}
async function scamFree() { return !!(await one("select 1 from dir_entries where kind = 'alert' and status = 'live' and tale_id is null and published_at > now() - interval '45 days' limit 1").catch(() => null)) }
async function buildFree() {
  const used = new Set((await q("select script->>'world' as w from yt_scripts where kind = 'story' and script->>'format' = 'build'")).rows.map((r) => r.w))
  return WORLDS.some((w) => !used.has(w.key))
}

// ---------- filling the plan ----------
// New slots for the next three days (each channel's times), each with its format. A video from a missed time (not posted)
// takes the next new slot of its channel before anything new is written.
export async function fillSlots(now = Date.now()) {
  const made = []
  const today = lagosDay(now), chans = await channels(), free = await buildFree(), scam = await scamFree()
  await healPlan(chans, now).catch(() => {})
  for (let d = 0; d < DAYS; d++) {
    const day = addDays(today, d)
    for (const c of chans) for (const time of c.times) {
      if (c.days && !c.days.includes(new Date(day + 'T12:00:00Z').getUTCDay())) continue   // not one of its video days
      if (slotMs(day, time) < now + 10 * 60e3) continue                        // too late for today
      if (await one('select 1 from plan_slots where channel = $1 and day = $2 and time = $3', [c.key, day, time])) continue
      const leftover = await one(`select p.id, p.format, p.script_id from plan_slots p join yt_scripts s on s.id = p.script_id
          where p.channel = $1 and p.status = 'missed' and s.status in ('draft', 'needs_review', 'approved', 'rendering', 'rendered')
            and not exists (select 1 from plan_slots o where o.script_id = p.script_id and o.status in ('planned', 'posted')) order by p.day, p.time limit 1`, [c.key])
      const rows = (await q("select channel, day, time, format, status from plan_slots where day between $1::date - 8 and $1::date + 8", [day])).rows
      const format = leftover ? leftover.format : chooseFormat(c.key, day, time, rows, { buildFree: free, scamFree: scam })
      const r = await one(`insert into plan_slots (channel, day, time, format, script_id, note) values ($1, $2, $3, $4, $5, $6)
          on conflict (channel, day, time) do nothing returning id`, [c.key, day, time, format, leftover ? leftover.script_id : null, leftover ? 'Moved here from a time it missed' : null])
      if (r) { made.push(r.id); if (leftover) await q("update plan_slots set script_id = null, note = coalesce(note, '') || ' (moved on)' where id = $1", [leftover.id]) }
    }
  }
  // a video from a missed time also fills the nearest time of its channel that has no video yet
  for (const c of chans) for (;;) {
    const lo = await one(`select p.id, p.format, p.script_id from plan_slots p join yt_scripts s on s.id = p.script_id
        where p.channel = $1 and p.status = 'missed' and s.status in ('draft', 'needs_review', 'approved', 'rendering', 'rendered')
          and not exists (select 1 from plan_slots o where o.script_id = p.script_id and o.status in ('planned', 'posted')) order by p.day, p.time limit 1`, [c.key])
    if (!lo) break
    const open = (await q("select id, day, time from plan_slots where channel = $1 and status = 'planned' and script_id is null order by day, time", [c.key])).rows.find((x) => slotMs(dayStr(x.day), x.time) > now + 30 * 60e3)
    if (!open) break
    await q("update plan_slots set script_id = $2, format = $3, note = 'Moved here from a time it missed', tries = 0, tried_at = null where id = $1", [open.id, lo.script_id, lo.format])
    await q("update plan_slots set script_id = null, note = coalesce(note, '') || ' (moved on)' where id = $1", [lo.id])
  }
  return made
}

// Install 32, once and then whenever it's needed: YouTube times beyond the one main video are left empty, and a planned
// website story that hasn't gone out is replaced by a real story (its old video is let go). One being made is left alone.
async function healPlan(chans, now = Date.now()) {
  const yt = chans.find((c) => c.key === 'youtube')
  const rows = (await q(`select p.id, p.channel, p.day, p.time, p.format, p.script_id, s.status as s_status from plan_slots p left join yt_scripts s on s.id = p.script_id
      where p.status = 'planned' and p.day >= $1::date`, [lagosDay(now)])).rows
  for (const p of rows) {
    if (slotMs(dayStr(p.day), p.time) < now) continue
    if (p.s_status === 'rendering') continue
    const extra = p.channel === 'youtube' && yt && !yt.times.includes(p.time), old = OLD.has(p.format)
    if (!extra && !old) continue
    if (p.script_id && p.s_status !== 'uploaded') { await dropVideo(p.script_id).catch(() => {}); await q("delete from yt_scripts where id = $1 and status <> 'uploaded'", [p.script_id]) }
    if (extra) { await q("update plan_slots set status = 'skipped', script_id = null, note = 'One main video a day now' where id = $1", [p.id]); continue }
    const near = (await q("select channel, day, time, format, status from plan_slots where id <> $2 and day between $1::date - 8 and $1::date + 8", [dayStr(p.day), p.id])).rows.filter((r) => !OLD.has(r.format))
    const format = chooseFormat(p.channel, dayStr(p.day), p.time, near, { buildFree: await buildFree(), scamFree: await scamFree() })
    await q('update plan_slots set format = $2, script_id = null, note = null, tries = 0, tried_at = null where id = $1', [p.id, format])
  }
}

// The next slot without a video gets one (one per run: writing takes a minute). Returns what happened, or null.
export async function writeNext({ until = 0 } = {}) {
  const slot = await one(`select * from plan_slots where status = 'planned' and script_id is null and (tried_at is null or tried_at < now() - interval '20 minutes')
    order by day, time, channel limit 1`)
  return slot ? writeSlot(slot, { until }) : null
}
async function pickIdea() {
  // the best idea nobody has used: one you picked first, then the highest score from the daily search
  return one(`select i.id, i.name from yt_ideas i left join yt_scripts s on s.idea_id = i.id where i.status in ('new', 'picked') and s.id is null
    and (i.script_tried_at is null or i.script_tried_at < now() - interval '3 hours') order by i.first desc nulls last, (i.status = 'picked') desc, i.score desc, i.created_at desc limit 1`)
}
export async function writeSlot(slot, { until = 0 } = {}) {
  await q('update plan_slots set tried_at = now(), tries = tries + 1 where id = $1', [slot.id])
  const f = FORMATS[slot.format] || FORMATS.tested
  let id = null, note = null
  try {
    if (slot.format === 'chain' || OLD.has(slot.format)) {               // Install 34: a chain of problems on a tech topic never done before
      const { writeChain } = await import('./chain')
      const r = await writeChain({ until }); id = r && r.id
      if (id && slot.format !== 'chain') await q("update plan_slots set format = 'chain' where id = $1", [slot.id])
    }
    else if (f.type === 'explain') { const r = await writeExplain({ format: slot.format }); id = r && r.id }
    else if (f.type === 'tale' || OLD.has(slot.format)) {               // Install 32: a real story (an old website-story time gets a story too)
      const r = await writeShortTale({ format: f.type === 'tale' ? slot.format : 'turnaround' }); id = r && r.id
      if (id && r.format !== slot.format) await q('update plan_slots set format = $2 where id = $1', [slot.id, r.format])   // a scam with no fresh alert became a mystery
    }
    else {
      const idea = await pickIdea()
      if (!idea) { note = 'No new website ideas left to make a story from. The daily search finds more.'; await q('update plan_slots set note = $2 where id = $1', [slot.id, note]); return { slot: slot.id, waiting: note } }
      await q("update yt_ideas set status = 'picked', decided_at = coalesce(decided_at, now()), script_tried_at = now() where id = $1", [idea.id])
      try {
        const r = await writeScript(idea.id, { story: true, format: slot.format })
        if (r && r.id) id = r.id
        else note = `The story about ${idea.name} wasn’t good enough, so it’s being written again.`
      } catch (e) {
        await q("update yt_ideas set status = 'passed', risks = $2, decided_at = now() where id = $1", [idea.id, ('Set aside by the plan: ' + e.message).slice(0, 400)])
        note = e.message
      }
    }
  } catch (e) { note = e.message }
  if (!id) { await q('update plan_slots set note = $2 where id = $1', [slot.id, String(note || 'Not written yet').slice(0, 300)]); return { slot: slot.id, failed: note } }
  // this video belongs to this channel only
  await q(`update yt_scripts set queue_pos = null, fb = case when $2 = 'youtube' then '{"status":"off","why":"made for YouTube in the plan"}'::jsonb else null end where id = $1`, [id, slot.channel])
  await q('update plan_slots set script_id = $2, note = null where id = $1', [slot.id, id])
  return { slot: slot.id, script: id, format: slot.format }
}

// ---------- making and posting ----------
// The factory makes the nearest approved planned video next (one at a time). A failed render is tried again up to 3 times.
export async function renderNext() {
  if (!factoryReady()) return null
  await sweepStuck()
  if (await one("select 1 from yt_scripts where status = 'rendering'")) return null
  const s = await one(`select s.id from plan_slots p join yt_scripts s on s.id = p.script_id where p.status = 'planned'
      and (s.status = 'approved' or (s.status = 'failed' and s.render_tries < 3 and s.updated_at < now() - interval '10 minutes'))
      and p.day::timestamptz + (p.time || ':00')::interval - interval '1 hour' + interval '${LATE / 3600e3} hours' > now() order by p.day, p.time limit 1`)
  return s ? sendToFactory(s.id, { by: 'The plan' }) : null
}
// At its time, each finished video goes to its channel. YouTube on "scheduled" goes up ahead and is public at the time.
export async function postDue(now = Date.now()) {
  const out = []
  const sched = ((await one('select publish_mode from yt_settings where id = 1')) || {}).publish_mode === 'scheduled'
  const rows = (await q(`select p.*, s.status as s_status from plan_slots p left join yt_scripts s on s.id = p.script_id where p.status = 'planned' order by p.day, p.time`)).rows
  for (const p of rows) {
    const day = dayStr(p.day), at = slotMs(day, p.time), label = day + ' ' + p.time
    if (now > at + LATE) {                                                         // missed: say why; its video moves on
      const why = !p.script_id ? 'no video was written in time' : ['draft', 'needs_review'].includes(p.s_status) ? 'it wasn’t approved in time'
        : ['approved', 'rendering', 'failed'].includes(p.s_status) ? 'the video wasn’t finished in time' : p.note || 'it couldn’t be posted'
      await q("update plan_slots set status = 'missed', note = $2 where id = $1", [p.id, 'Missed: ' + why])
      out.push({ slot: p.id, missed: why }); continue
    }
    if (p.s_status !== 'rendered') continue
    const early = p.channel === 'youtube' && sched && at - now < 22 * 3600e3 && at - now > 30 * 60e3
    if (!(now >= at || early)) continue
    if (p.channel === 'youtube') {
      try {
        const r = await uploadVideo(p.script_id, { slot: label, ...(sched ? { publishAt: new Date(at).toISOString() } : {}) })
        await q("update plan_slots set status = 'posted', posted_at = now(), note = $2 where id = $1", [p.id, sched ? 'Uploaded: public at its time' : 'Uploaded'])
        out.push({ slot: p.id, youtube: r && r.video })
      } catch (e) { await q('update plan_slots set note = $2 where id = $1', [p.id, 'YouTube: ' + String(e.message).slice(0, 250)]); out.push({ slot: p.id, error: e.message }) }
    } else {
      if (await one("select 1 from meta_posts where at > now() - interval '60 minutes'")) continue   // never two Reels within the hour
      const r = await postPlannedReel(p.script_id, label)
      if (r.posted) { await q("update plan_slots set status = 'posted', posted_at = now(), note = null where id = $1", [p.id]); out.push({ slot: p.id, facebook: r.video_id }) }
      else await q('update plan_slots set note = $2 where id = $1', [p.id, 'Facebook: ' + String(r.skipped || r.error || '').slice(0, 250)])
    }
  }
  return out
}

// One run of the plan (the frequent run calls it while the plan is on).
export async function planRun(report, { write = true } = {}) {
  try { const p = await postDue(); if (p.length) report.planPosted = p } catch (e) { report.errors.push('plan posting: ' + e.message) }   // first: what's due goes out, what's missed is marked
  const made = await fillSlots(); if (made.length) report.planned = made.length
  if (write && !report.ideas) try { const w = await writeNext(); if (w) report.planWrote = w } catch (e) { report.errors.push('plan: ' + e.message) }   // not in the same run as the daily idea search (time)
  try { const f = await renderNext(); if (f) report.factory = f } catch (e) { report.errors.push('plan factory: ' + e.message) }
  return report
}

// ---------- what you can do ----------
async function slotOf(id) { const s = await one('select * from plan_slots where id = $1', [Number(id)]); if (!s) throw new Error('That time is no longer in the plan.'); return s }
export async function approveSlot(id) {
  const s = await slotOf(id); if (!s.script_id) throw new Error('This video isn’t written yet.')
  const r = await approveScript(s.script_id, true)
  if (!r && !(await one("select 1 from yt_scripts where id = $1 and status in ('approved', 'rendering', 'rendered')", [s.script_id]))) throw new Error('This video can’t be approved now.')
  return { ok: true }
}
export async function approveAll() {
  const r = await q(`update yt_scripts set status = 'approved', approved_at = now(), updated_at = now() where status in ('draft', 'needs_review')
    and id in (select script_id from plan_slots where status = 'planned' and script_id is not null) returning id`)
  return { ok: true, approved: r.rowCount }
}
// a different video for this time: the old one is thrown away, a new one is written now in a different format
export async function swapSlot(id) {
  const s = await slotOf(id); if (s.status !== 'planned') throw new Error('Only a video that hasn’t gone out can be swapped.')
  let avoidWorld = null
  if (s.script_id) {
    const sc = await one('select status, idea_id, script from yt_scripts where id = $1', [s.script_id])
    if (sc && sc.status === 'rendering') throw new Error('The factory is making this one right now. Swap it when it’s done.')
    avoidWorld = sc && sc.script && sc.script.world
    if (sc) { await dropVideo(s.script_id).catch(() => {}); await q('delete from yt_scripts where id = $1', [s.script_id]); if (sc.idea_id) await q("update yt_ideas set status = 'passed', risks = 'Swapped out of the plan' where id = $1", [sc.idea_id]) }
  }
  const rows = (await q("select channel, day, time, format, status from plan_slots where id <> $2 and day between $1::date - 8 and $1::date + 8", [dayStr(s.day), s.id])).rows
  const format = chooseFormat(s.channel, dayStr(s.day), s.time, rows, { buildFree: await buildFree(), scamFree: await scamFree(), avoid: s.format })   // never the same format again
  await q('update plan_slots set script_id = null, format = $2, note = null, tries = 0, tried_at = null where id = $1', [s.id, format])
  const w = await writeSlot({ ...s, format, script_id: null, avoidWorld })
  return { ok: true, format, written: !!w.script, note: w.failed || w.waiting || null }
}
// leave this time empty (its video is thrown away)
export async function skipSlot(id) {
  const s = await slotOf(id); if (s.status !== 'planned') throw new Error('Only a time that hasn’t happened can be left empty.')
  if (s.script_id) {
    const sc = await one('select status, idea_id from yt_scripts where id = $1', [s.script_id])
    if (sc && sc.status === 'rendering') throw new Error('The factory is making this one right now. Try again when it’s done.')
    if (sc) { await dropVideo(s.script_id).catch(() => {}); await q('delete from yt_scripts where id = $1', [s.script_id]); if (sc.idea_id) await q("update yt_ideas set status = 'new', script_tried_at = null where id = $1", [sc.idea_id]) }
  }
  await q("update plan_slots set status = 'skipped', script_id = null, note = 'Left empty by you' where id = $1", [s.id])
  return { ok: true }
}
export async function retitleSlot(id, title) {
  const s = await slotOf(id), t = String(title || '').replace(/\s+/g, ' ').trim()
  if (!s.script_id) throw new Error('This video isn’t written yet.')
  if (t.length < 4 || t.length > 90) throw new Error('A title needs 4 to 90 characters.')
  const r = await one("update yt_scripts set package = jsonb_set(package, '{title}', to_jsonb($2::text)), updated_at = now() where id = $1 and status not in ('uploaded') returning id", [s.script_id, t])
  if (!r) throw new Error('This video has already gone out.')
  return { ok: true }
}

// ---------- the screen ----------
const STATE = {
  none: ['Writing', 'The video for this time is being written.'],
  draft: ['Needs you', 'Read it, then approve it. Nothing posts until you do.'],
  needs_review: ['Needs you', 'A check didn’t pass. Read it before approving.'],
  approved: ['Approved', 'Waiting for the factory to make it.'],
  rendering: ['Being made', 'The factory is making the video now.'],
  rendered: ['Ready', 'Made and approved. It goes out at its time.'],
  failed: ['Being made again', 'The factory failed; it tries again by itself.'],
  uploaded: ['Posted', ''],
}
export async function planData() {
  const now = Date.now(), today = lagosDay(now), on = await planOn(), chans = await channels()
  const mode = ((await one('select yt_mode from yt_settings where id = 1')) || {}).yt_mode || 'approval'
  const fb = await one('select enabled, paused_reason from meta_settings where id = 1').catch(() => null)
  const rows = (await q(`select p.*, s.status as s_status, s.package, s.script, s.checks, s.seconds, s.video is not null and (s.video->>'bytes') is not null as has_video, s.yt_video_id, s.fb as s_fb
      from plan_slots p left join yt_scripts s on s.id = p.script_id where p.day between $1::date - 1 and $1::date + ${DAYS - 1} order by p.day, p.time`, [today])).rows
  const view = (r) => {
    const st = r.status === 'posted' ? ['Posted', r.note || ''] : r.status === 'missed' ? ['Missed', r.note || ''] : r.status === 'skipped' ? ['Empty', 'Left empty by you']
      : (r.script_id ? STATE[r.s_status] : (r.note ? ['Waiting', r.note] : STATE.none)) || ['', '']
    const sc = r.script || {}, lines = (sc.scenes || []).map((x) => (typeof x === 'string' ? x : x.text)).filter(Boolean)
    return { id: r.id, day: dayStr(r.day), time: r.time, format: r.format, formatName: (FORMATS[r.format] || {}).name || r.format, status: r.status,
      label: st[0], hint: st[1], scriptId: r.script_id, scriptStatus: r.s_status || null, title: r.package ? r.package.title : null,
      site: sc.site ? sc.site.name : sc.business ? sc.business.noun : null, story: sc.format === 'chain' ? { logline: 'What it turns out to be: ' + (sc.answer || sc.topic || '?'), cast: '', city: null } : sc.mode === 'tale' ? { logline: sc.logline || null, cast: (sc.cast || []).map((c) => c.name).join(', '), city: sc.city || null } : null, lines, seconds: r.seconds, video: !!r.has_video, ytId: r.yt_video_id || null,
      failing: (r.checks || []).filter((c) => !c.ok).map((c) => c.note).slice(0, 3),
      canAct: r.status === 'planned', needsYou: r.status === 'planned' && ['draft', 'needs_review'].includes(r.s_status) }
  }
  const days = Array.from({ length: DAYS }, (_, k) => addDays(today, k))
  return {
    on, mode, today, days,
    channels: chans.map((c) => ({ key: c.key, name: c.key === 'youtube' ? 'YouTube' : 'Facebook', times: c.times,
      off: c.key === 'facebook' ? (!fb || !fb.enabled ? 'Facebook posting is off: these won’t post until you turn it on.' : fb.paused_reason ? 'Facebook posting is paused: ' + fb.paused_reason : null) : null,
      slots: rows.filter((r) => r.channel === c.key).map(view) })),
    waiting: rows.filter((r) => r.status === 'planned' && ['draft', 'needs_review'].includes(r.s_status)).length,
  }
}
// for the Today tab and the simple views: what the plan posts today on a channel
export async function planToday(channel) {
  const today = lagosDay()
  return (await q(`select p.time, p.status, p.note, s.package->>'title' as title, s.status as s_status from plan_slots p left join yt_scripts s on s.id = p.script_id
    where p.channel = $1 and p.day = $2 order by p.time`, [channel, today])).rows
}
export async function notifyWaiting() {
  const n = (await one("select count(*)::int n from plan_slots p join yt_scripts s on s.id = p.script_id where p.status = 'planned' and s.status in ('draft', 'needs_review')")).n
  if (n) await notify('ideas', `${n} video${n === 1 ? '' : 's'} in the plan wait${n === 1 ? 's' : ''} for your approval.`, '/admin/automation/plan').catch(() => {})
  return n
}
