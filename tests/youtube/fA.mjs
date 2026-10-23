import pg from 'pg'
import { createHash, randomBytes } from 'node:crypto'
const APP = 'http://localhost:3000', G = 'http://localhost:4555'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0
const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + extra : '')) } }
const u = (await db.query("select id from admin_users where email='owner@test.local'")).rows[0]
const T = randomBytes(32).toString('base64url'); await db.query("insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '1 day')", [createHash('sha256').update(T).digest('hex'), u.id])
await db.query("update yt_scripts set status = 'approved' where status = 'rendering'"); await db.query('delete from yt_jobs where kind = $1', ['render'])
const idea = (await db.query("insert into yt_ideas (key, name, url, source, status, decided_at) values ('squoosh.app', 'Squoosh', 'https://squoosh.app/', 'Olex AI', 'picked', now()) on conflict (key) do update set status = 'picked', url = 'https://squoosh.app/' returning id")).rows[0].id
await db.query('delete from yt_scripts where idea_id = $1', [idea])
const scenes = [
  { id: 's1', type: 'hook', pose: 'shocked', text: 'This free tool shrinks images in seconds.', big: 'SHRINK ANY IMAGE' },
  { id: 's2', type: 'demo', pose: 'pointing', text: 'Drop a photo straight in.', capture: 'homepage' },
  { id: 's3', type: 'demo', pose: 'pointing', text: 'Pick a format and quality.', capture: 'options' },
  { id: 's4', type: 'infographic', pose: 'thinking', text: 'Free and open source.', chips: ['Free', 'Open source'] },
  { id: 's5', type: 'url', pose: 'pointing', text: 'Find it here.', big: 'squoosh.app' },
  { id: 's6', type: 'cta', pose: 'waving', text: 'Follow for more.' }]
const s = (await db.query(`insert into yt_scripts (idea_id, status, script, package, claims, checks, seconds, page, approved_at) values ($1, 'approved', $2, $3, '[]', '[]', 10, 'test', now()) returning id`,
  [idea, JSON.stringify({ site: { name: 'Squoosh', url: 'https://squoosh.app/' }, voice: 'am_michael', scenes }), JSON.stringify({ title: 'This free tool shrinks images', titles: ['This free tool shrinks images'], description: 'Test', hashtags: ['#shorts'] })])).rows[0].id
const part0 = (await db.query('select next_part from yt_settings where id = 1')).rows[0].next_part
console.log('\n31. Sending to the factory')
const post = (body) => fetch(APP + '/admin/api/youtube', { method: 'POST', headers: { cookie: '__Host-olex_sess=' + T, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
let r = await post({ action: 'send-to-factory', id: s }), j = await r.json()
const st = await (await fetch(G + '/_state')).json(), d = (st.dispatches || []).slice(-1)[0]
check(r.status === 200 && j.part === part0, `sent as part ${j.part}`, JSON.stringify(j))
check(d && d.auth === 'Bearer github_pat_test' && d.body.ref === 'main' && d.body.inputs.id === String(s) && d.body.inputs.api === 'http://localhost:3000', 'GitHub was asked to start the render workflow with only the script number and the admin’s address (nothing secret)', JSON.stringify(d))
const row = (await db.query('select status, part from yt_scripts where id = $1', [s])).rows[0], ns = (await db.query('select next_part from yt_settings')).rows[0].next_part
check(row.status === 'rendering' && row.part === part0 && ns === part0 + 1, 'marked as in the factory; the next video will be part ' + ns)
r = await post({ action: 'send-to-factory', id: s }); j = await r.json()
check(r.status === 400 && /busy|approved/.test(j.error), 'a second video can’t be sent while one is rendering: “' + j.error.slice(0, 80) + '…”')
const pr = await (await fetch(APP + '/admin/api/youtube?progress=render', { headers: { cookie: '__Host-olex_sess=' + T } })).json()
check(pr.progress && pr.progress.stage === 'queued' && pr.progress.note.includes('part ' + part0), 'the progress panel shows “Waiting for a GitHub machine”')
require_fs: {
  const fs = await import('node:fs'); fs.writeFileSync('/tmp/fid', String(s)); fs.writeFileSync('/tmp/ftok', T)
}
console.log(`  (${pass} passed, ${failn} failed)`)
await db.end(); process.exit(failn ? 1 : 0)
