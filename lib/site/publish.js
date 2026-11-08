// Publishing: a finished video goes to YouTube with the resumable upload, fed from the 4 MiB pieces in storage (each
// piece is a multiple of 256 KiB, as YouTube requires). If the connection drops, the next try asks YouTube how much
// arrived and carries on from there. Until Google's audit approves the app, YouTube keeps API uploads private, so
// "private" is the default; after the audit, "scheduled" publishes each video at the chosen time (Lagos).
import 'server-only'
import { q, one } from '@/lib/admin/db'
import { tracker } from './progress'
import { checkUploads, accessTokenForUpload } from './youtube'
import { dropVideo, getPiece } from './factory'
import { fbWants, metaStatus } from './meta'
import { notify } from '@/lib/assistant/notify'
import { chapterLines } from './longform'

const UPLOAD = () => (process.env.YT_UPLOAD_BASE || 'https://www.googleapis.com').replace(/\/$/, '') + '/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status'
export const UPLOAD_STAGES = [{ key: 'start', label: 'Telling YouTube a video is coming', guess: 2 }, { key: 'send', label: 'Sending the video', guess: 15 }, { key: 'tidy', label: 'Tidying up', guess: 2 }]

// The next publishing slot at the chosen Lagos time (Lagos is UTC+1 all year), at least 30 minutes from now.
export function nextSlot(hhmm, now = Date.now()) {
  const [h, m] = String(hhmm || '18:00').split(':').map(Number)
  const d = new Date(now); d.setUTCHours(h - 1, m || 0, 0, 0)
  while (d.getTime() < now + 30 * 60e3) d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString()
}
async function settings() { return one('select publish_mode, publish_time, publish_time2, publish_time3, made, mention_every, series, series_in_title from yt_settings where id = 1') }
const slotTimes = (st) => [...new Set([st.publish_time || '18:00', st.publish_time2, st.publish_time3].filter((t) => /^\d\d:\d\d$/.test(t || '')))].sort()
// "Secret Websites You Should Know (Part 10) | This free site turns photos into palettes" — at most 100 characters.
export function seriesTitle(st, part, title) {
  const t = String(title || '').trim()
  if (!st || !st.series_in_title || !part) return t.slice(0, 100)
  const head = String(st.series).replace(/\b\w/g, (c) => c.toUpperCase()) + ` (Part ${part})`
  return (head + ' | ' + t).length <= 100 ? head + ' | ' + t : (head + ' | ' + t.slice(0, Math.max(0, 97 - head.length - 3)).trim() + '…').slice(0, 100)
}

export async function uploadVideo(scriptId, opts = {}) {
  const p = tracker('upload', UPLOAD_STAGES); await p.begin()
  try { const r = await upload(Number(scriptId), p, opts); await p.end(); return r } catch (e) { await p.end(e.message); throw e }
}
async function upload(id, p, opts = {}) {
  const s = await one("select s.id, s.idea_id, s.kind, s.script, s.package, s.video, s.part, s.upload, s.parent_id, coalesce(i.name, case when s.kind = 'saga' then 'Long story' else 'Long video' end) as name from yt_scripts s left join yt_ideas i on i.id = s.idea_id where s.id = $1 and s.status = 'rendered'", [id])
  if (!s || !s.video || !s.video.bytes) throw new Error('Only a finished video can be uploaded.')
  const st = await settings(), total = s.video.bytes, n = s.video.pieces, PIECE = s.video.piece || 4 * 1024 * 1024
  const token = await accessTokenForUpload()
  await p.stage('start', 0, s.name)
  let up = s.upload && s.upload.url && Date.now() - new Date(s.upload.at).getTime() < 6 * 86400e3 ? s.upload : null    // YouTube keeps a session about a week
  let offset = 0
  if (up) {                                                     // resume: ask how much arrived
    const r = await fetch(up.url, { method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Range': `bytes */${total}` } })
    if (r.status === 200 || r.status === 201) return done(s, await r.json(), st, p)
    if (r.status === 308) { const m = /bytes=0-(\d+)/.exec(r.headers.get('range') || ''); offset = m ? Number(m[1]) + 1 : 0 } else up = null
  }
  if (!up) {
    const pk = s.package, scheduled = st.publish_mode === 'scheduled'
    const long = s.kind === 'long' || s.kind === 'saga', chapters = long ? chapterLines(s.video.chapters) : '', guides = await guideLines(s)
    // a Short cut from a long story points to the whole day first (once that's on YouTube)
    const parent = s.parent_id ? await one("select yt_video_id from yt_scripts where id = $1 and status = 'uploaded' and yt_video_id is not null", [s.parent_id]).catch(() => null) : null
    const whole = parent ? `Watch my whole day: https://youtu.be/${parent.yt_video_id}` : ''
    const meta = { snippet: { title: long || s.kind === 'story' ? String(pk.title).slice(0, 100) : seriesTitle(st, s.part, pk.title), description: ([whole, guides].filter(Boolean).map((x) => x + '\n\n').join('') + String(pk.description || '') + (chapters ? '\n\nChapters\n' + chapters : '')).slice(0, 4900), tags: (pk.hashtags || []).map((t) => t.replace(/^#/, '')).slice(0, 15), categoryId: '28' },
      status: { privacyStatus: scheduled && opts.special ? 'public' : 'private', ...(scheduled && !opts.special ? { publishAt: opts.publishAt || nextSlot(st.publish_time) } : {}), selfDeclaredMadeForKids: false, containsSyntheticMedia: false } }
    const r = await fetch(UPLOAD(), { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'video/mp4', 'X-Upload-Content-Length': String(total) }, body: JSON.stringify(meta) })
    if (r.status === 403) { const j = await r.json().catch(() => ({})); const why = JSON.stringify(j); throw new Error(/quota/i.test(why) ? 'YouTube’s daily upload allowance is used up; it resets at midnight Pacific time.' : /insufficient|scope/i.test(why) ? 'The YouTube sign-in doesn’t allow uploads. Connect YouTube again and leave every box ticked.' : 'YouTube refused the upload (' + (j.error && j.error.message || 403) + ').') }
    if (!r.ok || !r.headers.get('location')) throw new Error('YouTube didn’t start the upload (' + r.status + ').')
    up = { url: r.headers.get('location'), at: new Date().toISOString(), publishAt: meta.status.publishAt || null, ...(opts.special ? { special: true } : {}), ...(opts.slot ? { slot: opts.slot } : {}), ...(opts.lane ? { lane: opts.lane } : {}) }
    await q('update yt_scripts set upload = $2 where id = $1', [id, JSON.stringify(up)])
  }
  await p.stage('send', n, offset ? 'resuming at ' + (offset / 1048576).toFixed(1) + ' MB' : '')
  for (let i = Math.floor(offset / PIECE); i < n; i++) {
    const start = i * PIECE, skip = Math.max(0, offset - start)
    const res = await getPiece(`vid/${id}/${String(i).padStart(3, '0')}.bin`)
    if (!res) throw new Error('A piece of the video is missing from storage. Make it again in the factory.')
    let buf = Buffer.from(await res.arrayBuffer()); if (skip) buf = buf.subarray(skip)
    const from = start + skip, to = from + buf.length - 1
    const r = await fetch(up.url, { method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Length': String(buf.length), 'Content-Range': `bytes ${from}-${to}/${total}` }, body: buf })
    if (r.status === 200 || r.status === 201) { await p.tick(1, buf.length); return done(s, await r.json(), st, p) }
    if (r.status !== 308) throw new Error('The upload was interrupted (' + r.status + '). Press Upload again: it carries on where it stopped.')
    await p.tick(1, buf.length, `${((to + 1) / 1048576).toFixed(1)} of ${(total / 1048576).toFixed(1)} MB`)
  }
  throw new Error('YouTube didn’t confirm the upload. Press Upload again: it carries on where it stopped.')
}
async function done(s, v, st, p) {
  await p.stage('tidy')
  const scheduled = !!(s.upload && s.upload.publishAt) || !!(v.status && v.status.publishAt)
  await q("update yt_scripts set status = 'uploaded', yt_video_id = $2, uploaded_at = now(), upload = jsonb_set(coalesce(upload, '{}'::jsonb), '{done}', to_jsonb($3::text)) where id = $1",
    [s.id, v.id, v.status ? v.status.privacyStatus + (v.status.publishAt ? ' until ' + v.status.publishAt : '') : 'private'])
  await q("update yt_ideas set status = 'made' where id = $1", [s.idea_id])
  await q('update yt_settings set made = made + 1 where id = 1')
  if (s.video && s.video.thumb) await setThumb(s, v.id).catch(() => {})                                // Install 22: the story's own thumbnail (before the copy is freed)
  if (await fbWants(s).catch(() => false)) await q("update yt_scripts set fb = coalesce(fb, '{\"status\":\"pending\"}'::jsonb) where id = $1", [s.id])   // kept until Facebook has it too
  else await dropVideo(s.id)                                    // YouTube has it now: free the storage
  const label = s.kind === 'long' ? `Long video Vol. ${s.script.volume}` : s.kind === 'saga' ? 'Today’s long story' : s.part ? `Part ${s.part}` : `The story about ${s.name}`
  await notify('ideas', scheduled ? `${label} (${s.name}) is uploaded and scheduled to go public.` : `${label} is on YouTube: make it Public in Studio (one tap from the Scripts tab).`, '/admin/youtube?view=scripts')
  return { id: s.id, video: v.id, privacy: v.status && v.status.privacyStatus, publishAt: v.status && v.status.publishAt }
}
const KPATH = { tool: 'tools', update: 'updates', guide: 'guides', alert: 'alerts' }   // Install 17: every kind of Directory post
// "Full guide" links to the Directory, first in the description (the part people see). Only pages that are live.
async function guideLines(s) {
  try {
    if (s.kind === 'long' || s.kind === 'saga') {
      const rows = (await q("select d.name, d.slug, d.kind from yt_long_items li join dir_entries d on d.idea_id = li.idea_id and d.status = 'live' where li.script_id = $1 order by d.name", [s.id])).rows
      return rows.length ? 'Free guides to each one:\n' + rows.map((r) => `${r.name}: https://olexweb.com/${KPATH[r.kind] || 'tools'}/${r.slug}`).join('\n') : ''
    }
    const d = await one("select slug, kind from dir_entries where idea_id = $1 and status = 'live'", [s.idea_id])
    return d ? `Full guide (free): https://olexweb.com/${KPATH[d.kind] || 'tools'}/${d.slug}` : ''
  } catch { return '' }
}
// ---------- the queue: ONE video a day at the publish time (Lagos), whatever is approved ----------
// Autopilot and "Add to queue" feed it; only "Post now" (special) skips it. Long videos take a day like any other.
const lagosDay = (ms = Date.now()) => new Date(ms + 3600e3).toISOString().slice(0, 10)
const slotMs = (day, hhmm) => Date.parse(`${day}T${/^\d\d:\d\d$/.test(hhmm) ? hhmm : '18:00'}:00Z`) - 3600e3
const addDays = (day, n) => lagosDay(Date.parse(day + 'T12:00:00Z') - 3600e3 + n * 86400e3)
async function usedSlots(times) {                   // "YYYY-MM-DD HH:MM" slots that already have their (non-special) video
  const rows = (await q("select upload, uploaded_at from yt_scripts where status = 'uploaded' and uploaded_at > now() - interval '12 days' order by uploaded_at")).rows
  const used = new Set()
  for (const r of rows) { if (r.upload && (r.upload.special || r.upload.lane === 'saga')) continue   // "Post now" and the long story's own time don't use a Short's slot
    if (r.upload && r.upload.slot) { used.add(r.upload.slot); continue }
    const day = lagosDay(r.upload && r.upload.publishAt ? Date.parse(r.upload.publishAt) : new Date(r.uploaded_at).getTime())   // older uploads: the day's first free slot
    const t = times.find((x) => !used.has(day + ' ' + x)) || times[times.length - 1]; used.add(day + ' ' + t) }
  return used
}
function* slotsFrom(today, times) { for (let k = 0; k < 400; k++) { const d = addDays(today, k); for (const t of times) yield [d, t] } }
export async function queueList() {
  const st = await settings(), times = slotTimes(st), used = await usedSlots(times), now = Date.now(), today = lagosDay(now)
  const rows = (await q("select s.id, s.kind, s.part, s.script, s.package, coalesce(i.name, 'Long video') as name from yt_scripts s left join yt_ideas i on i.id = s.idea_id where s.status = 'rendered' and s.queue_pos is not null and s.kind <> 'saga' and coalesce(i.channels->>'youtube', 'true') <> 'false' order by s.queue_pos, s.id")).rows
  const out = [], gen = slotsFrom(today, times)
  for (const r of rows) {
    let slot; do { slot = gen.next().value } while (slot && (used.has(slot[0] + ' ' + slot[1]) || (st.publish_mode === 'scheduled' && slotMs(slot[0], slot[1]) < now + 30 * 60e3)))
    out.push({ id: r.id, kind: r.kind, part: r.part, volume: r.script && r.script.volume, name: r.name, title: r.package && r.package.title, day: slot[0], time: slot[1] })
  }
  const todayDone = times.filter((t) => used.has(today + ' ' + t)).length
  return { items: out, today, todayDone, perDay: times.length, times, time: times.join(' and ') }
}
const ytOff = async (id) => !!(await one("select 1 from yt_scripts s join yt_ideas i on i.id = s.idea_id where s.id = $1 and i.channels->>'youtube' = 'false'", [Number(id)]))
export async function queueAdd(id) {
  if (await ytOff(id)) throw new Error('YouTube is unticked for this video in Automation → Library. Tick it there first.')
  if (await one("select 1 from yt_scripts where id = $1 and kind = 'saga'", [Number(id)])) throw new Error('The long story isn’t queued: it goes up by itself at its own time each day (Scripts tab → New Shorts).')
  const r = await one("update yt_scripts set queue_pos = (select coalesce(max(queue_pos), 0) + 1 from yt_scripts) where id = $1 and status = 'rendered' returning id", [Number(id)])
  if (!r) throw new Error('Only a finished video can be queued.'); return { ok: true }
}
export async function queueRemove(id) { await q('update yt_scripts set queue_pos = null where id = $1', [Number(id)]); return { ok: true } }
export async function queueMove(id, dir) {
  const list = (await q("select id, queue_pos from yt_scripts where status = 'rendered' and queue_pos is not null order by queue_pos, id")).rows
  const i = list.findIndex((r) => r.id === Number(id)), j = i + (dir < 0 ? -1 : 1)
  if (i < 0 || j < 0 || j >= list.length) return { ok: true }
  await q('update yt_scripts set queue_pos = $2 where id = $1', [list[i].id, j + 1]); await q('update yt_scripts set queue_pos = $2 where id = $1', [list[j].id, i + 1])
  for (const [k, r] of list.entries()) if (k !== i && k !== j) await q('update yt_scripts set queue_pos = $2 where id = $1', [r.id, k + 1])
  return { ok: true }
}
export async function postNow(id) { if (await ytOff(id)) throw new Error('YouTube is unticked for this video in Automation → Library. Tick it there first.'); const r = await uploadVideo(id, { special: true }); await q('update yt_scripts set queue_pos = null where id = $1', [Number(id)]); return r }
// Autopilot keeps the queue fed with every finished video (approval mode leaves that to you)
export async function autoQueue() {
  // a story made as a test (while new Shorts are still classic) waits for you to queue it after watching it
  // the long story isn't queued (it has its own daily time, sagaNext); a Short cut from one waits until the long story is up (or gave up)
  const on = "status = 'rendered' and queue_pos is null and kind <> 'saga' and (video->>'bytes') is not null and coalesce((select i.channels->>'youtube' from yt_ideas i where i.id = yt_scripts.idea_id), 'true') <> 'false' and (kind <> 'story' or (select short_style from yt_settings where id = 1) = 'story')"
    + " and not exists (select 1 from yt_scripts p where p.id = yt_scripts.parent_id and p.status <> 'uploaded' and not (p.status = 'failed' and p.render_tries >= 3) and p.created_at > now() - interval '3 days')"
  const first = (await q(`update yt_scripts set queue_pos = (select coalesce(min(queue_pos), 1) from yt_scripts where queue_pos is not null) - 1 where ${on} and exists (select 1 from yt_ideas i where i.id = yt_scripts.idea_id and i.first) returning id`)).rowCount   // Make it next: the front of the queue
  return first + (await q(`update yt_scripts set queue_pos = (select coalesce(max(queue_pos), 0) from yt_scripts) + id where ${on} returning id`)).rowCount
}
export async function uploadNext() {
  const st = await settings(), times = slotTimes(st), used = await usedSlots(times), now = Date.now(), today = lagosDay(now)
  let pick = null
  if (st.publish_mode === 'scheduled') { for (const d of [today, addDays(today, 1)]) for (const t of times) if (!pick && !used.has(d + ' ' + t) && slotMs(d, t) >= now + 30 * 60e3) pick = [d, t] }
  else for (const t of times) if (!pick && !used.has(today + ' ' + t) && now >= slotMs(today, t)) pick = [today, t]   // private: goes up at the time, you make it Public
  if (!pick) return null
  const opts = { slot: pick[0] + ' ' + pick[1], ...(st.publish_mode === 'scheduled' ? { publishAt: new Date(slotMs(pick[0], pick[1])).toISOString() } : {}) }
  // a broken video (its stored copy gone) must never block the queue: mark it stopped, with the reason, and try the next
  for (const s of (await q("select id from yt_scripts where status = 'rendered' and queue_pos is not null and kind <> 'saga' and (video->>'bytes') is not null and coalesce((select i.channels->>'youtube' from yt_ideas i where i.id = yt_scripts.idea_id), 'true') <> 'false' order by queue_pos, id limit 3")).rows) {
    try { const r = await uploadVideo(s.id, opts); await q('update yt_scripts set queue_pos = null where id = $1', [s.id]); return r }
    catch (e) {
      if (!/missing from storage|Only a finished/.test(e.message)) throw e                      // quota, sign-in, network: retry later as it is
      await q("update yt_scripts set status = 'failed', queue_pos = null, render_error = $2 where id = $1", [s.id, 'Couldn’t upload: ' + e.message + ' Make it again.'])
    }
  }
  return null
}
// The long story's own lane: one a day at its own time (Lagos), apart from the Shorts' slots, so the main video never waits
// behind the day's Shorts. Private mode: up at the time, you make it Public. Scheduled: up ahead, public at the time.
export async function sagaNext() {
  const st = await one('select publish_mode, saga_time from yt_settings where id = 1'), now = Date.now(), today = lagosDay(now), time = /^\d\d:\d\d$/.test(st.saga_time || '') ? st.saga_time : '16:00'
  const done = new Set((await q("select upload from yt_scripts where kind = 'saga' and status = 'uploaded' and uploaded_at > now() - interval '3 days'")).rows.map((r) => r.upload && r.upload.slot).filter(Boolean))
  let day = null
  if (st.publish_mode === 'scheduled') { for (const d of [today, addDays(today, 1)]) if (!day && !done.has(d + ' saga') && slotMs(d, time) >= now + 30 * 60e3) day = d }
  else if (!done.has(today + ' saga') && now >= slotMs(today, time)) day = today
  if (!day) return null
  const s = await one("select id from yt_scripts where kind = 'saga' and status = 'rendered' and queue_pos is null and (video->>'bytes') is not null order by id limit 1")
  if (!s) return null
  try { return await uploadVideo(s.id, { slot: day + ' saga', lane: 'saga', ...(st.publish_mode === 'scheduled' ? { publishAt: new Date(slotMs(day, time)).toISOString() } : {}) }) }
  catch (e) {
    if (!/missing from storage|Only a finished/.test(e.message)) throw e
    await q("update yt_scripts set status = 'failed', render_error = $2 where id = $1", [s.id, 'Couldn’t upload: ' + e.message + ' Make it again.']); return null
  }
}
export async function setSagaTime(t) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t || '')) throw new Error('Choose a time like 16:00.')
  await q('update yt_settings set saga_time = $1 where id = 1', [t]); return { ok: true, time: t }
}
export async function savePostingTimes({ perDay, time, time2 }) {
  const ok = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t || ''), two = Number(perDay) === 2
  if (!ok(time)) throw new Error('Choose a time like 18:00.')
  if (two && (!ok(time2) || time2 === time)) throw new Error('For 2 videos a day, choose a second time that’s different from the first.')
  const [a, b] = two ? [time, time2].sort() : [time, null]
  await q('update yt_settings set publish_time = $1, publish_time2 = $2, publish_time3 = null where id = 1', [a, b])
  await stepAside('youtube')
  return { ok: true, times: two ? [a, b] : [a] }
}
// Best posting times. YouTube gives channel numbers per DAY, not per hour, so the honest way to learn your peak hour is from your
// own uploads: views per video, grouped by the hour each went up. Until there's enough of that, starting suggestions for the niche.
export const START_TIMES = [
  { time: '12:00', why: 'Lunch-break scrolling in Nigeria and Europe' },
  { time: '18:00', why: 'After work and school; mid-morning in the US' },
  { time: '20:00', why: 'Evening phone time, the busiest viewing hours in Nigeria' },
]
// The country's clock offset from UTC (standard time) and name, for where his viewers are
const TZ = { NG: [1, 'Nigeria'], GH: [0, 'Ghana'], KE: [3, 'Kenya'], ZA: [2, 'South Africa'], GB: [0, 'UK'], IE: [0, 'Ireland'], US: [-5, 'US'], CA: [-5, 'Canada'],
  IN: [5.5, 'India'], PK: [5, 'Pakistan'], PH: [8, 'Philippines'], AU: [10, 'Australia'], DE: [1, 'Germany'], FR: [1, 'France'], NL: [1, 'Netherlands'], ES: [1, 'Spain'],
  IT: [1, 'Italy'], BR: [-3, 'Brazil'], MX: [-6, 'Mexico'], AE: [4, 'UAE'], SA: [3, 'Saudi Arabia'], EG: [2, 'Egypt'], ID: [7, 'Indonesia'], MY: [8, 'Malaysia'],
  SG: [8, 'Singapore'], BD: [6, 'Bangladesh'], NZ: [12, 'New Zealand'], JP: [9, 'Japan'], KR: [9, 'South Korea'], TR: [3, 'Turkey'], CM: [1, 'Cameroon'], UG: [3, 'Uganda'],
  TZ: [3, 'Tanzania'], RW: [2, 'Rwanda'], ZM: [2, 'Zambia'], ZW: [2, 'Zimbabwe'], ET: [3, 'Ethiopia'] }
const awake = (l) => (l >= 19 && l <= 22 ? 1 : l >= 12 && l <= 14 ? 0.85 : l >= 15 && l <= 18 ? 0.7 : l >= 7 && l <= 11 ? 0.55 : l === 23 ? 0.5 : 0.1)   // phone time by local hour
export async function bestTimes() {
  const rows = (await q("select published_at, views from yt_videos where is_short and published_at < now() - interval '3 days' and published_at > now() - interval '120 days'")).rows
  const med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2 }
  const ownBy = {}; for (const r of rows) { const h = new Date(new Date(r.published_at).getTime() + 3600e3).getUTCHours(); (ownBy[h] = ownBy[h] || []).push(Number(r.views) || 0) }
  const ownOk = rows.length >= 8 && Object.values(ownBy).filter((v) => v.length >= 2).length >= 2
  const own = {}; if (ownOk) for (const [h, v] of Object.entries(ownBy)) if (v.length >= 2) own[h] = { n: v.length, median: med(v) }
  const R = await one('select researched_at, videos, hours, countries from yt_time_research where id = 1').catch(() => null)
  const comp = {}; if (R && R.hours) for (const [h, x] of Object.entries(R.hours)) if (x.n >= 3) comp[h] = x
  const compAll = R && R.hours ? med(Object.values(R.hours).flatMap((x) => Array(x.n).fill(x.median))) || 1 : 1
  const countries = (R && R.countries || []).filter((c) => TZ[c.c])
  const audAt = (h) => countries.reduce((a, c) => a + c.share * awake(((h - 1 + TZ[c.c][0]) % 24 + 24) % 24), 0)
  const max = (o, f) => Math.max(1e-9, ...Object.values(o).map(f))
  const mc = max(comp, (x) => x.median), mo = max(own, (x) => x.median), ma = Math.max(1e-9, ...Array.from({ length: 24 }, (_, h) => audAt(h)))
  const scored = []
  for (let h = 0; h < 24; h++) {
    const parts = []
    if (comp[h]) parts.push([0.5, comp[h].median / mc]); if (countries.length) parts.push([0.3, audAt(h) / ma]); if (own[h]) parts.push([0.2, own[h].median / mo])
    if (!parts.length || !(comp[h] || own[h])) continue                                  // only hours with real evidence
    const w = parts.reduce((a, p) => a + p[0], 0), score = parts.reduce((a, p) => a + p[0] * p[1], 0) / w
    const why = []
    if (comp[h]) why.push(`Top niche Shorts posted around this hour gained ${(comp[h].median / compAll).toFixed(1)}× the usual views per day (${comp[h].n} videos)`)
    if (countries.length) { const up = countries.filter((c) => awake(((h - 1 + TZ[c.c][0]) % 24 + 24) % 24) >= 0.7); const pct = Math.round(up.reduce((a, c) => a + c.share, 0) * 100)
      if (pct) why.push(`${pct}% of your viewers are on their phones then (${up.slice(0, 3).map((c) => TZ[c.c][1]).join(', ')})`) }
    if (own[h]) why.push(`${Math.round(own[h].median)} views per video when you posted at this hour (${own[h].n} videos)`)
    scored.push({ time: String(h).padStart(2, '0') + ':00', score, why: why.join('. ') + '.' })
  }
  scored.sort((a, b) => b.score - a.score)
  const picks = []; for (const x of scored) if (picks.every((p) => Math.abs(Number(p.time.slice(0, 2)) - Number(x.time.slice(0, 2))) >= 2)) { picks.push(x); if (picks.length === 3) break }
  return { picks, researchedAt: R && R.researched_at ? new Date(R.researched_at).toISOString() : null, nicheVideos: R ? R.videos : 0, countries: countries.map((c) => TZ[c.c][1]).slice(0, 4), ownVideos: rows.length, start: START_TIMES }
}
// The Videos tab: every finished or uploaded video, with its numbers from YouTube
export async function videosData() {
  try { await Promise.race([checkUploads(), new Promise((ok) => setTimeout(ok, 5000))]) } catch {}   // ask YouTube for Private/Public (at most every 10 minutes)
  const rows = (await q(`select s.id, s.kind, s.part, s.status, s.script, s.package, s.seconds, s.video, s.yt_video_id, s.uploaded_at, s.upload, s.queue_pos, s.updated_at, s.created_at, s.fb,
      coalesce(i.name, 'Long video') as name, v.views, v.avg_view_pct, v.minutes, v.privacy, v.thumb
    from yt_scripts s left join yt_ideas i on i.id = s.idea_id left join yt_videos v on v.video_id = s.yt_video_id
    where s.status in ('rendered', 'uploaded') order by coalesce(s.uploaded_at, s.updated_at) desc limit 300`)).rows
  const st = await settings()
  return { videos: rows.map((r) => ({ id: r.id, kind: r.kind, part: r.part, volume: r.script && r.script.volume, name: r.name, title: r.package && r.package.title, seconds: (r.video && r.video.seconds) || r.seconds,
      status: r.status, queued: r.queue_pos != null, ytId: r.yt_video_id, special: !!(r.upload && r.upload.special), privacy: (r.upload && r.upload.privacy) || r.privacy || (r.status === 'uploaded' ? 'private' : null),
      views: r.upload && r.upload.views != null ? Number(r.upload.views) : r.views == null ? null : Number(r.views), watched: r.avg_view_pct,
      ytPrivacy: r.upload && r.upload.privacy || null, checkedAt: r.upload && r.upload.checkedAt || null, thumb: r.thumb || (r.yt_video_id ? `https://i.ytimg.com/vi/${r.yt_video_id}/hqdefault.jpg` : null),
      fb: r.fb ? { status: r.fb.status, id: r.fb.video_id || null } : null, madeAt: (r.video && r.video.made_at) || r.updated_at.toISOString(), uploadedAt: r.uploaded_at && r.uploaded_at.toISOString() })),
    queue: await queueList(), best: await bestTimes(), meta: await metaStatus().catch(() => null), mode: st.publish_mode, autopilot: ((await one('select yt_mode as mode from yt_settings where id = 1').catch(() => null)) || {}).mode === 'autopilot' }
}
// You chose the times yourself: the posting agent (postagent.js) steps aside for that platform. Inline here, not imported, to keep
// postagent.js → publish.js one-way.
export async function stepAside(platform) {
  await q("update post_agent set enabled = false, note = 'You set the posting times yourself, so the agent stepped aside. Switch it on again to let it decide.' where platform = $1 and enabled", [platform]).catch(() => {})
}
export async function savePublishSettings({ mode, time, time2, perDay, series, inTitle, intro, longDays, longCount }) {
  const ok = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t || '')
  if (!['private', 'scheduled'].includes(mode) || !ok(time)) throw new Error('Choose private or scheduled, and a time like 18:00.')
  if (perDay !== undefined) {                          // the Scripts tab form doesn't send this: leave the second slot as it is
    const two = Number(perDay) === 2
    if (two && (!ok(time2) || time2 === time)) throw new Error('For 2 videos a day, choose a second time that’s different from the first.')
    await q('update yt_settings set publish_time2 = $1, publish_time3 = null where id = 1', [two ? time2 : null])
    await stepAside('youtube')
  }
  const name = String(series || '').replace(/\s+/g, ' ').trim()
  if (name.length < 4 || name.length > 50 || /[<>]/.test(name)) throw new Error('The series name should be 4 to 50 characters.')
  const days = (Array.isArray(longDays) ? longDays : ['tue', 'fri']).filter((d) => ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].includes(d))
  const count = Math.max(4, Math.min(10, Number(longCount) || 6))
  return one('update yt_settings set publish_mode = $1, publish_time = $2, series = $3, series_in_title = $4, spoken_intro = $5, long_days = $6, long_count = $7 where id = 1 returning publish_mode, publish_time, series, series_in_title, spoken_intro, long_days, long_count',
    [mode, time, name, inTitle !== false, intro !== false, [...new Set(days)].join(','), count])
}

// Install 22: a real story's thumbnail goes to YouTube right after the video. Custom thumbnails need a verified channel
// (phone verification in YouTube Studio); if YouTube says no, the reason is kept and the video keeps YouTube's own pick.
async function setThumb(s, videoId) {
  const res = await getPiece(`vid/${s.id}/${String(s.video.thumb.n || 999).padStart(3, '0')}.bin`); if (!res) return
  const buf = Buffer.from(await res.arrayBuffer()), token = await accessTokenForUpload()
  const base = (process.env.YT_UPLOAD_BASE || 'https://www.googleapis.com').replace(/\/$/, '')
  const r = await fetch(`${base}/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}`, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'image/jpeg', 'Content-Length': String(buf.length) }, body: buf })
  const note = r.ok ? 'set' : r.status === 403 ? 'YouTube refused it: verify the channel by phone in YouTube Studio to allow custom thumbnails' : 'YouTube said ' + r.status
  await q("update yt_scripts set upload = jsonb_set(coalesce(upload, '{}'::jsonb), '{thumb}', to_jsonb($2::text)) where id = $1", [s.id, note])
}
