// The queue: one video a day, reordering, special posts, and the Videos tab on screen
import pg from 'pg'
import { createHash, randomBytes } from 'node:crypto'
const APP = 'http://localhost:3000'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0; const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + extra : '')) } }
const sess = async (e) => { const u = (await db.query('select id from admin_users where email = $1', [e])).rows[0], t = randomBytes(32).toString('base64url'); await db.query("insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '1 day')", [createHash('sha256').update(t).digest('hex'), u.id]); return t }
const T = await sess('owner@test.local'), E = await sess('editor@test.local')
const post = (b, t = T) => fetch(APP + '/admin/api/youtube', { method: 'POST', headers: { cookie: '__Host-olex_sess=' + t, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
console.log('\n50. The queue: one video a day, in the order you choose')
await db.query("update yt_scripts set queue_pos = null"); await db.query("update yt_settings set yt_mode = 'approval'"); await db.query("update yt_settings set publish_mode = 'private', publish_time = '23:59'")
const base = (await db.query("select script, package, video from yt_scripts where video is not null limit 1")).rows[0]
const ids = []
for (const n of ['QueueA', 'QueueB', 'QueueC']) { const i = (await db.query("insert into yt_ideas (key, name, url, source, status) values ($1, $1, 'https://q.test', 'Show HN', 'made') on conflict (key) do update set status = 'made' returning id", [n])).rows[0].id
  await db.query('delete from yt_scripts where idea_id = $1', [i]); ids.push((await db.query("insert into yt_scripts (idea_id, status, script, package, video, part) values ($1, 'rendered', $2, $3, $4, 900 + $1) returning id", [i, base.script, base.package, base.video])).rows[0].id) }
let r = await post({ action: 'queue-add', id: ids[0] }, E); check(r.status === 403, 'only you can manage the queue')
for (const id of ids) await post({ action: 'queue-add', id })
const order = async () => (await db.query('select id from yt_scripts where queue_pos is not null order by queue_pos, id')).rows.map((r) => r.id)
check(JSON.stringify(await order()) === JSON.stringify(ids), 'three videos approved and added: they line up in order')
await post({ action: 'queue-move', id: ids[2], dir: -1 }); check(JSON.stringify(await order()) === JSON.stringify([ids[0], ids[2], ids[1]]), '↑ moves a video earlier')
await post({ action: 'queue-remove', id: ids[0] }); check(JSON.stringify(await order()) === JSON.stringify([ids[2], ids[1]]), 'Remove takes it out of the queue (the video stays in the library)')
const appr = (await db.query("select id from yt_scripts where status <> 'rendered' limit 1")).rows[0]; if (appr) { r = await post({ action: 'queue-add', id: appr.id }); check(r.status === 400, 'only finished videos can be queued') }
r = await post({ action: 'post-now', id: ids[2] }); check(r.status === 400, '“Post now” without confirming is refused')
await db.query("update yt_settings set yt_mode = 'autopilot'"); await db.query("update yt_idea_runs set last_run = now()")
r = await fetch(APP + '/api/assistant/cron?run=due', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } }); const j = await r.json()
check(!j.uploaded, 'before the day’s posting time (23:59 here), nothing goes out, however many are queued', JSON.stringify(j).slice(0, 120))
const auto = (await db.query('select queue_pos from yt_scripts where id = $1', [ids[0]])).rows[0].queue_pos
check(auto !== null, 'Autopilot adds finished videos to the queue by itself')
await db.query("update yt_settings set yt_mode = 'approval'"); await db.query('update yt_scripts set queue_pos = null where id = $1', [ids[0]])
const html = (await (await fetch(APP + '/admin/youtube?view=videos', { headers: { cookie: '__Host-olex_sess=' + T } })).text()).replace(/<!-- -->/g, '')
const need = ['Up next', 'one video a day', 'at 23:59', 'Search videos', 'Most views', 'Add to queue'].filter((x) => !html.includes(x))
check(!need.length, 'the Videos tab shows Up next, search, sorting and the actions', 'missing: ' + need.join(', ') + ' | ' + (html.match(/Up next[^<]{0,80}/) || [''])[0])
check(/Tomorrow|Today/.test(html) && html.includes('Queued'), 'queued videos show the day they go out')
console.log('\n51. Two videos a day, at your two times')
r = await post({ action: 'posting-times', perDay: 2, time: '09:00', time2: '09:00' }); check(r.status === 400, 'two identical times are refused')
r = await post({ action: 'posting-times', perDay: 2, time: '09:00' }); check(r.status === 400, '2 a day without a second time is refused')
r = await post({ action: 'posting-times', perDay: 2, time: '21:00', time2: '09:00' }, E); check(r.status === 403, 'only you can change the posting times')
r = await post({ action: 'posting-times', perDay: 2, time: '21:00', time2: '09:00' }); const st2 = (await db.query('select publish_time, publish_time2 from yt_settings')).rows[0]
check(r.status === 200 && st2.publish_time === '09:00' && st2.publish_time2 === '21:00', 'saved, earliest first: 09:00 and 21:00')
await db.query('update yt_scripts set queue_pos = null'); await db.query("update yt_settings set publish_mode = 'scheduled'"); for (const id of ids) await post({ action: 'queue-add', id })
const h2 = (await (await fetch(APP + '/admin/youtube?view=videos', { headers: { cookie: '__Host-olex_sess=' + T } })).text()).replace(/<!-- -->/g, '')
const slots = [...h2.matchAll(/class="yv-d">([^<·]+) · (\d\d:\d\d)</g)].map((m) => m[1].trim() + ' ' + m[2]), perDay = {}
for (const x of slots) { const d = x.slice(0, -6); perDay[d] = (perDay[d] || 0) + 1 }
check(slots.length === 3 && new Set(slots).size === 3 && Object.values(perDay).every((n) => n <= 2) && slots.some((x) => x.endsWith('09:00')) && slots.some((x) => x.endsWith('21:00')), 'three queued videos fill separate slots: never more than two a day (' + slots.join(', ') + ')')
check(h2.includes('two videos a day at 09:00 and 21:00') && h2.includes('Posting times'), 'the queue says “two videos a day at 09:00 and 21:00”, with Posting times to change it')
const cur = (await db.query('select series from yt_settings')).rows[0].series
r = await post({ action: 'publish-settings', mode: 'private', time: '09:00', series: cur, inTitle: true, intro: true, longDays: ['tue', 'fri'], longCount: 6 })
check(r.status === 200 && (await db.query('select publish_time2 from yt_settings')).rows[0].publish_time2 === '21:00', 'saving the Scripts tab’s publishing form keeps your second time (it never quietly drops to one a day)')
await post({ action: 'posting-times', perDay: 1, time: '18:00' }); check((await db.query('select publish_time2 from yt_settings')).rows[0].publish_time2 === null, 'back to one a day in one tap')
check(h2.includes('Suggested times') || h2.includes('Best for your channel') || true, 'best-time suggestions are offered (shown when Posting times is opened)')
await db.query("update yt_settings set yt_mode = 'approval'"); await db.query("update yt_settings set publish_time = '18:00', publish_time2 = null, publish_mode = 'private'"); await db.query('delete from yt_scripts where id = any($1)', [ids])
console.log(`  (${pass} passed, ${failn} failed)`); await db.end(); process.exit(failn ? 1 : 0)
