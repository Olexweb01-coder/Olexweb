// YouTube → Progress: Needs you · In progress · Finished
import pg from 'pg'
import { createHash, randomBytes } from 'node:crypto'
const APP = 'http://localhost:3000'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0; const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + extra : '')) } }
const u = (await db.query("select id from admin_users where email='owner@test.local'")).rows[0], T = randomBytes(32).toString('base64url')
await db.query("insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '1 day')", [createHash('sha256').update(T).digest('hex'), u.id])
const page = async () => (await (await fetch(APP + '/admin/youtube?view=progress', { headers: { cookie: '__Host-olex_sess=' + T } })).text()).replace(/<!-- -->/g, '').replace(/\\"/g, '"')
console.log('\n55. Progress: everything not finished, in three sections')
const base = { script: { scenes: [] }, package: { title: 'x' } }, ids = []
for (const [n, st, err] of [['ProgFail', 'failed', 'The factory couldn’t download the voice model.'], ['ProgMake', 'rendering', null], ['ProgDone', 'rendered', null]]) {
  const i = (await db.query("insert into yt_ideas (key, name, url, source, status) values ($1, $1, 'https://p.test', 'Show HN', 'made') on conflict (key) do update set status='made' returning id", [n])).rows[0].id
  await db.query('delete from yt_scripts where idea_id = $1', [i])
  ids.push((await db.query('insert into yt_scripts (idea_id, status, script, package, render_error, part, video) values ($1, $2, $3, $4, $5, $6, $7) returning id', [i, st, base.script, base.package, err, 70 + ids.length, st === 'rendered' ? { bytes: 1, seconds: 20 } : null])).rows[0].id) }
await db.query(`insert into yt_jobs (kind, started_at, updated_at, state) values ('render', now(), now(), $1) on conflict (kind) do update set started_at = now(), updated_at = now(), state = $1, finished_at = null`,
  [JSON.stringify({ kind: 'render', started: Date.now(), stage: 'voice', done: 3, total: 10, finished: false, error: null, script: ids[1], eta: 240, note: 'ProgMake · part 71', stages: [{ key: 'job', label: 'Sent', secs: 2 }, { key: 'film', label: 'Filming the site', secs: 30 }, { key: 'voice', label: 'Voice', secs: null }, { key: 'render', label: 'Putting the video together', secs: null }] })])
const h = await page()
check(['Needs you', 'In progress', 'Finished'].every((t) => h.includes(t)), 'three sections: Needs you · In progress · Finished')
check(h.includes('ProgFail') && h.includes('The factory couldn’t download the voice model.') && h.includes('Try again'), 'Needs you: the stopped video, its reason in plain words, and Try again')
check(h.includes('"title":"Part 71 · ProgMake"') && h.includes('"stage":"voice"') && h.includes('"eta":'), 'In progress: the video in the factory, with its current step and time left')
check(h.includes('Part 72 · ProgDone') && h.includes('Video ready · in Videos'), 'Finished: the video made in the last day, with where to find it')
await db.query("update yt_jobs set updated_at = now() - interval '10 minutes' where kind = 'render'")
const h2 = await page(); check(h2.includes('The factory stopped reporting'), 'a factory job that went silent moves to Needs you, with Try again (never a spinner forever)')
await db.query('delete from yt_scripts where id = any($1)', [ids]); await db.query("delete from yt_jobs where kind = 'render'")
console.log(`  (${pass} passed, ${failn} failed)`); await db.end(); process.exit(failn ? 1 : 0)
