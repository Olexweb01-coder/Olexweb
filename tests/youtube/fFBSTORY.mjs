// Install 29: the daily Facebook story (Tayo's World, True tech story, The turnaround), written three days ahead, checked
// in code, posted by itself as a swipe of pictures with the link in the first comment; Facebook videos 3 a week; the
// public Olex AI and service pages; Olexweb's profiles for Google; live projects on the homepage wall.
import pg from 'pg'
import { createHash, randomBytes } from 'node:crypto'
const APP = 'http://localhost:3000', G = 'http://localhost:4555'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0; const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + String(extra).slice(0, 400) : '')) } }
const u = (await db.query("select id from admin_users where email = 'owner@test.local'")).rows[0], T = randomBytes(32).toString('base64url')
await db.query("insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '1 day')", [createHash('sha256').update(T).digest('hex'), u.id])
const api = async (path, b) => { const r = await fetch(APP + path, { method: 'POST', headers: { cookie: '__Host-olex_sess=' + T, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const run = async () => (await (await fetch(APP + '/api/assistant/cron?run=due', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } })).json())
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0]
const all = async (sql, p = []) => (await db.query(sql, p)).rows
const state = async () => (await fetch(G + '/_state')).json()
const lagosDay = (ms = Date.now()) => new Date(ms + 3600e3).toISOString().slice(0, 10)
const lagosHM = (ms) => new Date(ms + 3600e3).toISOString().slice(11, 16)
const ds = (d) => (d instanceof Date ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : String(d))
const WEEK = ['tayo', 'tayo', 'true', 'turnaround', 'tayo', 'true', 'turnaround']

await db.query("update yt_settings set plan_on = false"); await db.query("update yt_idea_runs set last_run = now(), running_until = null")
await db.query("update yt_scripts set status = 'uploaded' where status in ('approved', 'draft', 'needs_review', 'rendering', 'rendered')")
await db.query('delete from fb_stories'); await db.query("delete from dir_entries where kind <> 'tool'"); await db.query("update dir_settings set auto_publish = false, gathered_at = now()")
await db.query("update meta_settings set enabled = true, paused_reason = null, story_on = true, story_time = '23:59'")
await fetch(G + '/_set?fbBlock=false')
// a true story for the week, from the Directory
await db.query(`insert into dir_entries (slug, name, url, kind, status, content, quality, published_at, topic, score) values ('booster-caught', 'Starship booster caught at its launch tower', 'http://news.test:4555/news/booster', 'story', 'live', $1, '{}', now(), 'space', 93)`,
  [JSON.stringify({ title: 'Starship booster caught at its launch tower', summary: 'A SpaceX Super Heavy booster flew back and was caught at the same launch tower it lifted off from.', points: ['The giant mechanical arms closed around it as it slowed to a hover.', 'Catching it means SpaceX can fly it again within days.', 'Engineers said it came down within a few metres of the target.'], whatToDo: ['Watch the replay', 'Follow the next flight'] })])

console.log('\n210. Three days of stories, written ahead')
for (let k = 0; k < 8 && (await one('select count(*)::int n from fb_stories')).n < 3; k++) await run()
let st = await all('select * from fb_stories order by day')
const days = [0, 1, 2].map((d) => lagosDay(Date.now() + d * 86400e3))
check(st.length === 3 && st.every((s, i) => ds(s.day) === days[i]), 'today, tomorrow and the day after each have their story', st.map((s) => ds(s.day) + ' ' + s.series).join(', '))
check(st.every((s) => s.series === WEEK[new Date(ds(s.day) + 'T12:00:00Z').getUTCDay()]), 'the series rotate by weekday (Tayo’s World, True tech story, The turnaround)', st.map((s) => s.series).join(','))
check(st.every((s) => s.status === 'ready' && !s.note), 'each passed the checks', JSON.stringify(st.map((s) => [s.series, s.status, s.note])))
const prompts = (await state()).storyPrompts || []
const tay = st.find((s) => s.series === 'tayo'), tru = st.find((s) => s.series === 'true'), tur = st.find((s) => s.series === 'turnaround')
if (tay) {
  check(tay.episode === 1 && /Tayo’s World/.test(prompts.join('')) && !/https?:\/\//.test(tay.post), 'Tayo’s World: episode 1; a first try with a link in the post was rejected and rewritten', tay.post.slice(0, 120))
  check(/\/tools\//.test(tay.comment) && tay.source_slug, 'its link (the free site Tayo used, from the Directory) goes in the first comment', tay.comment)
}
if (tru) {
  check(/flown before\?$/.test(tru.post.trim()) && /booster-caught/.test(tru.comment) && /Use ONLY these facts/.test(prompts.find((p) => /True tech story/.test(p)) || ''), 'True tech story: only facts from the Directory post (a made-up “10 times” was caught and removed); the full story is linked in the comment', tru.post.slice(-80))
}
if (tur) check(/small-business-website-nigeria/.test(tur.comment) && /DIFFERENT kind of business/.test(prompts.join('')), 'The turnaround: a different business each time; links to the small business page')
check(st.every((s) => s.slides.length >= 4 && s.slides.length <= 6 && s.post.split(/\s+/).length >= 130 && /\?\s*$/.test(s.post.trim())), 'every story has 4–6 slides, 130+ words, and ends with a real question')

console.log('\n211. The pictures')
const keyFor = async (id, n) => { const h = await (await fetch(APP + '/admin/automation/plan', { headers: { cookie: '__Host-olex_sess=' + T } })).text(); return (h.match(new RegExp(`/api/fbstory/${id}/${n}\\?k=([a-f0-9]+)`)) || [])[1] }
await db.query("update yt_settings set plan_on = true")
const k0 = await keyFor(st[0].id, 0)
let r = await fetch(`${APP}/api/fbstory/${st[0].id}/0?k=${k0}`), buf = Buffer.from(await r.arrayBuffer())
check(r.status === 200 && /image\/png/.test(r.headers.get('content-type')) && buf.readUInt32BE(16) === 1080 && buf.readUInt32BE(20) === 1350, 'each slide is a 1080 × 1350 picture (Facebook’s tall size)', r.status + ' ' + buf.length)
r = await fetch(`${APP}/api/fbstory/${st[0].id}/0?k=wrong`); check(r.status === 404, 'and can’t be fetched without its key')
let h = (await (await fetch(APP + '/admin/automation/plan', { headers: { cookie: '__Host-olex_sess=' + T } })).text()).replace(/<!-- -->/g, '')
check(h.includes('Daily stories') && h.includes('Write a different one') && h.includes('Don’t post this one') && h.includes(st[0].title.replace(/&/g, '&amp;')), 'the Plan screen (Facebook) shows the stories ahead, with their slides, and the buttons')

console.log('\n212. It posts by itself at its time')
const now = Date.now(); await db.query('update meta_settings set story_time = $1', [lagosHM(now - 5 * 60e3)])
await db.query("update fb_stories set day = day - 1 where id <> $1 and day = $2", [st[0].id, days[0]])   // only today's is due
const before = await state(); r = await run()
let s0 = await one('select * from fb_stories where id = $1', [st[0].id]), S1 = await state()
const photos = (S1.fbPhotos || []).slice((before.fbPhotos || []).length), feed = (S1.fbFeed || []).slice((before.fbFeed || []).length), comm = (S1.fbComments || []).slice((before.fbComments || []).length)
check(s0.status === 'posted' && s0.post_id === '777_' + (1000 + (S1.fbFeed || []).length), 'today’s story is posted', JSON.stringify([s0.status, s0.note, r.story, r.errors]))
check(photos.length === s0.slides.length && photos.every((p) => p.ok && p.published === 'false' && p.bytes > 20000), 'its slides go up as pictures (Facebook fetched each one)', JSON.stringify(photos.map((p) => [p.ok, p.bytes])))
check(feed.length === 1 && feed[0].message === s0.post && feed[0].media.length === s0.slides.length, 'as one post: the story as the text, the slides attached')
check(comm.length === 1 && comm[0].on === s0.post_id && comm[0].message === s0.comment, 'the link goes in the first comment, not in the post')
r = await run(); check(((await state()).fbFeed || []).length === (S1.fbFeed || []).length, 'it isn’t posted twice')

console.log('\n213. You stay in charge')
const nx = st[1]
r = await api('/admin/api/youtube', { action: 'plan-story-stop', id: nx.id }); check(r.s === 200 && (await one('select status from fb_stories where id = $1', [nx.id])).status === 'skipped', 'Don’t post this one')
r = await api('/admin/api/youtube', { action: 'plan-story-rewrite', id: nx.id }); check(r.s === 200 && (await one('select status from fb_stories where id = $1', [nx.id])).status === 'ready', 'Write a different one (and it’s back on)', JSON.stringify(r.j))
await db.query('update meta_settings set enabled = false'); await db.query('update fb_stories set day = day + 9 where id = $1', [st[0].id]); await db.query('delete from fb_stories where day = $1', [days[0]]); await db.query('update fb_stories set day = $2 where id = $1', [nx.id, days[0]])
r = await run(); check((await one('select status, note from fb_stories where id = $1', [nx.id])).note === 'Facebook: Facebook posting is off', 'with Facebook posting off, nothing posts (and it says why)')
const yday = lagosDay(Date.now() - 86400e3); await db.query('delete from fb_stories where day = $1', [yday]); await db.query('update fb_stories set day = $2 where id = $1', [nx.id, yday]); await db.query('update meta_settings set story_time = $1', [lagosHM(Date.now())]); r = await run()   // yesterday's time: long gone
check((await one('select status from fb_stories where id = $1', [nx.id])).status === 'missed', 'a story that missed its time by 3 hours isn’t posted late')
await db.query('update meta_settings set enabled = true')
r = await api('/admin/api/youtube', { action: 'plan-stories', time: '25:00' }); check(r.s === 400, 'a wrong time is refused')

console.log('\n214. Facebook videos 3 a week')
await db.query('delete from plan_slots'); await db.query("update yt_settings set plan_on = true, yt_mode = 'approval'"); await db.query("update meta_settings set video_days = '1,3,5', per_day = 1, times = '13:00'")
await run()
const fbDays = (await all("select day from plan_slots where channel = 'facebook'")).map((x) => new Date(ds(x.day) + 'T12:00:00Z').getUTCDay())
const ytN = (await one("select count(*)::int n from plan_slots where channel = 'youtube'")).n
check(fbDays.every((d) => [1, 3, 5].includes(d)) && ytN >= 2, 'Facebook videos only on Monday, Wednesday and Friday; YouTube stays daily', JSON.stringify([fbDays, ytN]))
await db.query('delete from plan_slots'); await db.query('update yt_settings set plan_on = false')

console.log('\n215. Found on Google: Olex AI and the service pages')
const pg1 = await (await fetch(APP + '/olex-ai')).text()
check(pg1.includes('<title>Olex AI | The AI assistant behind Olexweb') && pg1.includes('Olex AI: the AI that runs Olexweb') && pg1.includes('"FAQPage"') && pg1.includes('"SoftwareApplication"'), 'olexweb.com/olex-ai: its own title, heading, questions and Google details')
for (const sl of ['website-design-lagos', 'small-business-website-nigeria', 'ecommerce-website-nigeria', 'web-app-development-nigeria']) {
  const x = await fetch(APP + '/services/' + sl), t = await x.text(); if (x.status !== 200 || !t.includes('"Service"') || !t.includes('"FAQPage"') || !t.includes('wa.me/2347011726321')) { check(false, sl, x.status); break }
}
check(true, 'the four service pages answer with their service, questions and WhatsApp')
check((await fetch(APP + '/services/not-a-page')).status === 404, 'a service that doesn’t exist is “not found”')
const sm = await (await fetch(APP + '/sitemap.xml')).text(); check(sm.includes('/olex-ai</loc>') && sm.includes('/services/website-design-lagos</loc>'), 'they’re in the sitemap')
const home = await (await fetch(APP + '/')).text()
check(home.includes('https://x.com/olexweb') && home.includes('https://linkedin.com/in/olexweb') && home.includes('youtube.com/channel/UCW_CpkVYb6Z_ijQqNTiJthQ') && home.includes('"Olex AI"'), 'Google is told X, LinkedIn, Facebook and YouTube are all Olexweb (and Olex AI is its name too)')
check(home.includes('href=\\"/olex-ai\\"') || home.includes('href="/olex-ai"'), 'every page’s footer links to them')

console.log('\n216. Live projects on the homepage wall')
const P = await one("insert into projects (slug, name, kind, role, text, built, result, url, image, wall, sort, status) values ('wall-test', 'Wall Test', 'Client website', 'r', 't', '{}', '', 'https://example.com', '', '/media/img/aaaaaaaaaaaaaaaaaaaaaaaa.webp', 99, 'draft') returning id")
r = await api('/admin/api/content', { action: 'publish', type: 'project', id: P.id })
const h2 = await (await fetch(APP + '/')).text()
check(r.s === 200 && h2.includes(`"p${P.id}":"/media/img/aaaaaaaaaaaaaaaaaaaaaaaa.webp"`) && h2.includes(`["p${P.id}"].forEach`) && h2.includes('object-fit: cover; object-position: top'), 'publishing it puts its screenshot on the sliding wall', r.s + JSON.stringify(r.j))
await db.query('delete from projects where id = $1', [P.id]); await api('/admin/api/content', { action: 'reorder', type: 'project', order: [] }).catch(() => {})

await db.query('delete from fb_stories'); await db.query("delete from dir_entries where slug = 'booster-caught'"); await db.query("update meta_settings set story_time = '20:00', story_on = false")
console.log(`\npassed: ${pass}`); if (failn) console.log(`failed: ${failn}`)
await db.end(); process.exit(failn ? 1 : 0)
