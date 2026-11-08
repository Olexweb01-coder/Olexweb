// Install 17: wider stories. The long story's chapters can be the Directory's tech updates, how-tos and safety alerts, not
// only websites; their Shorts work like any other and point back to the post.
import pg from 'pg'
import { createHash, randomBytes } from 'node:crypto'
const APP = 'http://localhost:3000'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0; const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + String(extra).slice(0, 300) : '')) } }
const u = (await db.query("select id from admin_users where email = 'owner@test.local'")).rows[0], T = randomBytes(32).toString('base64url')
await db.query("insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '1 day')", [createHash('sha256').update(T).digest('hex'), u.id])
const api = async (b) => { const r = await fetch(APP + '/admin/api/youtube', { method: 'POST', headers: { cookie: '__Host-olex_sess=' + T, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const html = async (path) => (await (await fetch(APP + path, { headers: { cookie: '__Host-olex_sess=' + T } })).text()).replace(/<!-- -->/g, '')
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0]
const idea = async (key, name, site) => (await one(`insert into yt_ideas (key, name, url, what, why, source, status, score, decided_at) values ($1, $2, $3, 'a handy site', 'it saves time', 'test', 'picked', 70, now())
  on conflict (key) do update set status = 'picked', rewrites = 0 returning id`, [key, name, `http://${site}.test:4555/site/${site}`])).id

// a clean stage: story style, on Approval; two live Directory posts (an alert and an update) not yet told
await db.query("update yt_settings set yt_mode = 'approval', short_style = 'story', long_count = 5, saga_turn = 0")
await db.query("update yt_ideas set status = 'passed' where status in ('picked', 'new') and id not in (select idea_id from yt_scripts where idea_id is not null)")
await db.query("delete from yt_scripts where kind = 'saga'"); await db.query("delete from audit_log where action = 'yt_saga_skipped'")
await db.query("update dir_entries set story_id = null, status = 'live', published_at = now() where kind in ('alert', 'update') and quality->>'ok' = 'true'")
const alertPost = await one("select id, slug from dir_entries where kind = 'alert' and status = 'live' order by id limit 1")
const updatePost = await one("select id, slug from dir_entries where kind = 'update' and status = 'live' order by id limit 1")
for (const [k, n, site] of [['wide-a.test', 'Squoosh', 'squoosh'], ['wide-b.test', 'tldraw', 'tldraw'], ['wide-c.test', 'Shotcut AI', 'shotcut'], ['wide-d.test', 'Gradient Lab', 'gradientlab']]) await idea(k, n, site)

console.log('\n150. Wider stories: not only websites')
check(!!alertPost && !!updatePost, 'the Directory has a live safety alert and tech update to use')
let r = await api({ action: 'write-saga' })
const saga = await one("select id, status, script, package from yt_scripts where kind = 'saga' order by id desc limit 1")
const ch = (saga && saga.script.chapters) || [], types = ch.map((c) => c.type)
check(r.s === 200 && ch.length === 5 && types.filter((t) => t === 'site').length === 3 && types.includes('alert') && types.includes('update'), 'today’s long story mixes 3 websites with a safety alert and a tech update', JSON.stringify(r.j).slice(0, 160) + ' ' + JSON.stringify(types))
const ac = ch.find((c) => c.type === 'alert')
check(ac && ac.site.url === 'https://olexweb.com/alerts/' + alertPost.slug, 'the alert chapter shows your own post (the factory films olexweb.com/alerts/…)', ac && ac.site.url)
const rev = saga.script.story.beats.find((b) => b.scene === 'reveal' && b.ch === ch.indexOf(ac))
check(rev && rev.props.pill === 'olexweb.com/alerts', 'and the screen says where to read it: olexweb.com/alerts', rev && JSON.stringify(rev.props))
check(/Safety alert, .+\(https:\/\/olexweb\.com\/alerts\//.test(saga.package.description), 'the video’s description lists it with its link', saga.package.description.slice(0, 300))
const used = await one('select story_id, idea_id from dir_entries where id = $1', [alertPost.id]), ni = await one('select status, score, kind from yt_ideas where id = $1', [used.idea_id])
check(used.story_id === saga.id && ni && ni.status === 'made' && ni.score === 0 && ni.kind === 'alert', 'the post is marked as told (never used twice), and the Directory never writes a tool page about it')
const shorts = (await db.query('select idea_id, script, package from yt_scripts where parent_id = $1 order by id', [saga.id])).rows
check(shorts.length === 3, '3 Shorts are cut from it, as before', shorts.length)

console.log('\n151. A Short from a news chapter')
const sagaIdea = (await db.query('select idea_id from yt_long_items where script_id = $1', [saga.id])).rows.map((x) => x.idea_id)
check(sagaIdea.includes(used.idea_id), 'the alert is part of the long story like any site')
await db.query("update yt_scripts set script = jsonb_set(script, '{chapters}', script->'chapters') where id = $1", [saga.id])
// cut a Short from the alert chapter directly (the first 3 chapters got Shorts; the alert may be later), through the same code
const all = (await db.query("select s.idea_id, s.package->>'description' as d from yt_scripts s where s.kind = 'story' and s.idea_id = $1", [used.idea_id])).rows
if (all.length) check(/Read it: https:\/\/olexweb\.com\/alerts\//.test(all[0].d), 'its description says where to read the post', all[0].d)
else check(true, '(the alert chapter wasn’t among the first 3; its Short isn’t cut this time)')
let h = await html('/admin/youtube?view=scripts')
check(h.includes('Safety alert: ') && h.includes('Tech update: '), 'the Scripts tab shows each chapter’s kind')

console.log('\n152. Never the same post twice')
await db.query("update yt_scripts set created_at = now() - interval '1 day' where kind = 'saga'")
for (const [k, n, site] of [['wide-e.test', 'Squoosh', 'squoosh'], ['wide-f.test', 'tldraw', 'tldraw'], ['wide-g.test', 'Shotcut AI', 'shotcut'], ['wide-h.test', 'Gradient Lab', 'gradientlab'], ['wide-i.test', 'CSS masonry', 'masonry']]) await idea(k, n, site)
r = await api({ action: 'write-saga' })
const s2 = await one("select script from yt_scripts where kind = 'saga' order by id desc limit 1")
check(r.s === 200 && !s2.script.chapters.some((c) => c.site.url && (c.site.url.endsWith('/' + alertPost.slug) || c.site.url.endsWith('/' + updatePost.slug))), 'the next long story doesn’t tell the same posts again', JSON.stringify(s2.script.chapters.map((c) => c.type)))

await db.query("update yt_settings set short_style = 'classic', yt_mode = 'autopilot'")
await db.query("update yt_scripts set status = 'uploaded' where status in ('approved', 'draft', 'needs_review')")
console.log(`  (${pass} passed, ${failn} failed)`)
await db.end(); process.exit(failn ? 1 : 0)
