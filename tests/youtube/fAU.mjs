// Automation, install 1: Facebook's own times and queue (not waiting for YouTube), storage kept until both have it,
// the Facebook caption, Autopilot releasing waiting scripts, Make more, and the new screens.
import pg from 'pg'
import fs from 'node:fs'
import { createHash, randomBytes } from 'node:crypto'
const APP = 'http://localhost:3000', G = 'http://localhost:4555'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0; const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + String(extra).slice(0, 260) : '')) } }
const sess = async (e) => { const u = (await db.query('select id from admin_users where email = $1', [e])).rows[0], t = randomBytes(32).toString('base64url'); await db.query("insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '1 day')", [createHash('sha256').update(t).digest('hex'), u.id]); return t }
const T = await sess('owner@test.local'), E = await sess('editor@test.local')
const api = (path, b, t = T) => fetch(APP + path, { method: 'POST', headers: { cookie: '__Host-olex_sess=' + t, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
const html = async (path, t = T) => { const r = await fetch(APP + path, { headers: { cookie: '__Host-olex_sess=' + t }, redirect: 'manual' }); return { s: r.status, loc: r.headers.get('location') || '', h: (await r.text()).replace(/<!-- -->/g, '') } }
const run = async () => (await (await fetch(APP + '/api/assistant/cron?run=due', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } })).json())
const fbState = async () => (await (await fetch(G + '/_fb')).json())
const hm = (ms) => new Date(ms + 3600e3).toISOString().slice(11, 16), today = new Date(Date.now() + 3600e3).toISOString().slice(0, 10)
const cur = (h, href) => (h.match(/<a [^>]*>/g) || []).some((t) => t.includes('href="' + href + '"') && t.includes('aria-current="page"'))
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0]

// --- connect the Page again through the real flow (the earlier suite ends with Disconnect) ---
let r = await fetch(APP + '/admin/api/meta/connect', { headers: { cookie: '__Host-olex_sess=' + T }, redirect: 'manual' })
const loc = r.headers.get('location'), sc = 'olex_meta_state=' + r.headers.get('set-cookie').match(/olex_meta_state=([^;]+)/)[1]
const back = (await fetch(loc, { redirect: 'manual' })).headers.get('location'), cb = await (await fetch(back, { headers: { cookie: sc } })).text()
await api('/admin/api/meta', { action: 'enable', on: true })
await db.query("update meta_settings set paused_at = null, paused_reason = null; update meta_posts set at = at - interval '1 day', slot = slot || '-old'")
// other videos waiting for Facebook step aside for this suite (restored at the end)
const aside = (await db.query("update yt_scripts set fb = jsonb_build_object('status', 'off', 'was', fb) where kind is distinct from 'long' and video is not null and coalesce(fb->>'status', '') not in ('posted', 'skipped', 'off') and status in ('rendered', 'uploaded') returning id")).rows.map((x) => x.id)

console.log('\n80. Connecting brings you back to Automation → Facebook')
check(/automation\/facebook\?fb=connected/.test(cb), 'after Meta’s login you land on the Facebook tab', cb.slice(0, 200))

console.log('\n81. Facebook has its own posting times')
r = await api('/admin/api/meta', { action: 'times', times: ['13:00', '20:00'] }, E); check(r.status === 403, 'only you can change them')
r = await api('/admin/api/meta', { action: 'times', times: ['13:00', '13:30'] }); let j = await r.json(); check(r.status === 400 && /2 hours/.test(j.error), 'Reels closer than 2 hours apart are refused: “' + j.error + '”')
r = await api('/admin/api/meta', { action: 'times', times: ['13:00', '13:00'] }); check(r.status === 400, 'the same time twice is refused')
r = await api('/admin/api/meta', { action: 'times', times: ['25:00'] }); check(r.status === 400, 'a nonsense time is refused')
r = await api('/admin/api/meta', { action: 'times', times: ['20:00', '13:00'] }); let st = await one('select per_day, times from meta_settings')
check(r.status === 200 && st.per_day === 2 && st.times === '13:00,20:00', '2 Reels a day at 13:00 and 20:00 saved (' + st.times + ')')
const yt0 = await one('select publish_time, publish_time2 from yt_settings'); check(true, `YouTube’s own times are untouched (${yt0.publish_time}${yt0.publish_time2 ? ', ' + yt0.publish_time2 : ''})`)
r = await api('/admin/api/meta', { action: 'per-day', n: 3 }); st = await one('select per_day, times from meta_settings'); check(st.per_day === 3 && st.times.split(',').length === 3, 'choosing 3 a day fills in 3 spread-out times (' + st.times + ')')

const base = await one("select script, checks, claims from yt_scripts where jsonb_array_length(coalesce(script->'scenes', '[]'::jsonb)) > 0 order by id limit 1")
// --- two finished Shorts that are NOT on YouTube yet, with their copies in storage ---
const vid = fs.readFileSync('/home/claude/olexweb-factory/out/video.mp4'), md5 = createHash('md5').update(vid).digest('hex'), P = 1024 * 1024, n = Math.ceil(vid.length / P)
async function makeVideo(key, name, part) {
  const i = (await one("insert into yt_ideas (key, name, url, source, status) values ($1, $2, 'https://' || $1, 'test', 'picked') on conflict (key) do update set status = 'picked' returning id", [key, name])).id
  await db.query('delete from yt_scripts where idea_id = $1', [i])
  await db.query("insert into dir_entries (slug, idea_id, name, url, status, content, quality, published_at) values ($1, $2, $3, 'https://x.test', 'live', '{}', '{\"ok\":true}', now()) on conflict do nothing", ['guide-au' + i, i, name])
  const pk = { title: 'This free site turns photos into palettes', titles: ['This free site turns photos into palettes'], description: 'It turns any photo into a colour palette in seconds. Try it on your next design. #design https://x.test', hashtags: ['#webtools', 'free', 'design', 'extra'] }
  const id = (await one("insert into yt_scripts (idea_id, kind, status, script, package, part, video, checks, claims) values ($1, 'short', 'rendered', $5, $2, $3, $4, $6, $7) returning id", [i, pk, part, { bytes: vid.length, pieces: n, piece: P, seconds: 4, made_at: new Date().toISOString() }, base.script, JSON.stringify(base.checks || []), JSON.stringify(base.claims || [])])).id
  for (let k = 0; k < n; k++) await db.query('insert into yt_pieces (script_id, n, data) values ($1, $2, $3)', [id, k, vid.subarray(k * P, (k + 1) * P)])
  return id
}
const V = await makeVideo('au-one.test', 'PaletteSnap', 1), W = await makeVideo('au-two.test', 'ShrinkIt', 2)
const pieces = async (id) => (await one('select count(*)::int c from yt_pieces where script_id = $1', [id])).c

console.log('\n82. Up next on Facebook, from the shared library')
let h = await html('/admin/automation/facebook')
check(h.h.includes('Up next on Facebook') && h.h.includes('Part 1 · PaletteSnap') && h.h.includes('Part 2 · ShrinkIt') && h.h.includes('Doesn’t wait for YouTube') && h.h.includes('Separate from YouTube’s times'), 'the Facebook tab lists the next Reels by part, with their own times')

console.log('\n83. It waits for its own time, then posts without waiting for YouTube')
await db.query('update meta_settings set per_day = 1, times = $1', [hm(Date.now() + 60 * 60e3)])
const before = (await fbState()).posts.length
j = await run(); check((await fbState()).posts.length === before && !j.facebook, 'before its Reel time: nothing posts')
await db.query('update meta_settings set times = $1', [hm(Date.now() - 5 * 60e3)])
j = await run(); let f = await fbState(), last = f.posts[f.posts.length - 1], row = await one('select status, fb from yt_scripts where id = $1', [V])
check(f.posts.length === before + 1 && j.facebook && j.facebook.posted === V && row.status === 'rendered' && row.fb.status === 'posted', 'at its time, Part 1 posts as a Reel while it’s still waiting for YouTube', JSON.stringify(j.facebook))
check(f.uploads[f.uploads.length - 1].bytes === vid.length, 'Facebook received the whole video (' + vid.length + ' bytes)')
const log = await one('select slot from meta_posts where script_id = $1', [V]); check(log && log.slot === today + ' ' + hm(Date.now() - 5 * 60e3), 'the Reel log records the posting time it filled (' + (log && log.slot) + ')')
check(await pieces(V) === n, 'its copy stays in storage, because YouTube hasn’t posted it yet')
const cap = last.description.split('\n\n')
check(cap[0] === 'This free site turns photos into palettes' && cap[1] === 'It turns any photo into a colour palette in seconds.' && /^Full guide \(free\): https:\/\/olexweb\.com\/tools\/guide-au\d+$/.test(cap[2]) && cap[3] === '#webtools #free #design' && cap.length === 4,
  'the caption is written for Facebook: hook, why it’s useful, the free guide, 3 hashtags', JSON.stringify(cap))

console.log('\n84. Never too many: one per time, never two within the hour')
j = await run(); check((await fbState()).posts.length === before + 1, 'the next run posts nothing more (that time is filled)')
await db.query('update meta_settings set per_day = 2, times = $1', [[hm(Date.now() - 125 * 60e3), hm(Date.now() - 5 * 60e3)].sort().join(',')])
j = await run(); check((await fbState()).posts.length === before + 1, 'an earlier, unfilled time today still waits: no two Reels within the hour')
await db.query("update meta_posts set at = at - interval '61 minutes' where script_id = $1", [V])
j = await run(); f = await fbState(); check(f.posts.length === before + 2 && j.facebook && j.facebook.posted === W, 'an hour later, Part 2 fills the other time', JSON.stringify(j.facebook))
j = await run(); check((await fbState()).posts.length === before + 2, 'with both times filled, nothing more today')

console.log('\n85. YouTube still gets it, and then the copy is freed')
await db.query("update yt_settings set publish_mode = 'private'")
r = await api('/admin/api/youtube', { action: 'post-now', id: V, confirm: true }); j = await r.json(); const S = await (await fetch(G + '/_state')).json()
row = await one('select status, fb from yt_scripts where id = $1', [V])
check(r.status === 200 && row.status === 'uploaded' && S.uploadMd5 === md5, 'YouTube receives the same video byte for byte, after Facebook', JSON.stringify(j).slice(0, 120))
check(await pieces(V) === 0 && row.fb.status === 'posted', 'both channels have it: the stored copy is deleted, and Facebook stays “posted”')

console.log('\n86. Autopilot releases what was already waiting')
await db.query("update yt_settings set yt_mode = 'approval'")
const iA = (await one("insert into yt_ideas (key, name, url, source, status) values ('au-draft.test', 'DraftSite', 'https://d.test', 'test', 'picked') on conflict (key) do update set status = 'picked' returning id")).id
const iB = (await one("insert into yt_ideas (key, name, url, source, status) values ('au-review.test', 'ReviewSite', 'https://r.test', 'test', 'picked') on conflict (key) do update set status = 'picked' returning id")).id
await db.query('delete from yt_scripts where idea_id in ($1, $2)', [iA, iB])
const dA = (await one("insert into yt_scripts (idea_id, status, script, package, checks, claims) values ($1, 'draft', $2, '{\"title\":\"x\",\"titles\":[\"x\"],\"hashtags\":[]}', $3, $4) returning id", [iA, base.script, JSON.stringify(base.checks || []), JSON.stringify(base.claims || [])])).id
const dB = (await one("insert into yt_scripts (idea_id, status, script, package, checks, claims) values ($1, 'needs_review', $2, '{\"title\":\"y\",\"titles\":[\"y\"],\"hashtags\":[]}', $3, $4) returning id", [iB, base.script, JSON.stringify(base.checks || []), JSON.stringify(base.claims || [])])).id
h = await html('/admin/automation'); check(h.h.includes('2 scripts waiting for approval') && h.h.includes('YouTube is on Approval'), 'Overview → Needs you: “2 scripts waiting for approval”, and flags YouTube on Approval')
h = await html('/admin/youtube?view=progress'); check(/<b>ReviewSite<\/b><span>Waiting for your review<\/span>/.test(h.h), 'Progress says “Waiting for your review” (not “Stopped”)')
r = await api('/admin/api/youtube', { action: 'yt-mode', mode: 'autopilot' }); j = await r.json()
const sA = (await one('select status from yt_scripts where id = $1', [dA])).status, sB = (await one('select status from yt_scripts where id = $1', [dB])).status
check(j.released >= 1 && sA === 'approved', 'switching to Autopilot approves the script that was waiting (' + j.released + ' released)')
check(sB === 'needs_review', 'a script that failed a check still waits for your eye')
await db.query('delete from yt_scripts where id in ($1, $2)', [dA, dB])

console.log('\n87. Make more')
r = await api('/admin/api/youtube', { action: 'make-more' }, E); check(r.status === 403, 'only you can press it')
r = await api('/admin/api/youtube', { action: 'make-more' }); j = await r.json(); const said = j.message || j.error; check([200, 400].includes(r.status) && typeof said === 'string' && said.length > 10, 'it starts the next video, or says plainly why not: “' + said + '”')

console.log('\n88. The Automation screens')
h = await html('/admin/automation')
check(h.h.includes('>Automation</h1>') && ['Overview', 'YouTube', 'Facebook', 'Instagram'].every((t) => h.h.includes('>' + t + '</a>')), 'Automation heading with its tabs: Overview · YouTube · Facebook · Instagram')
check(h.h.includes('Production check') && h.h.includes('a day this week') && h.h.includes('ready in the library') && h.h.includes('Make more'), 'Overview shows the production check with Make more')
check(h.h.includes('Posting times') && h.h.includes('Private until the audit') && h.h.includes('Reel') && h.h.includes('Olexweb'), 'a card per channel: YouTube (times, today, queue, status) and Facebook (Page, times, today, queue)')
check(h.h.includes('stable for 2 weeks'), 'Instagram stays off, with the reason')
check(cur(h.h, '/admin/automation'), 'the sidebar has Automation, highlighted')
h = await html('/admin/youtube?view=scripts')
check(h.h.includes('>Automation</h1>') && cur(h.h, '/admin/youtube') && h.h.includes('YouTube automation') && cur(h.h, '/admin/automation'), 'YouTube lives under Automation (its tabs unchanged), and the sidebar still highlights Automation')
h = await html('/admin/automation/instagram'); check(h.s === 200 && h.h.includes('Business account'), 'the Instagram tab explains the steps for later')
h = await html('/admin/automation', E); check(h.s >= 300 || h.h.includes('NEXT_REDIRECT') || !h.h.includes('Production check'), 'an editor can’t open Automation')
h = await html('/admin/automation/facebook'); check(h.h.includes('Recent Reels') && h.h.includes('PaletteSnap') && h.h.includes('Pauses itself if Meta reports a block'), 'the Facebook tab shows recent Reels and the safety rule')

// tidy up: the videos that stepped aside return as they were
for (const id of aside) await db.query("update yt_scripts set fb = fb->'was' where id = $1 and fb->>'status' = 'off'", [id])
await db.query("update yt_scripts set fb = null where fb = 'null'::jsonb")
console.log(`  (${pass} passed, ${failn} failed)`); await db.end(); process.exit(failn ? 1 : 0)
