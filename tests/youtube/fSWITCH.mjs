// Install 31: every automation switch at the top of Automation → Today, plus the approve-all button when videos wait.
import pg from 'pg'
import { createHash, randomBytes } from 'node:crypto'
const APP = 'http://localhost:3000'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0; const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + String(extra).slice(0, 300) : '')) } }
const u = (await db.query("select id from admin_users where email = 'owner@test.local'")).rows[0], T = randomBytes(32).toString('base64url')
await db.query("insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '1 day')", [createHash('sha256').update(T).digest('hex'), u.id])
await db.query("insert into meta_pages (page_id,name,token_enc,selected) values ('p1','Olexweb Page','x',true) on conflict (page_id) do update set selected = true")
const sw = async (key, on, t = T) => { const r = await fetch(APP + '/admin/api/switches', { method: 'POST', headers: { cookie: '__Host-olex_sess=' + t, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify({ key, on }) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const html = async (p) => (await (await fetch(APP + p, { headers: { cookie: '__Host-olex_sess=' + T } })).text()).replace(/<!-- -->/g, '')
const one = async (s) => (await db.query(s)).rows[0]
console.log('\n230. All switches in one place')
await db.query("update meta_settings set enabled = false, paused_reason = 'Token expired.' where id = 1")
let h = await html('/admin/automation')
check(h.includes('Your switches') && ['Facebook posting', 'Daily Facebook story', 'Videos post without asking me', 'Directory posts by itself', 'Blog posts by itself'].every((n) => h.includes(n)), 'Automation → Today starts with every switch, named in plain words')
check(h.includes('Stopped after a problem: Token expired.'), 'a switch that stopped by itself says why')
let r = await sw('fb', true); check(r.s === 200 && (await one('select enabled, paused_reason from meta_settings where id = 1')).enabled === true && !(await one('select paused_reason from meta_settings where id = 1')).paused_reason && r.j.switches.find((x) => x.key === 'fb').on, 'Facebook posting turns on (and clears the old stop)')
r = await sw('fb', false); check(!(await one('select enabled from meta_settings where id = 1')).enabled, 'and off')
await sw('stories', true); check((await one('select story_on from meta_settings where id = 1')).story_on, 'Daily story on')
await sw('stories', false); check(!(await one('select story_on from meta_settings where id = 1')).story_on, 'Daily story off')
await sw('ytAuto', true); check((await one('select yt_mode from yt_settings where id = 1')).yt_mode === 'autopilot', 'Videos post by themselves')
await sw('ytAuto', false); check((await one('select yt_mode from yt_settings where id = 1')).yt_mode === 'approval', 'Videos wait for approval')
await sw('dirAuto', true); check((await one('select auto_publish from dir_settings where id = 1')).auto_publish, 'Directory posts by itself')
await sw('dirAuto', false); check(!(await one('select auto_publish from dir_settings where id = 1')).auto_publish, 'Directory waits')
const was = (await one('select mode from assistant_settings where id = 1')).mode
await sw('blogAuto', true); check((await one('select mode from assistant_settings where id = 1')).mode === 'autopilot', 'Blog posts by itself')
await sw('blogAuto', false); check((await one('select mode from assistant_settings where id = 1')).mode === 'approval', 'Blog waits')
await db.query('update assistant_settings set mode = $1 where id = 1', [was])
check((await sw('nope', true)).s === 400, 'an unknown switch is refused')
check((await sw('fb', true, 'bad')).s === 401, 'nobody signed out can flip a switch')
console.log('\n231. Approve all, right at the top')
await db.query("update yt_settings set plan_on = true where id = 1")
await db.query("delete from plan_slots where day = current_date + 1 and time = '23:58'")
const sc = (await db.query("insert into yt_scripts (status,script,package) values ($1,$2,$3) returning id", ['draft', '{}', JSON.stringify({ title: 'Switch test' })])).rows[0].id
await db.query("insert into plan_slots (channel,day,time,format,status,script_id) values ('youtube',current_date + 1,'23:58','tested','planned',$1)", [sc])
h = await html('/admin/automation')
check(/wait(s)? for your approval/.test(h) && h.includes('Approve all') && h.includes('href="/admin/automation/plan"'), 'waiting videos show at the top with Approve all and Look first')
check(!h.includes('What kind of videos?') && !h.includes('scripts waiting for approval') && !h.includes('YouTube is on Approval'), 'the old video-style picker and the repeated approval warnings are gone while the plan runs')
const ar = await fetch(APP + '/admin/api/youtube', { method: 'POST', headers: { cookie: '__Host-olex_sess=' + T, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'plan-approve-all' }) })
check(ar.status === 200 && (await one('select status from yt_scripts where id = ' + sc)).status === 'approved', 'Approve all approves them')
h = await html('/admin/automation'); check(!/wait(s)? for your approval/.test(h), 'and the box goes away')
await db.query("delete from plan_slots where day = current_date + 1 and time = '23:58'"); await db.query('delete from yt_scripts where id = ' + sc); await db.query("update yt_settings set plan_on = false where id = 1")
console.log(`\n${pass} passed, ${failn} failed`); await db.end(); process.exit(failn ? 1 : 0)
