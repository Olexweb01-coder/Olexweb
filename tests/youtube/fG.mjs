import pg from 'pg'
import fs from 'node:fs'
import { createHash, randomBytes } from 'node:crypto'
const APP = 'http://localhost:3000', G = 'http://localhost:4555'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0
const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + extra : '')) } }
const u = (await db.query("select id from admin_users where email='owner@test.local'")).rows[0]
const T = randomBytes(32).toString('base64url'); await db.query("insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '1 day')", [createHash('sha256').update(T).digest('hex'), u.id]); fs.writeFileSync('/tmp/ftok', T)
const post = (body) => fetch(APP + '/admin/api/youtube', { method: 'POST', headers: { cookie: '__Host-olex_sess=' + T, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
await db.query("update yt_scripts set status = 'failed' where status in ('rendering', 'rendered', 'approved')"); await db.query("delete from yt_scripts where kind = 'long'"); await db.query('delete from yt_long_items')
const day = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(Date.now() + 3600e3).getUTCDay()]
await db.query('update yt_idea_runs set last_run = now() where id = 1'); await db.query("update yt_ideas set status = 'skipped' where status = 'picked'")
await db.query("update yt_settings set long_volume = 1, long_count = 4, long_days = $1, series = 'Secret websites you should know'", [day])
for (const n of ['paletteforge', 'gradientlab', 'fontpair', 'tldraw', 'squoosh'])
  await db.query("insert into yt_ideas (key, name, url, source, status, decided_at) values ($1, $2, $3, 'Show HN', 'made', now()) on conflict (key) do update set status = 'made', url = $3, decided_at = now()", [n + '.test', n === 'tldraw' ? 'tldraw' : n[0].toUpperCase() + n.slice(1), `http://${n}.test:4555/site/${n}`])
console.log('\n43. The long video, twice a week')
let r = await fetch(APP + '/api/assistant/cron?run=due', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } }), j = await r.json()
let row = (await db.query("select * from yt_scripts where kind = 'long' order by id desc limit 1")).rows[0]
check(j.long && row, 'on a long-video day, the frequent run wrote one by itself (from finds that already went out as Shorts)', JSON.stringify(j).slice(0, 160))
const ch = row.script.chapters.filter((c) => c.site)
check(ch.length === 4 && row.script.scenes[0].seg === -1 && row.script.scenes.at(-1).type === 'cta', `${ch.length} chapters, an intro and an outro: ${ch.map((c) => c.title).join(' · ')}`)
check(row.package.title === '4 Secret Websites You Should Know (Vol. 1)', 'titled “' + row.package.title + '”')
check(row.checks.every((c) => c.ok) && row.status === 'draft', 'every chapter’s claims backed by its own site; waiting for your review (Approval mode): ' + row.checks.map((c) => c.note).join(' · '))
check(row.seconds >= 180, `about ${Math.round(row.seconds / 60 * 10) / 10} minutes long`)
check((await db.query('select count(*)::int n from yt_long_items where script_id = $1', [row.id])).rows[0].n === 4 && (await db.query('select long_volume from yt_settings')).rows[0].long_volume === 2, 'its sites are remembered (never repeated), and the next one will be Vol. 2')
r = await fetch(APP + '/api/assistant/cron?run=due', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } }); j = await r.json()
check(!j.long, 'not a second one the same day')
r = await post({ action: 'write-long' }); j = await r.json()
check(r.status === 400 && /at least 4/.test(j.error || ''), 'Write long video now, with too few new finds: a clear message: “' + (j.error || '').slice(0, 80) + '…”')
let html = (await (await fetch(APP + '/admin/youtube?view=scripts', { headers: { cookie: '__Host-olex_sess=' + T } })).text()).replace(/<!-- -->/g, '')
check(html.includes('Long video · Vol. 1') && html.includes('Chapter 1:') && html.includes('Write long video now'), 'the Scripts tab shows it with its chapters, plus the long-video settings')
r = await post({ action: 'approve-script', id: row.id }); r = await post({ action: 'send-to-factory', id: row.id }); j = await r.json()
row = (await db.query('select status, part from yt_scripts where id = $1', [row.id])).rows[0]
const d = ((await (await fetch(G + '/_state')).json()).dispatches || []).at(-1)
check(r.status === 200 && row.status === 'rendering' && row.part === null && d.body.inputs.id === String(j.id), 'sent to the factory (a volume number, no part number)')
fs.writeFileSync('/tmp/fid', String(j.id))
console.log(`  (${pass} passed, ${failn} failed)`)
await db.end(); process.exit(failn ? 1 : 0)
