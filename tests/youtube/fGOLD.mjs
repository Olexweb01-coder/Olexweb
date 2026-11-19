// Install 27: the Directory goldmine. Big tech moments (space, sport tech, records) and tech history become Tech stories,
// every post has a topic readers can filter by, and it can post up to 12 a day.
import pg from 'pg'
import { createHash, randomBytes } from 'node:crypto'
const APP = 'http://localhost:3000', G = 'http://localhost:4555'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0; const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + String(extra).slice(0, 400) : '')) } }
const u = (await db.query("select id from admin_users where email = 'owner@test.local'")).rows[0], T = randomBytes(32).toString('base64url')
await db.query("insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '1 day')", [createHash('sha256').update(T).digest('hex'), u.id])
const post = async (path, b) => { const r = await fetch(APP + path, { method: 'POST', headers: { cookie: '__Host-olex_sess=' + T, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const page = async (p) => { const r = await fetch(APP + p); return { s: r.status, h: (await r.text()).replace(/<!-- -->/g, '').replace(/&amp;/g, '&').replace(/&#x27;/g, "'") } }
const run = async () => (await (await fetch(APP + '/api/assistant/cron?run=due', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } })).json())
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0]
const state = async () => (await fetch(G + '/_state')).json()

await db.query("update yt_settings set plan_on = false, yt_mode = 'approval'"); await db.query("update yt_idea_runs set last_run = now(), running_until = null")
await db.query("update yt_scripts set status = 'uploaded' where status in ('approved', 'draft', 'needs_review', 'rendering')")
await db.query("delete from dir_entries where kind <> 'tool'"); await db.query('delete from dir_finds')
await db.query("update dir_settings set auto_publish = true, per_day = 8, slots = '07:00,08:30,10:00,11:30,13:00,14:30,16:00,17:30,19:00,20:30,21:30,22:30', kinds = 'tool,story,update,guide,alert', gathered_at = null")

console.log('\n190. Big tech moments and tech history are found')
let j = null; for (let k = 0; k < 6 && !(j && j.directory && j.directory.gathered); k++) j = await run()
const g = j.directory && j.directory.gathered
const booster = await one("select kind, topic, status, score from dir_finds where url like '%/news/booster'"), email = await one("select kind, topic, status, title from dir_finds where url like '%/news/email1971'"), king = await one("select status from dir_finds where url like '%/news/king'")
check(booster && booster.kind === 'story' && booster.topic === 'space' && booster.status === 'new', 'the SpaceX booster landing is picked as a Tech story about Space', JSON.stringify([booster, g]))
check(email && email.kind === 'story' && email.topic === 'history' && /^On this day in 1971:/.test(email.title), 'On this day: the first email (1971) is picked as tech History', JSON.stringify(email))
check(king && king.status === 'skipped', 'a non-tech event from the same day is left out')
check((await one("select topic from dir_finds where url like '%/news/drafts'")).topic === 'apps' && (await one("select topic from dir_finds where url like '%/news/scam'")).topic === 'security', 'every find gets a topic (the WhatsApp change: Apps & internet; the scam: Security)')

console.log('\n191. Written as stories')
for (let k = 0; k < 12 && (await one("select count(*)::int n from dir_entries where kind = 'story'")).n < 2; k++) await run()
const st = (await db.query("select slug, name, topic, status, content from dir_entries where kind = 'story' order by id")).rows
check(st.length === 2 && st.every((e) => e.status === 'ready') && st.some((e) => e.topic === 'space') && st.some((e) => e.topic === 'history'), 'both are written, checked and ready to go live', JSON.stringify(st.map((e) => [e.name, e.topic, e.status])))
const held = (await db.query("update dir_entries set status = 'draft' where kind <> 'story' and status = 'ready' returning id")).rows.map((x) => x.id)   // held back so the stories go first
for (let k = 0; k < 2; k++) await post('/admin/api/directory', { action: 'publish-now' })   // goes live the normal way (pages and feed refreshed)
let p = await page('/stories')
check(p.s === 200 && st.every((e) => p.h.includes(e.name)) && p.h.includes('Tech stories and history'), 'olexweb.com/stories lists them')
const sp = st.find((e) => e.topic === 'space')
p = await page('/stories/' + sp.slug)
check(p.s === 200 && p.h.includes(sp.name) && p.h.includes('Tech story') && p.h.includes('What happened') && p.h.includes('"NewsArticle"'), 'each has its own page: Tech story, What happened, and Google’s news details', p.s)
p = await page('/stories/' + sp.slug + '/opengraph-image'); check(p.s === 200, 'with its own share picture')

console.log('\n192. Readers filter by topic')
await db.query("update dir_entries set status = 'live', published_at = now() where kind <> 'tool' and (status = 'ready' or id = any($1))", [held])
p = await page('/tools')
check(p.h.includes('aria-label="Topics"') && ['All', 'Space', 'History', 'Security'].every((t) => p.h.includes('>' + t + '</button>')) && p.h.includes('Tech stories'), 'the Directory has topic filters (All, Space, History, Security…) and a Tech stories tab')
check(!p.h.includes('>Gaming</button>'), 'a topic with nothing in it yet isn’t shown')
check(p.h.includes('>Space<') && p.h.includes('>History<') && !p.h.includes('SpaceNews') && !p.h.includes('On this day</span>'), 'each card says its topic (Install 32: never its source)')

console.log('\n193. More a day, everywhere it should be')
let r = await post('/admin/api/directory', { action: 'simple-settings', perDay: 12, autoPublish: true }); check(r.s === 200 && (await one('select per_day from dir_settings')).per_day === 12, 'up to 12 posts a day')
r = await post('/admin/api/directory', { action: 'simple-settings', perDay: 40 }); check((await one('select per_day from dir_settings')).per_day === 12, 'never more than 12')
const sm = (await page('/sitemap.xml')).h
check(sm.includes('/stories</loc>') && st.every((e) => sm.includes('/stories/' + e.slug)), 'the sitemap has /stories and each story')
const adm = (await (await fetch(APP + '/admin/directory', { headers: { cookie: '__Host-olex_sess=' + T } })).text()).replace(/<!-- -->/g, '').replace(/&amp;/g, '&')
check(adm.includes('Tech stories & history') && adm.includes('12</b>a day'), 'the Directory screen has the Tech stories switch and 12 a day')
await db.query('update dir_settings set gathered_at = null'); const otd = (await state()).otd; await run()
check((await state()).otd === otd, 'On this day is read once a day, not on every run')

if (!process.env.KEEP) { await db.query("delete from dir_entries where kind <> 'tool'"); await db.query('delete from dir_finds') }
console.log(`\npassed: ${pass}`); if (failn) console.log(`failed: ${failn}`)
await db.end(); process.exit(failn ? 1 : 0)
