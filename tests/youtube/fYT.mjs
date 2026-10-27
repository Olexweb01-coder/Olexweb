// YouTube's own Approval/Autopilot switch; guide links in Short descriptions; the older-Shorts helper
import pg from 'pg'
import { createHash, randomBytes } from 'node:crypto'
const APP = 'http://localhost:3000', G = 'http://localhost:4555'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0; const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + String(extra).slice(0, 220) : '')) } }
const u = (await db.query("select id from admin_users where email='owner@test.local'")).rows[0], T = randomBytes(32).toString('base64url')
await db.query("insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '1 day')", [createHash('sha256').update(T).digest('hex'), u.id])
const post = (path, b) => fetch(APP + path, { method: 'POST', headers: { cookie: '__Host-olex_sess=' + T, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
const modes = async () => (await db.query('select (select mode from assistant_settings where id = 1) as blog, (select yt_mode from yt_settings where id = 1) as yt')).rows[0]
console.log('\n70. YouTube has its own Approval/Autopilot switch')
await db.query("update assistant_settings set mode = 'approval'; update yt_settings set yt_mode = 'approval'")
await post('/admin/api/youtube', { action: 'yt-mode', mode: 'autopilot' }); let m = await modes()
check(m.yt === 'autopilot' && m.blog === 'approval', 'YouTube on Autopilot leaves the blog waiting for approval', JSON.stringify(m))
await post('/admin/api/assistant', { action: 'settings', mode: 'autopilot', pace: 5, hours: 24, topics: ['AI tools'], socials: [] }); await post('/admin/api/youtube', { action: 'yt-mode', mode: 'approval' }); m = await modes()
check(m.blog === 'autopilot' && m.yt === 'approval', 'the blog on Autopilot leaves YouTube scripts waiting for you', JSON.stringify(m))
const h = (await (await fetch(APP + '/admin/youtube?view=scripts', { headers: { cookie: '__Host-olex_sess=' + T } })).text()).replace(/<!-- -->/g, '')
check(h.includes('YouTube automation') && h.includes('Approve each script') && h.includes('Separate from the blog'), 'the Scripts tab shows “YouTube automation: Approve each script / Autopilot”')
console.log('\n71. Every Short’s description starts with its free guide')
const metas = (await (await fetch(G + '/_metas')).json()).metas.filter((x) => x && x.snippet)
const withGuide = metas.filter((x) => /^Full guide \(free\): https:\/\/olexweb\.com\/tools\/guide-\d+/.test(x.snippet.description))
check(metas.length > 0 && withGuide.length === metas.length, `the first line of each uploaded description is “Full guide (free): olexweb.com/tools/…” (${withGuide.length} of ${metas.length})`, metas.map((m) => m.snippet.title.slice(0, 30) + ' | ' + m.snippet.description.slice(0, 50)).join(' || '))
console.log('\n72. Older Shorts: a one-tap helper')
const ad = (await (await fetch(APP + '/admin/directory', { headers: { cookie: '__Host-olex_sess=' + T } })).text()).replace(/<!-- -->/g, '')
const need = (await db.query("select count(*)::int n from dir_entries d join yt_scripts s on s.idea_id = d.idea_id and s.status = 'uploaded' and s.yt_video_id is not null where d.status = 'live' and d.yt_linked_at is null")).rows[0].n
check(need === 0 || (ad.includes('Add guide links to older Shorts') && ad.includes('Copy line') && ad.includes('Open in Studio')), 'Admin → Directory lists uploaded Shorts whose guide is live, with Copy line and Open in Studio (' + need + ')')
const one = (await db.query("select d.id from dir_entries d join yt_scripts s on s.idea_id = d.idea_id and s.status = 'uploaded' where d.status = 'live' and d.yt_linked_at is null limit 1")).rows[0]
if (one) { const r = await post('/admin/api/directory', { action: 'linked', id: one.id }); check(r.status === 200 && (await db.query('select yt_linked_at from dir_entries where id = $1', [one.id])).rows[0].yt_linked_at, '“Done” removes it from the list') }
await db.query("update assistant_settings set mode = 'approval', pace = 2; delete from dir_entries where slug like 'guide-%'")
console.log(`  (${pass} passed, ${failn} failed)`); await db.end(); process.exit(failn ? 1 : 0)
