// Best-time research (niche + viewers' countries), live Private/Public status, and clean-up on Disconnect
import pg from 'pg'
import { createHash, randomBytes } from 'node:crypto'
const APP = 'http://localhost:3000', G = 'http://localhost:4555'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0; const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + extra : '')) } }
const sess = async (e) => { const u = (await db.query('select id from admin_users where email = $1', [e])).rows[0], t = randomBytes(32).toString('base64url'); await db.query("insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '1 day')", [createHash('sha256').update(t).digest('hex'), u.id]); return t }
const T = await sess('owner@test.local'), E = await sess('editor@test.local')
const post = (b, t = T) => fetch(APP + '/admin/api/youtube', { method: 'POST', headers: { cookie: '__Host-olex_sess=' + t, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
const page = async () => (await (await fetch(APP + '/admin/youtube?view=videos', { headers: { cookie: '__Host-olex_sess=' + T } })).text()).replace(/<!-- -->/g, '').replace(/\\u0026/g, '&')
console.log('\n52. Best posting time: researched from the niche and your viewers')
await db.query('delete from yt_time_research')
let r = await post({ action: 'research-times' }, E); check(r.status === 403, 'only you can run the research')
r = await post({ action: 'research-times' }); let j = await r.json()
const R = (await db.query('select * from yt_time_research')).rows[0]
check(r.status === 200 && j.videos >= 30 && R && R.countries.length === 3, 'research looked at the niche’s top Shorts (' + j.videos + ') and where your viewers are (Nigeria, US, UK)', JSON.stringify(j))
check(!JSON.stringify(R.hours).includes('nc') && !JSON.stringify(R.hours).includes('otherchan'), 'only a per-hour summary is kept: no other channel’s videos or names are stored (YouTube’s rules)')
r = await post({ action: 'research-times' }); check(r.status === 400, 'asking again within the hour is refused (protects your daily YouTube allowance)')
let h = await page()
check(h.includes('19:00') && h.includes('Top niche Shorts posted around this hour') && /views per day/.test(h), 'the top suggestion is 19:00 Lagos, where the niche’s Shorts grew fastest, with the reason')
check(/of your viewers are on their phones then \(Nigeria/.test(h), 'each suggestion says how many of your viewers are on their phones then, and where')
const firstPick = (h.replace(/\\"/g, '"').match(/"picks":\[\{"time":"(\d\d:\d\d)"/) || [])[1]; check(firstPick === '19:00', 'ranked first: 19:00', firstPick)
console.log('\n53. Posted to YouTube, and whether it’s Private or Public (asked of YouTube)')
const up = (await db.query("select id, yt_video_id from yt_scripts where status = 'uploaded' and yt_video_id is not null order by uploaded_at desc limit 1")).rows[0]
if (!up) check(false, 'an uploaded video to check'); else {
  await db.query('update yt_settings set status_checked_at = null'); h = await page()
  let u1 = (await db.query('select upload from yt_scripts where id = $1', [up.id])).rows[0].upload
  check(u1.privacy === 'private' && u1.checkedAt && h.includes('Posted to YouTube') && h.includes('Private'), 'opening Videos asks YouTube: “Posted to YouTube · (date, time) · Private”')
  await fetch(G + `/_privacy?id=${up.yt_video_id}&p=public`)
  r = await post({ action: 'check-status' }, E); check(r.status === 403, 'only you can run Check status')
  r = await post({ action: 'check-status' }); u1 = (await db.query('select upload from yt_scripts where id = $1', [up.id])).rows[0].upload; h = await page()
  check(r.status === 200 && u1.privacy === 'public' && h.includes('Public'), 'after you make it Public in Studio, Check status shows Public')
}
console.log('\n54. Disconnect removes the research too')
r = await post({ action: 'disconnect', confirm: 'DISCONNECT' }); const left = (await db.query('select count(*)::int n from yt_time_research')).rows[0].n
check(r.status === 200 && left === 0, 'after Disconnect, no YouTube research is left in the admin')
console.log(`  (${pass} passed, ${failn} failed)`); await db.end(); process.exit(failn ? 1 : 0)
