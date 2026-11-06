// Install 11: one frequent run at a time; schedulers that hang up early (cron-job.org, 30 s) get an answer at once while the
// run carries on; the Today tab shows when it last ran and warns when the scheduler went quiet.
import pg from 'pg'
import { createHash, randomBytes } from 'node:crypto'
const APP = 'http://localhost:3000'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0; const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + String(extra).slice(0, 260) : '')) } }
const sess = async (e) => { const u = (await db.query('select id from admin_users where email = $1', [e])).rows[0], t = randomBytes(32).toString('base64url'); await db.query("insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '1 day')", [createHash('sha256').update(t).digest('hex'), u.id]); return t }
const T = await sess('owner@test.local')
const html = async (path) => (await (await fetch(APP + path, { headers: { cookie: '__Host-olex_sess=' + T }, redirect: 'manual' })).text()).replace(/<!-- -->/g, '')
const cron = (q, auth = 'Bearer ' + process.env.CRON_SECRET) => fetch(APP + '/api/assistant/cron?' + q, { headers: { authorization: auth } })
const lock = () => db.query("select until, started_at, finished_at, last_ok from run_locks where name = 'quick'").then((r) => r.rows[0])
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

console.log('\n107. One frequent run at a time')
let r = await cron('run=due'), j = await r.json(), l = await lock()
check(r.status === 200 && j.run === 'quick' && l && l.finished_at && new Date(l.until) <= new Date(Date.now() + 1000), 'a normal run reports as before, and frees the lock when it’s done', JSON.stringify(j).slice(0, 120))
await db.query("update run_locks set until = now() + interval '5 minutes' where name = 'quick'")
r = await cron('run=due'); j = await r.json()
check(r.status === 200 && j.skipped === 'already running', 'while a run is going, the next call skips instead of doubling up', JSON.stringify(j))
await db.query("update run_locks set until = now() - interval '1 minute' where name = 'quick'")
r = await cron('run=due'); j = await r.json()
check(j.run === 'quick' && !j.skipped, 'a run that was cut off frees the lock by itself (after 6 minutes)')
const both = await Promise.all([cron('run=due').then((x) => x.json()), cron('run=due').then((x) => x.json())])
check(both.filter((x) => x.skipped).length <= 1 && both.some((x) => x.run === 'quick' && !x.skipped), 'two calls at the same moment: at most one runs', JSON.stringify(both.map((x) => x.skipped || 'ran')))

console.log('\n108. Answer at once, keep working (for cron-job.org)')
const before = Date.now(), t0 = Date.now()
r = await cron('run=due&bg=1'); j = await r.json()
check(r.status === 202 && j.started === true && Date.now() - t0 < 3000, `answers in ${Date.now() - t0} ms, before the work is done`)
let done = false
for (let k = 0; k < 40 && !done; k++) { await sleep(500); l = await lock(); done = l.finished_at && new Date(l.finished_at).getTime() >= before - 1000 && new Date(l.until).getTime() <= Date.now() + 1000 }
check(done, 'and the run still finishes in the background')
r = await cron('run=due&bg=1', 'Bearer wrong'); check(r.status === 401, 'a wrong secret is still refused')

console.log('\n109. The Today tab shows the last run')
let h = await html('/admin/automation')
check(/Last automatic run: (just now|\d+ min ago)/.test(h), 'Today: “Last automatic run: just now”')
await db.query("update run_locks set finished_at = now() - interval '3 hours' where name = 'quick'")
h = await html('/admin/automation')
check(h.includes('Automation hasn’t run for 3 hours') && h.includes('Something needs you'), 'quiet for 3 hours: Needs you says to check the scheduler')
await db.query("update run_locks set finished_at = now() where name = 'quick'")

console.log(`  (${pass} passed, ${failn} failed)`)
await db.end(); process.exit(failn ? 1 : 0)
