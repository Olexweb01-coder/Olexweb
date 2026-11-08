// Install 16: the Directory as a daily goldmine: tools, tech updates, how-tos and safety alerts, about 5 a day at set times,
// every fact quoted from its source and written in our own words; Google/Bing told, share pictures, feed, the day's best on
// Facebook; and the simple Directory screen.
import pg from 'pg'
import { createHash, randomBytes } from 'node:crypto'
const APP = 'http://localhost:3000', G = 'http://localhost:4555'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0; const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + String(extra).slice(0, 300) : '')) } }
const u = (await db.query("select id from admin_users where email = 'owner@test.local'")).rows[0], T = randomBytes(32).toString('base64url')
await db.query("insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '1 day')", [createHash('sha256').update(T).digest('hex'), u.id])
const page = async (path) => { const r = await fetch(APP + path, { headers: { cookie: '__Host-olex_sess=' + T } }); return { s: r.status, h: (await r.text()).replace(/<!-- -->/g, ''), type: r.headers.get('content-type') } }
const adm = async (b) => { const r = await fetch(APP + '/admin/api/directory', { method: 'POST', headers: { cookie: '__Host-olex_sess=' + T, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const run = async () => (await (await fetch(APP + '/api/assistant/cron?run=due', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } })).json())
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0]
const state = async () => (await fetch(G + '/_state')).json()
const hm = (ms) => new Date(ms + 3600e3).toISOString().slice(11, 16)

// quiet runs: no YouTube work in the way, so the Directory gets the idle time
await db.query("update yt_settings set yt_mode = 'approval'"); await db.query("update yt_ideas set status = 'passed' where status = 'picked'")
await db.query("update yt_scripts set status = 'uploaded' where status in ('approved', 'draft', 'needs_review', 'rendering')")
await db.query("delete from dir_entries where kind <> 'tool'"); await db.query('delete from dir_finds')
await db.query("update dir_settings set auto_publish = true, slots = '08:00,11:00,14:00,17:00,20:00', kinds = 'tool,update,guide,alert', fb_share = true, fb_last = null, gathered_at = null")

console.log('\n140. About 5 a day, at set times')
check((await one('select per_day from dir_settings')).per_day === 5, 'the Directory posts about 5 a day (it was 12 at once)')

console.log('\n141. Finding real news')
let j = null; for (let k = 0; k < 6 && !(j && j.directory && j.directory.gathered); k++) j = await run()
const finds = (await db.query('select kind, title, status from dir_finds order by id')).rows
check(j.directory && j.directory.gathered && j.directory.gathered.kept === 4, 'it reads the news sources and keeps 4 useful finds', JSON.stringify(j.directory))
check(finds.some((f) => f.kind === 'alert' && /scam/i.test(f.title)) && finds.some((f) => f.kind === 'guide') && finds.some((f) => f.kind === 'update'), 'judged into kinds: tech update, how-to, safety alert')
check(finds.some((f) => /raises/.test(f.title) && f.status === 'skipped') && !finds.some((f) => /Old news/.test(f.title)), 'funding gossip is skipped; old news isn’t even considered')

console.log('\n142. Writing, checked, ready for its time')
for (let k = 0; k < 10; k++) { j = await run(); const n = (await one("select count(*)::int n from dir_entries where kind <> 'tool'")).n; if (n >= 4) break }
const posts = (await db.query("select kind, slug, status, quality, content, source_name from dir_entries where kind <> 'tool' order by id")).rows
const by = (k) => posts.find((p) => p.kind === k && p.status === 'ready')
check(by('alert') && by('update') && by('guide'), 'a safety alert, a tech update and a how-to are written and waiting (ready)', JSON.stringify(posts.map((p) => [p.kind, p.status, (p.quality.problems || [])[0]])))
check(posts.indexOf(by('alert')) === 0, 'the safety alert is written first (it matters most)')
const cp = posts.find((p) => /Copycat|phone-batteries/i.test(p.slug))
check(cp && cp.status === 'draft' && /Copies the article/.test(JSON.stringify(cp.quality.problems)), 'a post that copies the article word for word is caught (stays a private draft)', cp && JSON.stringify(cp.quality.problems))
check(by('update').source_name === 'TechNews' && by('update').content.facts.length === 3, 'each post knows its source, with 3 facts quoted from it')
let h = null   // (checked in the data: a page cache kept from an earlier test run could still answer for the same address)
check(!(await one("select 1 as x from dir_entries where kind <> 'tool' and status = 'live'")), 'nothing is public before its time')

console.log('\n143. Going live at its time')
const t1 = hm(Date.now() - 5 * 60e3)
await db.query("update dir_settings set slots = $1, per_day = 1", [t1])
const before = ((await (await fetch(G + '/_indexnow')).json()).calls || []).length
await db.query('update meta_settings set enabled = true, paused_at = null, paused_reason = null')
const fb0 = ((await state()).fbFeed || []).length
j = await run()
const alert = await one("select slug, status, slot from dir_entries where kind = 'alert' order by id limit 1")
check(j.directory && j.directory.published && j.directory.published.kind === 'alert' && alert.status === 'live' && alert.slot.endsWith(t1), 'at the time, a post goes live (a strong safety alert goes first)', JSON.stringify(j.directory && j.directory.published))
const calls = (await (await fetch(G + '/_indexnow')).json()).calls || []
check(calls.length > before && calls.at(-1).urlList.includes('https://olexweb.com/alerts/' + alert.slug), 'search engines are told at once (IndexNow)')
j = await run(); check(!(j.directory && j.directory.published), 'one per time: the next run doesn’t post again')
h = await page('/alerts/' + alert.slug)
check(h.s === 200 && h.h.includes('Safety alert') && h.h.includes('Protect yourself') && h.h.includes('based on reporting by') && h.h.includes('SafeNet'), 'olexweb.com/alerts/…: the alert, how to protect yourself, the source credited')
check(h.h.includes('NewsArticle') && h.h.includes('BreadcrumbList') && h.h.includes('wa.me/?text='), 'search-friendly (NewsArticle) and easy to share (WhatsApp first)')
const og = await fetch(APP + '/alerts/' + alert.slug + '/opengraph-image'); check(og.status === 200 && /image\/png/.test(og.headers.get('content-type')), 'its own share picture for WhatsApp, Facebook and X')

console.log('\n144. Seen everywhere')
h = await page('/tools'); check(h.s === 200 && h.h.includes('Safety alert') && h.h.includes('New today') && h.h.includes('Tech updates') && h.h.includes('Search the directory'), 'olexweb.com/tools shows every kind, with “New today”')
h = await page('/alerts'); check(h.s === 200 && h.h.includes('Scam and safety alerts') && h.h.includes(alert.slug), 'olexweb.com/alerts lists the alerts')
const sm = await (await fetch(APP + '/sitemap.xml')).text(); check(sm.includes('/alerts/' + alert.slug) && sm.includes('/updates</loc>'), 'the sitemap lists it')
const feed = await page('/feed.xml'); check(feed.s === 200 && /rss\+xml/.test(feed.type) && feed.h.includes('/alerts/' + alert.slug), 'and the news feed (olexweb.com/feed.xml) for readers and news apps')

console.log('\n145. The day’s best on Facebook')
j = await run(); let fb = (await state()).fbFeed || []
check(fb.length === fb0 + 1 && fb.at(-1).link === 'https://olexweb.com/alerts/' + alert.slug && /^Safety alert: /.test(fb.at(-1).message), 'the day’s best post is shared on your Facebook Page as a link', JSON.stringify(j.directory))
j = await run(); check(((await state()).fbFeed || []).length === fb0 + 1, 'only once a day')

console.log('\n146. The simple Directory screen')
h = await page('/admin/directory')
check(h.h.includes('aria-pressed="true">Simple') && h.h.includes('Posting 1 new thing a day.') && ['Today</h2>', 'Ready to go out</h2>', 'How many a day?</h2>', 'What it posts</h2>', 'Getting seen</h2>'].every((x) => h.h.includes(x)), 'Simple: is it posting, today, ready, how many a day, what it posts, getting seen')
check(h.h.includes('pages live') && h.h.includes('Write the next pages now'), 'the detailed view is still there')
let r = await adm({ action: 'simple-settings', perDay: 4, autoPublish: true }); check(r.s === 200 && (await one('select per_day from dir_settings')).per_day === 4, 'the 3 / 4 / 5 a day buttons work')
r = await adm({ action: 'simple-settings', kinds: [] }); check(r.s === 400, 'at least one kind stays on')
r = await adm({ action: 'simple-settings', kinds: ['tool', 'update', 'guide'] }); check(r.s === 200 && (await one('select kinds from dir_settings')).kinds === 'tool,update,guide', 'a kind can be switched off')
r = await adm({ action: 'publish-now' }); const pn = r.j
check(r.s === 200 && pn.path && (await page(pn.path)).s === 200, 'Publish one now puts a ready post live at once', JSON.stringify(r.j))

console.log('\n147. Old news is let go')
await db.query("update dir_entries set status = 'ready', created_at = now() - interval '4 days' where kind = 'update' and status <> 'draft'")
await db.query("update dir_settings set gathered_at = now(), slots = '08:00,11:00,14:00,17:00,20:00', per_day = 5, kinds = 'tool,update,guide,alert'")
j = await run()
check(!(await one("select 1 as x from dir_entries where kind = 'update' and status = 'ready' and created_at < now() - interval '3 days'")), 'a tech update nobody published within 3 days is put aside, never posted stale')

await db.query("update dir_settings set slots = '08:00,11:00,14:00,17:00,20:00', per_day = 5, kinds = 'tool,update,guide,alert'")
console.log(`  (${pass} passed, ${failn} failed)`)
await db.end(); process.exit(failn ? 1 : 0)
