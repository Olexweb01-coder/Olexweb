// After the uploads: the day's Reel goes to the Page with its guide link; one a day; storage freed; pauses itself on a block
import pg from 'pg'
import { createHash, randomBytes } from 'node:crypto'
const APP = 'http://localhost:3000', G = 'http://localhost:4555'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0; const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + String(extra).slice(0, 240) : '')) } }
const u = (await db.query("select id from admin_users where email='owner@test.local'")).rows[0], T = randomBytes(32).toString('base64url')
await db.query("insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '1 day')", [createHash('sha256').update(T).digest('hex'), u.id])
const run = async () => (await (await fetch(APP + '/api/assistant/cron?run=due', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } })).json())
const fb = async () => (await (await fetch(G + '/_fb')).json())
const hm = (ms) => new Date(ms + 3600e3).toISOString().slice(11, 16)        // Lagos clock
await db.query('update meta_settings set per_day = 1, times = $1', [hm(Date.now() - 5 * 60e3)])   // a Reel time that has just come
console.log('\n74. Each Short also posts as a Facebook Reel')
const marked = (await db.query("select count(*)::int n from yt_scripts where status = 'uploaded' and fb->>'status' in ('pending', 'posted')")).rows[0].n
const neverTried = (await db.query("select count(*)::int n from yt_scripts where status = 'uploaded' and fb->>'status' = 'failed'")).rows[0].n
check(marked >= 1 && neverTried === 0, 'Shorts uploaded with Facebook on wait for it (kept); Shorts from before are never attempted (' + marked + ' waiting or posted)')
let j = await run(), f = await fb()
const log = (await db.query('select script_id, video_id from meta_posts')).rows
check(f.posts.length === 1 && f.posts[0].state === 'PUBLISHED' && log.length === 1 && log[0].video_id === f.posts[0].video_id, 'one Short went to your Page as a Reel during the regular runs, and it’s in the Reel log', JSON.stringify({ posts: f.posts.length, log }))
const vid = (await db.query('select video from yt_scripts where id = $1', [log[0] && log[0].script_id])).rows[0], up = f.uploads[0]
check(up && up.bytes > 0 && up.bytes === up.said && vid && up.bytes === Number(vid.video.bytes), 'Facebook receives the whole video, byte for byte (' + (up && up.bytes) + ' bytes)')
check(/Full guide \(free\): https:\/\/olexweb\.com\/tools\//.test(f.posts[0].description), 'the Reel’s caption carries the free guide link', f.posts[0].description.slice(0, 160))

j = await run(); f = await fb(); check(f.posts.length === 1, 'one Reel per posting time: the next run posts nothing more')
const hf = (await (await fetch(APP + '/admin/automation/facebook', { headers: { cookie: '__Host-olex_sess=' + T } })).text()).replace(/<!-- -->/g, '')
const h = (await (await fetch(APP + '/admin/youtube?view=videos', { headers: { cookie: '__Host-olex_sess=' + T } })).text()).replace(/<!-- -->/g, '')
const anyPosted = (await db.query("select count(*)::int n from yt_scripts where fb->>'status' = 'posted'")).rows[0].n, anyWaiting = (await db.query("select count(*)::int n from yt_scripts where fb->>'status' = 'pending'")).rows[0].n
check(hf.includes('Facebook Reels') && hf.includes('Olexweb') && hf.includes('Posting on') && hf.includes('Up next on Facebook') && h.includes('Automation → Facebook') && (!anyPosted || h.includes('Also on Facebook')) && (!anyWaiting || h.includes('Facebook: waiting')), 'the Facebook tab shows the Page and posting switch; Videos cards say “Also on Facebook ↗” or “Facebook: waiting”')
console.log('\n75. Safety: a block pauses posting by itself')
await db.query("update meta_posts set slot = slot || '-earlier', at = at - interval '2 hours'"); await fetch(G + '/_set?fbBlock=1')   // the next Reel time has come
const stillKept = (await db.query("select count(*)::int n from yt_scripts where kind is distinct from 'long' and video is not null and (status = 'rendered' or fb->>'status' in ('pending', 'failed'))")).rows[0].n
if (stillKept) { j = await run(); const st = (await db.query('select paused_reason from meta_settings')).rows[0]
  check(st.paused_reason && /block or restriction/.test(st.paused_reason) && j.facebook && j.facebook.paused, 'Meta reports a block: posting pauses itself, with the reason', JSON.stringify(j.facebook).slice(0, 160))
  j = await run(); check(!j.facebook, 'while paused, nothing more is tried')
  const h2 = (await (await fetch(APP + '/admin/automation/facebook', { headers: { cookie: '__Host-olex_sess=' + T } })).text()).replace(/<!-- -->/g, ''); check(h2.includes('Posting is paused') && h2.includes('Resume'), 'the Facebook tab says “Posting is paused” with the reason and Resume') }
else check(true, '(no second Short in this run to test the block on)')
await fetch(G + '/_set?fbBlock=0')
let r = await fetch(APP + '/admin/api/meta', { method: 'POST', headers: { cookie: '__Host-olex_sess=' + T, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'resume' }) }); check(r.status === 200 && !(await db.query('select paused_reason from meta_settings')).rows[0].paused_reason, 'Resume clears the pause')
r = await fetch(APP + '/admin/api/meta', { method: 'POST', headers: { cookie: '__Host-olex_sess=' + T, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'disconnect' }) }); check(r.status === 400, 'Disconnect needs the typed word')
r = await fetch(APP + '/admin/api/meta', { method: 'POST', headers: { cookie: '__Host-olex_sess=' + T, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'disconnect', confirm: 'DISCONNECT' }) })
check(r.status === 200 && (await db.query('select count(*)::int n from meta_pages')).rows[0].n === 0 && !(await db.query('select enabled from meta_settings')).rows[0].enabled, 'Disconnect deletes the Page’s key and switches posting off')
const pv = await (await fetch(APP + '/privacy')).text(); check(pv.includes('id="facebook"') && pv.includes('Olexweb Publisher') && pv.includes('facebook-deletion'), 'the privacy page explains the Facebook data and how to delete it')
console.log(`  (${pass} passed, ${failn} failed)`); await db.end(); process.exit(failn ? 1 : 0)
