// Install 25: nothing is posted twice. The Directory drops a story that's already posted (even from another source with
// other words) before writing it; the blog refuses a topic the site already has; repeats already live are listed and
// can be merged (the copy's address becomes a permanent redirect to the one that's kept); the sitemap follows.
import pg from 'pg'
import { createHash, randomBytes } from 'node:crypto'
const APP = 'http://localhost:3000'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0; const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + String(extra).slice(0, 300) : '')) } }
const u = (await db.query("select id from admin_users where email = 'owner@test.local'")).rows[0], T = randomBytes(32).toString('base64url')
await db.query("insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '1 day')", [createHash('sha256').update(T).digest('hex'), u.id])
const post = async (path, b) => { const r = await fetch(APP + path, { method: 'POST', headers: { cookie: '__Host-olex_sess=' + T, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const get = async (path) => { const r = await fetch(APP + path, { redirect: 'manual' }); return { s: r.status, loc: r.headers.get('location'), h: await r.text() } }
const run = async () => (await (await fetch(APP + '/api/assistant/cron?run=due', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } })).json())
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0]
const entry = (slug, name, kind = 'update') => db.query(`insert into dir_entries (slug, name, url, kind, status, content, quality, published_at) values ($1, $2, $3, $4, 'live', $5, '{}', now()) returning id`,
  [slug, name, 'http://news.test:4555/news/' + slug, kind, JSON.stringify({ title: name, metaDescription: name + ' explained simply for you.', oneLiner: name, tags: [] })])

await db.query("update yt_settings set yt_mode = 'approval'"); await db.query("update yt_ideas set status = 'passed' where status = 'picked'")
await db.query("update yt_scripts set status = 'uploaded' where status in ('approved', 'draft', 'needs_review', 'rendering')")
await db.query("delete from dir_entries where kind <> 'tool'"); await db.query('delete from dir_finds')

console.log('\n170. The Directory: a story that’s already posted isn’t picked again')
// already posted from another source, in other words; the test feed carries "WhatsApp adds message drafts for everyone" and "Fake delivery text scam is going round"
await entry('whatsapp-message-drafts-arrive', 'WhatsApp message drafts arrive for everyone on Android and iPhone')
await db.query("update dir_settings set auto_publish = true, slots = '08:00,11:00,14:00,17:00,20:00', kinds = 'tool,update,guide,alert', gathered_at = null")
let j = null; for (let k = 0; k < 6 && !(j && j.directory && j.directory.gathered); k++) j = await run()
const g = j.directory && j.directory.gathered
check(g && g.repeats === 1 && g.kept === 3, 'reading the news: the WhatsApp story is dropped as a repeat, the other 3 useful ones are kept', JSON.stringify(g))
const wa = await one("select status, why from dir_finds where url like '%/news/drafts'")
check(wa && wa.status === 'skipped' && /^Already covered: WhatsApp message drafts arrive/.test(wa.why), 'it’s remembered as skipped, with the post it repeats', JSON.stringify(wa))
check(!(await one("select 1 from dir_finds where url like '%/news/drafts' and status = 'new'")), 'so it’s never written')

console.log('\n171. …and one picked earlier is stopped at writing time')
await db.query("delete from dir_entries where kind <> 'tool'")
const scam = await one("select id from dir_finds where url like '%/news/scam'")
await entry('delivery-text-scam-warning', 'Fake delivery text scam going round: how to spot it', 'alert')       // posted from elsewhere after it was picked
await db.query("update dir_entries set created_at = created_at - interval '2 days' where status in ('draft', 'blocked')");   // earlier suites' failed drafts would trip the daily safety net
await db.query("update dir_settings set gathered_at = now(), kinds = 'guide,alert'"); await db.query("update dir_finds set status = 'skipped' where id <> $1 and status = 'new'", [scam.id])   // only the news kinds, so the scam story is next
for (let k = 0; k < 5; k++) { await run(); if ((await one('select status from dir_finds where id = $1', [scam.id])).status !== 'new') break }
const sf = await one('select status, why from dir_finds where id = $1', [scam.id])
check(sf.status === 'skipped' && /^Already covered: Fake delivery text scam going round/.test(sf.why) && !(await one('select 1 from dir_entries where find_id = $1', [scam.id])), 'the scam story, already up from another source, is skipped instead of written twice', JSON.stringify(sf))

console.log('\n172. The blog: a topic the site already has isn’t written again')
await db.query("delete from research_items where used_by is null")
const live = await one("insert into posts (slug, title, summary, body, status, published_on) values ('rep-test-ai-web-dev', 'AI-powered web development: transforming business websites', 's', '[]', 'live', current_date - 5) returning id")
const ri = await one(`insert into research_items (topic, why, searches, sources) values ('AI-Powered Web Development: Transforming Business Websites', 'why', '["ai web development"]', '[{"title":"x","url":"http://news.test:4555/news/drafts","from":"t"}]') returning id`)
let r = await post('/admin/api/assistant', { action: 'write', researchId: ri.id })
check(r.s === 400 && /Already covered by “AI-powered web development: transforming business websites”/.test(r.j.error || ''), 'asked to write the same topic again, it refuses and names the article that covers it', JSON.stringify(r.j))
check(!(await one('select 1 from research_items where id = $1', [ri.id])) && (await one("select count(*)::int n from posts where title ilike 'AI-powered web development%'")).n === 1, 'the repeated topic is dropped; no second article exists')

console.log('\n173. Repeats already live: listed, and merged with a redirect')
const twin = await one("insert into posts (slug, title, summary, body, status, published_on) values ('rep-test-ai-web-dev-2', 'AI-powered web development: transforming business websites', 's', '[]', 'live', current_date) returning id")
await db.query("delete from dir_entries where kind <> 'tool'")
const a1 = (await entry('ms-365-outage-one', 'Microsoft 365 global outage hits Outlook, Teams and SharePoint')).rows[0].id
await db.query("update dir_entries set published_at = now() - interval '1 hour' where id = $1", [a1])
const a2 = (await entry('ms-365-outage-two', 'Microsoft Outlook and 365 suffer global outage: what happened')).rows[0].id
await entry('windows-11-speed', 'How to speed up Windows 11 on older laptops', 'guide')
r = await post('/admin/api/directory', { action: 'repeats' })
const bp = (r.j.blog || []).find((p) => p.repeat.id === twin.id), dp = (r.j.dir || []).find((p) => p.repeat.id === a2)
check(bp && bp.keep.id === live.id && dp && dp.keep.id === a1 && r.j.dir.length === 1, 'the list pairs each copy with the older post to keep (and leaves unrelated posts alone)', JSON.stringify(r.j).slice(0, 300))
r = await post('/admin/api/directory', { action: 'merge-repeat', type: 'post', keep: live.id, repeat: twin.id })
check(r.s === 200 && r.j.to === '/insights/rep-test-ai-web-dev', 'merging the blog copy', JSON.stringify(r.j))
let p = await get('/insights/rep-test-ai-web-dev-2'); check(p.s === 308 && /\/insights\/rep-test-ai-web-dev$/.test(p.loc || ''), 'the copy’s address now redirects for good (308) to the kept article', p.s + ' ' + p.loc)
r = await post('/admin/api/directory', { action: 'merge-repeat', type: 'entry', keep: a1, repeat: a2 })
p = await get('/updates/ms-365-outage-two'); check(r.s === 200 && p.s === 308 && /\/updates\/ms-365-outage-one$/.test(p.loc || ''), 'the same for the Directory copy', p.s + ' ' + p.loc)
p = await get('/updates/ms-365-outage-one'); check(p.s === 200, 'the kept post still opens')
p = await get('/updates/never-existed-xyz'); check(p.s === 404, 'an address that never existed is still “not found”', p.s)
const sm = (await get('/sitemap.xml')).h
check(!sm.includes('rep-test-ai-web-dev-2') && !sm.includes('ms-365-outage-two') && sm.includes('ms-365-outage-one') && sm.includes('/tools/graceville-fast-bible'), 'the sitemap lists the kept ones only (and now the Fast Bible page)')
r = await post('/admin/api/directory', { action: 'repeats' }); check(r.j.blog.every((x) => x.repeat.id !== twin.id) && r.j.dir.length === 0, 'the list is clear afterwards')
const html = (await (await fetch(APP + '/admin/directory', { headers: { cookie: '__Host-olex_sess=' + T } })).text())
check(html.includes('admin') && r.s === 200, 'the Directory screen loads')

await db.query("delete from posts where slug like 'rep-test-%'"); await db.query("delete from dir_entries where kind <> 'tool'"); await db.query('delete from dir_finds')
console.log(`\npassed: ${pass}`); if (failn) console.log(`failed: ${failn}`)
await db.end(); process.exit(failn ? 1 : 0)
