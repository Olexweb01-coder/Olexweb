// Install 26: the plan. Three days ahead, YouTube and Facebook each with their own video for every posting time, a different
// format every time, nothing made or posted until approved; approve, swap, retitle, leave empty; missed videos move on.
import pg from 'pg'
import fs from 'node:fs'
import { createHmac, createHash, randomBytes } from 'node:crypto'
const APP = 'http://localhost:3000', G = 'http://localhost:4555'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0; const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + String(extra).slice(0, 400) : '')) } }
const u = (await db.query("select id from admin_users where email = 'owner@test.local'")).rows[0], T = randomBytes(32).toString('base64url')
await db.query("insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '1 day')", [createHash('sha256').update(T).digest('hex'), u.id])
const api = async (b) => { const r = await fetch(APP + '/admin/api/youtube', { method: 'POST', headers: { cookie: '__Host-olex_sess=' + T, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const html = async (p) => (await (await fetch(APP + p, { headers: { cookie: '__Host-olex_sess=' + T } })).text()).replace(/<!-- -->/g, '')
const run = async () => (await (await fetch(APP + '/api/assistant/cron?run=due', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } })).json())
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0]
const all = async (sql, p = []) => (await db.query(sql, p)).rows
const state = async () => (await fetch(G + '/_state')).json()
const SECRET = process.env.FACTORY_SECRET
const signed = (path, body, raw = false) => { const buf = raw ? body : Buffer.from(JSON.stringify(body)), ts = Math.floor(Date.now() / 1000), h = createHash('sha256').update(buf).digest('hex')
  return fetch(APP + path, { method: 'POST', headers: { 'x-factory-sig': ts + '.' + createHmac('sha256', SECRET).update(`${ts}\nPOST\n${path}\n${h}`).digest('hex'), 'Content-Type': 'application/json' }, body: buf }) }
const VID = fs.readFileSync('/home/claude/olexweb-factory/out/video.mp4')
async function factoryFinish(id) {                                       // plays the factory's part: the pieces, then "finished"
  const n = Math.ceil(VID.length / 1048576)
  for (let i = 0; i < n; i++) { const r = await signed(`/api/factory/upload?id=${id}&n=${i}`, VID.subarray(i * 1048576, (i + 1) * 1048576), true); if (r.status !== 200) return 'piece ' + i + ': ' + r.status }
  const r = await signed(`/api/factory/finish?id=${id}`, { pieces: n, bytes: VID.length, seconds: 30, width: 1080, height: 1920 }); return r.status === 200 ? null : 'finish ' + r.status + ' ' + await r.text()
}
const lagosDay = (ms = Date.now()) => new Date(ms + 3600e3).toISOString().slice(0, 10)
const lagosHM = (ms) => new Date(ms + 3600e3).toISOString().slice(11, 16)
const day = (r) => (r.day instanceof Date ? `${r.day.getFullYear()}-${String(r.day.getMonth() + 1).padStart(2, '0')}-${String(r.day.getDate()).padStart(2, '0')}` : String(r.day))

// a clean start: other videos out of the way, Approval, both channels on, ideas ready
await db.query("update yt_scripts set status = 'uploaded' where status in ('rendering', 'approved', 'draft', 'needs_review', 'rendered', 'failed')")
await db.query('delete from plan_slots'); await db.query("update yt_settings set plan_on = true, yt_mode = 'approval', publish_mode = 'private', publish_time = '20:11', publish_time2 = null, publish_time3 = null")
await db.query("update meta_settings set enabled = true, per_day = 2, times = '13:00,20:00', video_days = null, story_on = false, paused_reason = null, paused_at = null");   // every day here (Install 29's 3-a-week is tested in fFBSTORY) await db.query('update post_agent set enabled = false').catch(() => {})
await db.query("update yt_idea_runs set last_run = now(), running_until = null")       // the daily idea search already ran today
await db.query("update yt_ideas set status = 'passed' where status in ('new', 'picked')")
await db.query("delete from yt_ideas where key like 'plan-%'")
const SITES = ['squoosh', 'fontpair', 'tldraw', 'gradientlab', 'paletteforge', 'masonry', 'shotcut', 'squoosh', 'fontpair', 'tldraw', 'gradientlab', 'paletteforge', 'masonry', 'shotcut', 'squoosh', 'fontpair']   // enough for 9 times plus swaps
for (let k = 0; k < SITES.length; k++) await db.query("insert into yt_ideas (key, name, url, source, status, score) values ($1, $2, $3, 'test', 'new', $4)",
  ['plan-' + k, SITES[k][0].toUpperCase() + SITES[k].slice(1), `http://${SITES[k]}.test:4555/site/${SITES[k]}`, 90 - k])
await fetch(G + '/_set?fbBlock=false')

console.log('\n180. The plan fills the next 3 days, each channel with its own videos')
let r = await run()
let slots = await all('select * from plan_slots order by day, time, channel')
const now = Date.now(), today = lagosDay(now), expect = []
for (let d = 0; d < 3; d++) { const dd = lagosDay(now + d * 86400e3); for (const [c, ts] of [['youtube', ['20:11']], ['facebook', ['13:00', '20:00']]]) for (const t of ts) if (Date.parse(`${dd}T${t}:00Z`) - 3600e3 > now + 10 * 60e3) expect.push(c + ' ' + dd + ' ' + t) }
check(slots.length === expect.length && expect.every((e) => slots.some((s) => s.channel + ' ' + day(s) + ' ' + s.time === e)), `every posting time for the next 3 days has its place (${expect.length}: YouTube at 20:11, Facebook at 13:00 and 20:00)`, slots.map((s) => s.channel + ' ' + day(s) + ' ' + s.time).join(', '))
for (let k = 0; k < 14 && (await one("select count(*)::int n from plan_slots where script_id is null and status = 'planned'")).n; k++) r = await run()
slots = await all('select p.*, s.status as st, s.fb, s.idea_id, s.package, s.script from plan_slots p left join yt_scripts s on s.id = p.script_id order by p.day, p.time, p.channel')
check(slots.every((s) => s.script_id), 'one by one, each time gets its video written', JSON.stringify(slots.map((s) => [s.format, s.note])))
check(new Set(slots.map((s) => s.script_id)).size === slots.length && new Set(slots.filter((s) => s.idea_id).map((s) => s.idea_id)).size === slots.filter((s) => s.idea_id).length, 'no video (and no website) is used twice: YouTube and Facebook each have their own')
const seq = (c) => slots.filter((s) => s.channel === c).map((s) => s.format)
const noRepeat = (a) => a.every((f, i) => i === 0 || f !== a[i - 1])
const wSeq = (c) => slots.filter((s) => s.channel === c).map((s) => (s.script || {}).topic || (s.script || {}).world)
check(noRepeat(wSeq('youtube')) && noRepeat(wSeq('facebook')), 'Install 34: the topic changes every time on each channel', 'YouTube: ' + wSeq('youtube').join(', ') + ' · Facebook: ' + wSeq('facebook').join(', '))
const days = [...new Set(slots.map(day))]
check(slots.every((s) => s.format === 'chain'), 'Install 34: every planned video is a You build it chain')
check(true, '(Install 33: one format, so YouTube and Facebook differ by build, checked in fSHORT)')
check(slots.every((s) => ['draft', 'needs_review'].includes(s.st)), 'on Approval every one waits for you', slots.map((s) => s.st).join(','))
check(slots.filter((s) => s.channel === 'youtube').every((s) => s.fb && s.fb.status === 'off') && slots.filter((s) => s.channel === 'facebook').every((s) => !s.fb), 'YouTube’s videos are never offered to Facebook (and the other way round)')
check(!(await one("select 1 from yt_scripts where status = 'rendering'")) && !(await state()).dispatches?.some((d) => slots.some((s) => String(s.script_id) === d.body.inputs.id)), 'nothing is made before you approve it')
let h = await html('/admin/automation/plan')
const waiting = slots.length
check(h.includes(`${waiting} videos wait for you`) && h.includes('Approve all ' + waiting) && h.includes('Tomorrow') && h.includes('Read the words') && slots.filter((s) => s.package).every((s) => h.includes(s.package.title.replace(/\s*#shorts\s*$/i, '').replace(/&/g, '&amp;').replace(/'/g, '&#x27;'))), 'the Plan screen shows each day, each video’s title and words, and what waits for you')
check(h.includes('YouTube') && h.includes('Facebook') && h.includes('Swap') && h.includes('Leave empty') && h.includes('Change title'), 'with YouTube and Facebook separately, and Swap, Change title, Leave empty')
const t1 = await html('/admin/automation'); check(t1.includes(`${waiting} videos wait for your approval`) && t1.includes("Approve all") && t1.includes('/admin/automation/plan'), 'the Today tab sends you to the plan')

console.log('\n181. Approved → made → posted to YouTube at its time')
const y1 = slots.find((s) => s.channel === 'youtube')
r = await api({ action: 'plan-approve', id: y1.id }); check(r.s === 200 && (await one('select status from yt_scripts where id = $1', [y1.script_id])).status === 'approved', 'Approve', JSON.stringify(r.j))
r = await run(); check((await one('select status from yt_scripts where id = $1', [y1.script_id])).status === 'rendering' && (r.factory || {}).id === y1.script_id, 'the factory makes the approved one (only that one)', JSON.stringify(r.factory || r.errors))
let e = await factoryFinish(y1.script_id); check(!e && (await one('select status from yt_scripts where id = $1', [y1.script_id])).status === 'rendered', 'it’s finished', e)
h = await html('/admin/automation/plan'); check(h.includes('/admin/api/youtube/video?id=' + y1.script_id) && h.includes('Watch the video'), 'you can watch it on the Plan screen before it goes out')
r = await run(); check(!(await one('select yt_video_id from yt_scripts where id = $1', [y1.script_id])).yt_video_id, 'it waits for its time')
const due = Date.now() - 5 * 60e3
await db.query('update plan_slots set day = $2, time = $3 where id = $1', [y1.id, lagosDay(due), lagosHM(due)])
r = await run()
let s = await one('select status, yt_video_id, upload, fb from yt_scripts where id = $1', [y1.script_id]), p = await one('select * from plan_slots where id = $1', [y1.id])
check(s.status === 'uploaded' && s.yt_video_id && p.status === 'posted' && s.upload.slot === lagosDay(due) + ' ' + lagosHM(due), 'at its time it goes up on YouTube, and the plan shows it posted', JSON.stringify(r.planPosted || r.errors))
check(!(await one("select 1 from meta_posts where script_id = $1", [y1.script_id])), 'it isn’t posted to Facebook')

console.log('\n182. Facebook gets its own')
const f1 = slots.find((x) => x.channel === 'facebook')
r = await api({ action: 'plan-approve', id: f1.id }); r = await run()
check((r.factory || {}).id === f1.script_id, 'approved, then made', JSON.stringify(r.factory || r.errors))
e = await factoryFinish(f1.script_id); const fbBefore = ((await state()).fbPosts || []).length
await db.query('update plan_slots set day = $2, time = $3 where id = $1', [f1.id, lagosDay(due), lagosHM(due)]); await db.query("delete from meta_posts where at > now() - interval '2 hours'")
r = await run()
s = await one('select status, fb, video, yt_video_id from yt_scripts where id = $1', [f1.script_id]); p = await one('select * from plan_slots where id = $1', [f1.id])
check(!e && p.status === 'posted' && s.fb.status === 'posted' && ((await state()).fbPosts || []).length === fbBefore + 1, 'at its time it’s posted to the Facebook Page as a Reel', JSON.stringify([e, r.planPosted, r.errors, p.note]))
check(!s.yt_video_id && s.video === null && (await one('select i.status from yt_ideas i join yt_scripts x on x.idea_id = i.id where x.id = $1', [f1.script_id]) || { status: 'made' }).status === 'made', 'never sent to YouTube; its copy is freed and its website counts as used')

console.log('\n183. Swap, change the title, leave empty')
const rest = await all("select p.*, s.package from plan_slots p join yt_scripts s on s.id = p.script_id where p.status = 'planned' order by p.day, p.time")
const sw = rest[0]
r = await api({ action: 'plan-swap', id: sw.id }); const sw2 = await one('select * from plan_slots where id = $1', [sw.id])
check(r.s === 200 && sw2.script_id && sw2.script_id !== sw.script_id && !(await one('select 1 from yt_scripts where id = $1', [sw.script_id])), 'Swap: the old video is gone and a different one takes its place', JSON.stringify([r.j, sw.format, sw2.format]))
const rt = rest[1]
r = await api({ action: 'plan-title', id: rt.id, title: 'This free site does what Photoshop charges for' })
check(r.s === 200 && (await one('select package from yt_scripts where id = $1', [rt.script_id])).package.title === 'This free site does what Photoshop charges for', 'Change title')
r = await api({ action: 'plan-title', id: rt.id, title: 'x' }); check(r.s === 400 && /4 to 90/.test(r.j.error), 'a title that’s too short is refused')
const sk = rest[2], skIdea = (await one('select idea_id from yt_scripts where id = $1', [sk.script_id])).idea_id
r = await api({ action: 'plan-skip', id: sk.id }); p = await one('select * from plan_slots where id = $1', [sk.id])
check(r.s === 200 && p.status === 'skipped' && !p.script_id && !(await one('select 1 from yt_scripts where id = $1', [sk.script_id])) && (!skIdea || (await one('select status from yt_ideas where id = $1', [skIdea])).status === 'new'), 'Leave empty: nothing goes out then, and its website goes back for another day')
r = await run(); check((await one('select status from plan_slots where id = $1', [sk.id])).status === 'skipped' && !(await one('select script_id from plan_slots where id = $1', [sk.id])).script_id, 'and it stays empty')

console.log('\n184. A video that missed its time moves on')
const two = (await one("select channel from plan_slots where status = 'planned' and script_id is not null group by channel having count(*) >= 2 order by count(*) desc limit 1")).channel
const mi = (await all("select p.* from plan_slots p join yt_scripts s on s.id = p.script_id where p.channel = $1 and p.status = 'planned' and s.status in ('draft', 'needs_review') order by p.day, p.time", [two]))[0]
const late = Date.now() - 4 * 3600e3
await db.query('update plan_slots set day = $2, time = $3 where id = $1', [mi.id, lagosDay(late), lagosHM(late)])
r = await run()
p = await one('select * from plan_slots where id = $1', [mi.id]); const back = await one("select * from plan_slots where script_id = $1 and status = 'planned'", [mi.script_id])
check(p.status === 'missed' && /wasn’t approved in time/.test(p.note), 'not approved in time: marked missed, saying why', p.note)
check(back && back.script_id === mi.script_id && /Moved here/.test(back.note || ''), 'its video takes the nearest open time instead of being wasted', JSON.stringify(back))

console.log('\n185. Approve all, and turning the plan off')
r = await api({ action: 'plan-approve-all' }); check(r.s === 200 && r.j.approved >= 2 && !(await one("select 1 from plan_slots p join yt_scripts s on s.id = p.script_id where p.status = 'planned' and s.status in ('draft', 'needs_review')")), `Approve all (${r.j.approved})`)
h = await html('/admin/automation/plan'); check(h.includes('Everything planned is approved'), 'the screen says so')
r = await api({ action: 'plan-on', on: false }); r = await run()
check(!r.planned && !r.planWrote && !r.planPosted && (await one('select plan_on from yt_settings')).plan_on === false, 'off: the plan does nothing and the old way takes over')
await api({ action: 'plan-on', on: true })
r = await fetch(APP + '/admin/api/youtube', { method: 'POST', headers: { Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'plan-approve-all' }) }); check(r.status === 401, 'nobody signed out can touch it')

// leave the test database as the other suites expect
if (!process.env.KEEP) { await db.query("update yt_scripts set status = 'uploaded' where status in ('rendering', 'approved', 'draft', 'needs_review', 'rendered')"); await db.query('delete from plan_slots'); await db.query('update yt_settings set plan_on = false') }
console.log(`\npassed: ${pass}`); if (failn) console.log(`failed: ${failn}`)
await db.end(); process.exit(failn ? 1 : 0)
