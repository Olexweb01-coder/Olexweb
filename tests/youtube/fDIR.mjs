// The Olexweb Directory: writes checked pages by itself, refuses invented facts and thin sites, publishes, announces, tracks
import pg from 'pg'
import { createHash, randomBytes } from 'node:crypto'
const APP = 'http://localhost:3000', G = 'http://localhost:4555'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0; const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + String(extra).slice(0, 220) : '')) } }
const sess = async (e) => { const u = (await db.query('select id from admin_users where email = $1', [e])).rows[0], t = randomBytes(32).toString('base64url'); await db.query("insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '1 day')", [createHash('sha256').update(t).digest('hex'), u.id]); return t }
const T = await sess('owner@test.local'), E = await sess('editor@test.local')
const adm = async (b, t = T) => { const r = await fetch(APP + '/admin/api/directory', { method: 'POST', headers: { cookie: '__Host-olex_sess=' + t, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const html = async (p) => { await new Promise((ok) => setTimeout(ok, 200)); const r = await fetch(APP + p); return { s: r.status, h: (await r.text()).replace(/<!-- -->/g, '') } }
await db.query("delete from dir_entries; delete from dir_daily; update dir_settings set per_day = 12, auto_publish = true, last_ping = null")
await db.query("update yt_ideas set score = least(score, 40) where key not in ('dirtool', 'fibtool', 'tldraw-dir')")
for (const [k, n, u, sc] of [['dirtool', 'DirTool', 'http://dirtool.test:4555/site/dirtool', 90], ['fibtool', 'FibTool', 'http://fibtool.test:4555/site/fibtool', 85], ['tldraw-dir', 'tldraw', 'http://tldraw.test:4555/site/tldraw', 80]])
  await db.query("insert into yt_ideas (key, name, url, source, category, what, score, status) values ($1, $2, $3, 'Show HN', 'Design', 'test', $4, 'new') on conflict (key) do update set score = $4, status = 'new', url = $3", [k, n, u, sc])
console.log('\n65. The Directory writes checked pages by itself')
let r = await adm({ action: 'run' }, E); check(r.s === 403, 'only you can run it by hand')
r = await adm({ action: 'run' }); r.s === 200 && r.j.wrote < 3 && (r = { s: 200, j: { ...r.j, more: (await adm({ action: 'run' })).j } })
const rows = Object.fromEntries((await db.query('select name, status, quality from dir_entries')).rows.map((x) => [x.name, x]))
check(rows.DirTool && rows.DirTool.status === 'live' && rows.DirTool.quality.ok, 'an honest page (every fact quoted from the site) is written and published', JSON.stringify(rows.DirTool && rows.DirTool.quality))
check(rows.FibTool && rows.FibTool.status === 'draft' && /Not backed by the site/.test(JSON.stringify(rows.FibTool.quality.problems)), 'a page with an invented fact (“2 million teams”) is caught and kept as a private draft', JSON.stringify(rows.FibTool && rows.FibTool.quality))
check(rows.tldraw && rows.tldraw.status === 'draft' && /too little readable text/.test(JSON.stringify(rows.tldraw.quality.problems)), 'a site with too little text is not written about (no thin pages)')
r = await adm({ action: 'publish', id: (await db.query("select id from dir_entries where name = 'FibTool'")).rows[0].id }); check(r.s === 400 && /quality checks/.test(r.j.error), 'a page that failed the checks can’t be published by hand either')
console.log('\n66. The public pages')
let h = await html('/tools/dirtool')
check(h.s === 200 && h.h.includes('DirTool') && h.h.includes('Free + paid plans') && h.h.includes('How to start') && h.h.includes('Our take'), 'olexweb.com/tools/dirtool: title, price badge, how to start, our take')
check(h.h.includes('You can export your diagram as PNG or SVG and share a link with your team.') && h.h.includes('FAQPage') && h.h.includes('BreadcrumbList'), 'every fact shows the site’s own words, with search-engine data (questions, breadcrumbs)')
check(/href="\/aoc\?from=tools-dirtool"|href="\/[a-z0-9-]+\?from=tools-dirtool"/.test(h.h), 'one clear next step: your offer, tracked by page')
check(!h.h.includes('FibTool'), 'drafts never appear publicly')
h = await html('/tools'); check(h.s === 200 && h.h.includes('DirTool') && h.h.includes('Search the directory') && !h.h.includes('FibTool'), 'olexweb.com/tools lists live pages with search')
h = await html('/tools/fibtool'); check(h.s === 404, 'a draft’s address is “not found”')
const sm = await (await fetch(APP + '/sitemap.xml')).text(); check(sm.includes('/tools/dirtool') && sm.includes('/tools</loc>') && !sm.includes('/tools/fibtool'), 'the sitemap lists the library and live pages')
const key = await (await fetch(APP + '/api/indexnow')).text(), calls = (await (await fetch(G + '/_indexnow')).json()).calls
check(calls.some((c) => c.key === key && c.host === 'olexweb.com' && c.urlList.includes('https://olexweb.com/tools/dirtool') && c.keyLocation === 'https://olexweb.com/api/indexnow'), 'search engines are told at once (IndexNow, with a key they can verify)')
for (const lead of [false, false, true]) await fetch(APP + '/api/dir', { method: 'POST', headers: { Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: 'dirtool', lead }) })
const v = (await db.query("select views, leads from dir_entries where slug = 'dirtool'")).rows[0]; check(v.views >= 2 && v.leads === 1, 'views and leads are counted per page')
console.log('\n67. Controls and the autopilot')
const ad = (await (await fetch(APP + '/admin/directory', { headers: { cookie: '__Host-olex_sess=' + T } })).text()).replace(/<!-- -->/g, '')
check(ad.includes('pages live') && ad.includes('Write the next pages now') && ad.includes('leads'), 'Admin → Directory shows pages live, views, leads and the controls')
await adm({ action: 'unpublish', id: (await db.query("select id from dir_entries where slug = 'dirtool'")).rows[0].id }); h = await html('/tools/dirtool'); check(h.s === 404, 'Unpublish takes a page offline at once')
await adm({ action: 'publish', id: (await db.query("select id from dir_entries where slug = 'dirtool'")).rows[0].id })
await adm({ action: 'settings', perDay: 0, autoPublish: true }); r = await adm({ action: 'run' }); check(r.j.skipped, 'the daily limit is respected (0 here)')
await adm({ action: 'settings', perDay: 12, autoPublish: true })
await db.query("delete from dir_entries where name = 'tldraw'"); await db.query("insert into yt_ideas (key, name, url, source, category, what, score, status) values ('dirtool2', 'DirTool', 'http://dirtool.test:4555/site/dirtool', 'Show HN', 'Design', 'test', 95, 'new') on conflict (key) do update set score = 95, status = 'new'")
await db.query("update yt_idea_runs set last_run = now(), running_until = null"); await db.query("update yt_ideas set status = 'skipped' where status = 'picked'")
const cr = await (await fetch(APP + '/api/assistant/cron?run=due', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } })).json()
check(cr.directory && cr.directory.wrote >= 1, 'the autopilot writes new Directory pages by itself on its regular run', JSON.stringify(cr).slice(0, 200))
check((await db.query("select count(*)::int n from dir_entries where slug like 'dirtool-%'")).rows[0].n >= 1, 'a second page about a similarly named site gets its own address (no clash)')
console.log(`  (${pass} passed, ${failn} failed)`); await db.end(); process.exit(failn ? 1 : 0)
