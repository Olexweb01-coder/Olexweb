// Install 10: the posting agent. Starts at 1 a day; goes up only when views per video and the share watched hold and 3 days of
// videos are ready; down when views fall 30% or videos run short; never above 3; reviews weekly; your own times switch it off.
import pg from 'pg'
import { createHash, randomBytes } from 'node:crypto'
const APP = 'http://localhost:3000'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0; const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + String(extra).slice(0, 260) : '')) } }
const sess = async (e) => { const u = (await db.query('select id from admin_users where email = $1', [e])).rows[0], t = randomBytes(32).toString('base64url'); await db.query("insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '1 day')", [createHash('sha256').update(t).digest('hex'), u.id]); return t }
const T = await sess('owner@test.local'), E = await sess('editor@test.local')
const api = (path, b, t = T) => fetch(APP + path, { method: 'POST', headers: { cookie: '__Host-olex_sess=' + t, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
const html = async (path, t = T) => (await (await fetch(APP + path, { headers: { cookie: '__Host-olex_sess=' + t }, redirect: 'manual' })).text()).replace(/<!-- -->/g, '')
const run = async () => (await (await fetch(APP + '/api/assistant/cron?run=due', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } })).json())
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0]
const agent = (p) => one('select enabled, per_day, reviewed_at, reviews, note from post_agent where platform = $1', [p])
const ytTimes = async () => { const s = await one('select publish_time, publish_time2, publish_time3 from yt_settings'); return [s.publish_time, s.publish_time2, s.publish_time3].filter(Boolean) }
const apart = (t) => t.every((x, i) => i === 0 || (Number(x.slice(0, 2)) * 60 + Number(x.slice(3))) - (Number(t[i - 1].slice(0, 2)) * 60 + Number(t[i - 1].slice(3))) >= 120)
const weekAgo = (p) => db.query("update post_agent set reviewed_at = now() - interval '8 days' where platform = $1", [p])

// a clean stage: YouTube on Approval (nothing uploads mid-test), no other recent videos, Facebook agent off
await db.query("update yt_settings set yt_mode = 'approval', publish_time = '12:00', publish_time2 = '18:00', publish_time3 = null")
await db.query("update post_agent set enabled = false where platform = 'facebook'")
await db.query("delete from yt_videos where published_at > now() - interval '30 days'")
const videos = async (recent, before, watched = [50, 50]) => {
  await db.query("delete from yt_videos where video_id like 'agent-%'")
  for (let i = 0; i < 3; i++) {
    await db.query("insert into yt_videos (video_id, title, published_at, is_short, views, avg_view_pct) values ($1, 'r', now() - interval '5 days' - ($2 || ' hours')::interval, true, $3, $4)", ['agent-r' + i, String(i), recent, watched[0]])
    await db.query("insert into yt_videos (video_id, title, published_at, is_short, views, avg_view_pct) values ($1, 'b', now() - interval '15 days' - ($2 || ' hours')::interval, true, $3, $4)", ['agent-b' + i, String(i), before, watched[1]])
  }
}
const ready = async (n) => {
  await db.query("delete from yt_scripts where idea_id in (select id from yt_ideas where key like 'agent-%.test')")
  await db.query("update yt_scripts set status = 'uploaded' where status = 'rendered'")
  for (let i = 0; i < n; i++) {
    const id = (await one("insert into yt_ideas (key, name, url, source, status) values ($1, 'AgentVid', 'https://a.test', 'test', 'made') on conflict (key) do update set status = 'made' returning id", ['agent-' + i + '.test'])).id
    await db.query(`insert into yt_scripts (idea_id, status, script, package, video) values ($1, 'rendered', '{"scenes":[]}', '{"title":"t","titles":["t"]}', '{"bytes": 1000, "pieces": 1}')`, [id])
  }
}

console.log('\n101. First review: 1 a day')
await db.query("update post_agent set enabled = true, reviewed_at = null, reviews = 0, per_day = 1, note = null where platform = 'youtube'")
await ready(4); await videos(100, 100)
let rep = await run(), a = await agent('youtube'), t = await ytTimes()
check(a.per_day === 1 && t.length === 1 && a.reviews === 1, 'YouTube goes to 1 a day (from 2 times)', JSON.stringify(t))
check(/starts at 1 a day/.test(a.note || '') && /YouTube: 2 → 1 a day/.test(a.note || ''), 'its note says what changed and why, in plain words', a.note)
check(Array.isArray(rep.posting) && rep.posting.some((n) => /YouTube/.test(n)), 'the frequent run reports the review')
await run(); check((await agent('youtube')).reviews === 1, 'it reviews once a week, not on every run')

console.log('\n102. Results hold and videos are ready: one step up')
await weekAgo('youtube'); await run(); a = await agent('youtube'); t = await ytTimes()
check(a.per_day === 2 && t.length === 2 && apart(t), 'up to 2 a day, times at least 2 hours apart (' + t.join(', ') + ')', a.note)
check(/held/.test(a.note || ''), 'because views per video and the share watched held', a.note)

console.log('\n103. Holding back')
await weekAgo('youtube'); await ready(4); await videos(100, 100, [30, 50]); await run(); a = await agent('youtube')
check(a.per_day === 2, 'the share watched fell: it doesn’t post more', a.note)
await weekAgo('youtube'); await ready(5); await videos(100, 100); await run(); a = await agent('youtube')
check(a.per_day === 2 && /fewer than 3 days/.test(a.note || ''), 'results held, but under 3 days of videos ready: it waits', a.note)
await weekAgo('youtube'); await videos(50, 100); await ready(10); await run(); a = await agent('youtube')
check(a.per_day === 1 && /fell 50%/.test(a.note || ''), 'views per video fell by half: back down to 1', a.note)
await db.query("update post_agent set per_day = 2 where platform = 'youtube'"); await weekAgo('youtube'); await ready(1); await videos(100, 100); await run(); a = await agent('youtube')
check(a.per_day === 1 && /less than a day/.test(a.note || ''), 'videos running short: it posts less until production catches up', a.note)
await db.query("update post_agent set per_day = 3 where platform = 'youtube'"); await weekAgo('youtube'); await ready(12); await run(); a = await agent('youtube'); t = await ytTimes()
check(a.per_day === 3 && t.length === 3 && apart(t), 'never more than 3 a day (' + t.join(', ') + ')', a.note)
await weekAgo('youtube'); await db.query("delete from yt_videos where video_id like 'agent-%'"); await run(); a = await agent('youtube')
check(a.per_day === 3 && /not enough results/.test(a.note || ''), 'no results to judge: it changes nothing and says how many more it needs', a.note)

console.log('\n104. Trying new hours')
const before = await ytTimes()
await db.query("update post_agent set reviews = 3 where platform = 'youtube'"); await weekAgo('youtube'); await run(); a = await agent('youtube'); t = await ytTimes()
check(/tries \d\d:\d\d instead of \d\d:\d\d/.test(a.note || '') && t.length === 3 && apart(t), 'every 4th review it tests a new hour, and says so (' + before.join(', ') + ' → ' + t.join(', ') + ')', a.note)

console.log('\n105. Your choice wins')
let r = await api('/admin/api/youtube', { action: 'posting-times', perDay: 1, time: '19:30' })
a = await agent('youtube'); check(r.ok && !a.enabled && /stepped aside/.test(a.note || ''), 'setting times yourself switches the agent off for that platform')
await weekAgo('youtube'); await run(); t = await ytTimes(); check(t.length === 1 && t[0] === '19:30', 'and it leaves your times alone')
let h = await html('/admin/automation')
check(h.includes('id="at-agent"') && h.includes('Posting agent') && h.includes('Let it decide') && h.includes('stepped aside'), 'Today shows the Posting agent section, its note, and “Let it decide”')
r = await api('/admin/api/youtube', { action: 'post-agent', platform: 'youtube', on: true }, E); check(r.status === 403, 'an editor can’t switch it')
r = await api('/admin/api/youtube', { action: 'post-agent', platform: 'tiktok', on: true }); check(r.status === 400, 'an unknown platform is refused')
r = await api('/admin/api/youtube', { action: 'post-agent', platform: 'youtube', on: true }); let j = await r.json(); a = await agent('youtube')
check(r.ok && a.enabled && a.reviewed_at && Date.now() - new Date(a.reviewed_at) < 60e3 && /YouTube:/.test(j.note || ''), 'switching it on reviews at once and returns its note', j.note)
r = await api('/admin/api/youtube', { action: 'post-agent-review', platform: 'youtube' }); j = await r.json(); check(r.ok && j.note, 'Review now works')
h = await html('/admin/automation'); check(h.includes('Deciding') && /posts? a day · next review/.test(h), 'Today shows it deciding, how many a day and the next review')

console.log('\n106. Facebook: no guesswork')
await db.query("update meta_settings set per_day = 2, times = '13:00,20:00'")
await db.query("update post_agent set enabled = true, reviewed_at = null, reviews = 0, per_day = 1, base_per_day = null where platform = 'facebook'")
r = await api('/admin/api/youtube', { action: 'post-agent-review', platform: 'facebook' }); j = await r.json()
let fs = await one('select per_day, times from meta_settings')
check(r.ok && fs.per_day === 1 && fs.times === '13:00' && /won’t raise Facebook on guesswork/.test(j.note || ''), 'first review: 1 Reel a day at one of your own times, and it says why', JSON.stringify(fs) + ' ' + j.note)
await weekAgo('facebook'); r = await api('/admin/api/youtube', { action: 'post-agent-review', platform: 'facebook' }); fs = await one('select per_day from meta_settings')
const plenty = (await one("select count(*)::int n from yt_scripts where status = 'rendered'")).n
check(r.ok && fs.per_day >= 1 && fs.per_day <= 2, 'later: back to what you had (2) only when Reels are plentiful, never above it (' + fs.per_day + ' a day, ' + plenty + ' ready)')
r = await api('/admin/api/meta', { action: 'times', times: ['12:00', '18:00'] }); a = await agent('facebook')
check(!a.enabled && /stepped aside/.test(a.note || ''), 'setting Reel times yourself switches Facebook’s agent off', String(r.status))

// clean up
await db.query("delete from yt_scripts where idea_id in (select id from yt_ideas where key like 'agent-%.test')")
await db.query("delete from yt_ideas where key like 'agent-%.test'"); await db.query("delete from yt_videos where video_id like 'agent-%'")
await db.query("update post_agent set enabled = false")
console.log(`  (${pass} passed, ${failn} failed)`)
await db.end(); process.exit(failn ? 1 : 0)
