// Automation, install 2: the Library. Your own idea (judged like any found idea), Make it next (first in scripts, the
// factory, YouTube's queue and Facebook's), and the channel ticks (only before that channel posts; at least one ticked).
// Runs after the phaseAU chain (it needs the connected test channel, the factory's video and the Facebook stand-in).
import pg from 'pg'
import fs from 'node:fs'
import { randomBytes, createHash } from 'node:crypto'
const APP = 'http://localhost:3000', G = 'http://localhost:4555'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0; const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + String(extra).slice(0, 260) : '')) } }
const sess = async (e) => { const u = (await db.query('select id from admin_users where email = $1', [e])).rows[0], t = randomBytes(32).toString('base64url'); await db.query("insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '1 day')", [createHash('sha256').update(t).digest('hex'), u.id]); return t }
const T = await sess('owner@test.local'), E = await sess('editor@test.local')
const api = async (b, t = T) => { const r = await fetch(APP + '/admin/api/youtube', { method: 'POST', headers: { cookie: '__Host-olex_sess=' + t, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const html = async (path, t = T) => { const r = await fetch(APP + path, { headers: { cookie: '__Host-olex_sess=' + t }, redirect: 'manual' }); return { s: r.status, loc: r.headers.get('location') || '', h: await r.text() } }
const run = async () => (await (await fetch(APP + '/api/assistant/cron?run=due', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } })).json())
const gstate = async () => (await (await fetch(G + '/_state')).json())
const fbPosts = async () => (await (await fetch(G + '/_fb')).json()).posts
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0]
const hm = (ms) => new Date(ms + 3600e3).toISOString().slice(11, 16)
const site = (k) => `http://${k}.test:4555/site/${k}`
const pieces = async (id) => (await one('select count(*)::int c from yt_pieces where script_id = $1', [id])).c
const tick = (id, channel, on) => api({ action: 'library-channel', id, channel, on })

// what this suite changes is put back at the end
const was = { yt: await one('select yt_mode, publish_mode, publish_time, publish_time2 from yt_settings'), meta: await one('select per_day, times from meta_settings') }
const asideFb = (await db.query("update yt_scripts set fb = jsonb_build_object('status', 'off', 'was', fb) where kind is distinct from 'long' and video is not null and coalesce(fb->>'status', '') not in ('posted', 'skipped', 'off') and status in ('rendered', 'uploaded') returning id")).rows.map((x) => x.id)
const asideQ = (await db.query('update yt_scripts set queue_pos = null where queue_pos is not null returning id, queue_pos')).rows
const asideSt = (await db.query("select id, status, render_error from yt_scripts where status in ('approved', 'rendering')")).rows
await db.query("update yt_scripts set status = 'failed' where status in ('approved', 'rendering')")
const base = await one("select script, checks, claims from yt_scripts where jsonb_array_length(coalesce(script->'scenes', '[]'::jsonb)) > 0 order by id limit 1")
const vid = fs.readFileSync('/home/claude/olexweb-factory/out/video.mp4'), P = 1024 * 1024, n = Math.ceil(vid.length / P)
async function makeVideo(key, name, part, first = false) {
  const i = (await one("insert into yt_ideas (key, name, url, source, status, first) values ($1, $2, 'https://' || $1, 'test', 'picked', $3) on conflict (key) do update set status = 'picked', first = $3, channels = default returning id", [key, name, first])).id
  await db.query('delete from yt_scripts where idea_id = $1', [i])
  const pk = { title: 'This free site is a ' + name, titles: ['This free site is a ' + name], description: 'It does one useful thing well. Try it today. #tools', hashtags: ['#webtools', 'free', 'tools'] }
  const id = (await one("insert into yt_scripts (idea_id, kind, status, script, package, part, video, checks, claims) values ($1, 'short', 'rendered', $5, $2, $3, $4, $6, $7) returning id",
    [i, pk, part, { bytes: vid.length, pieces: n, piece: P, seconds: 4, made_at: new Date().toISOString() }, base.script, JSON.stringify(base.checks || []), JSON.stringify(base.claims || [])])).id
  for (let k = 0; k < n; k++) await db.query('insert into yt_pieces (script_id, n, data) values ($1, $2, $3)', [id, k, vid.subarray(k * P, (k + 1) * P)])
  return { idea: i, id }
}

console.log('\n90. The Library tab')
let h = await html('/admin/automation/library')
check(h.s === 200 && /href="\/admin\/automation\/library"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/admin\/automation\/library"/.test(h.h), 'Automation → Library opens, its tab marked current')
check(h.h.includes('Add your own idea') && h.h.includes('Search ideas and videos'), 'it has search and Add your own idea')
h = await html('/admin/automation/library', E); check(h.s >= 300 && h.s < 400 && h.loc.includes('/admin/more'), 'an editor is sent away from it', h.s + ' ' + h.loc)
h = await html('/admin/automation'); check(h.h.includes('href="/admin/automation/library"'), 'the Library tab sits in the Automation tabs')

console.log('\n91. Your own idea, judged like any found idea')
await db.query("delete from yt_ideas where key in ('squoosh.test', 'fontpair.test', 'clicky.test', 'freemovies.test')")
const judgedBefore = ((await gstate()).judged || []).length
let r = await api({ action: 'own-idea', url: site('squoosh'), note: 'Shrinks images right in the browser', next: true })
let row = await one("select id, status, first, source, signal, channels, score, decided_at, scores from yt_ideas where key = 'squoosh.test'")
check(r.s === 200 && r.j.passed === false && r.j.score > 0 && r.j.next === true, `a good site is kept, with a score (${r.j.score}/100)`, JSON.stringify(r.j))
check(row && row.status === 'picked' && row.first === true && row.decided_at, 'Make it next: picked and first in line')
check(row && row.source === 'You' && row.signal === 'Your idea: Shrinks images right in the browser', 'it’s marked as your idea, with your note')
check(r.j.name === 'Squoosh' && !/\.test/.test(r.j.name), 'it’s saved under the site’s real name, not its address (' + r.j.name + ')')
check(row && row.channels.youtube === true && row.channels.facebook === true && row.scores && row.scores.trust >= 6, 'both channels ticked; the same scores as a found idea')
const judged = ((await gstate()).judged || []).slice(judgedBefore)
check(judged.some((t) => /Squoosh|squoosh/.test(t) && t.includes('Shrinks images')), 'the same AI judge saw the site and your note', JSON.stringify(judged))
r = await api({ action: 'own-idea', url: site('squoosh') }); check(r.s === 400 && /already in the Library/.test(r.j.error), 'adding it again: “' + r.j.error + '”')
r = await api({ action: 'own-idea', url: site('fontpair'), channels: { youtube: true, facebook: false }, next: false })
row = await one("select status, first, channels from yt_ideas where key = 'fontpair.test'")
check(r.s === 200 && !r.j.passed && row.status === 'new' && row.first === false && row.channels.facebook === false, 'Add to the list: a new idea, with Facebook unticked as chosen')
r = await api({ action: 'own-idea', url: site('clicky') }); row = await one("select status, source, why from yt_ideas where key = 'clicky.test'")
check(r.s === 200 && r.j.passed === true && row.status === 'passed' && row.source === 'You', 'a thin site is turned down, like a found one (low value)', JSON.stringify(r.j))
check(r.j.why && row.why, 'you’re told why: “' + r.j.why + '”')
r = await api({ action: 'own-idea', url: site('freemovies') }); check(r.s === 200 && r.j.passed === true && r.j.scores.trust < 6, 'an unsafe site is turned down (piracy)')
r = await api({ action: 'own-idea', url: site('clicky') }); check(r.s === 400 && /turned down/.test(r.j.error), 'a turned-down site isn’t judged again: “' + r.j.error + '”')
r = await api({ action: 'own-idea', url: 'http://down.test:4555/site/down' }); check(r.s === 400 && /didn’t load/.test(r.j.error), 'a site that doesn’t load: “' + r.j.error + '”')
r = await api({ action: 'own-idea', url: 'ftp://files.test/x' }); check(r.s === 400 && /address/.test(r.j.error), 'not a web address is refused')
r = await api({ action: 'own-idea', url: site('gradientlab'), channels: { youtube: false, facebook: false } }); check(r.s === 400 && /at least one/.test(r.j.error), 'no channel ticked is refused')
r = await api({ action: 'own-idea', url: site('gradientlab') }, E); check(r.s === 403, 'an editor can’t add ideas')

console.log('\n92. Make it next goes first everywhere')
await db.query("insert into yt_ideas (key, name, url, source, status, decided_at) values ('lib-old.test', 'OldPick', 'https://lib-old.test', 'test', 'picked', now() - interval '3 days') on conflict (key) do update set status = 'picked', decided_at = now() - interval '3 days', first = false")
await db.query("delete from yt_scripts where idea_id = (select id from yt_ideas where key = 'lib-old.test')")
const calls0 = ((await gstate()).scriptCalls || []).length
r = await api({ action: 'make-more' })
const sq = await one("select s.id, s.status from yt_scripts s join yt_ideas i on i.id = s.idea_id where i.key = 'squoosh.test'")
check(r.s === 200 && sq, 'the next script written is your “Make it next” idea, not an older pick', JSON.stringify(((await gstate()).scriptCalls || []).slice(calls0)))
check(!(await one("select 1 from yt_scripts s join yt_ideas i on i.id = s.idea_id where i.key = 'lib-old.test'")), 'the older pick waits its turn')
const old = (await one("insert into yt_scripts (idea_id, kind, status, script, package, checks, claims, approved_at) select id, 'short', 'approved', $1, '{\"title\":\"Old\"}', '[]', '[]', now() - interval '1 hour' from yt_ideas where key = 'lib-old.test' returning id", [base.script])).id
await db.query("update yt_scripts set status = 'approved', approved_at = now() where id = $1", [sq.id])
const d0 = ((await gstate()).dispatches || []).length
r = await api({ action: 'make-more' }); const disp = ((await gstate()).dispatches || []).slice(d0)
check(r.s === 200 && (await one('select status from yt_scripts where id = $1', [sq.id])).status === 'rendering' && (await one('select status from yt_scripts where id = $1', [old])).status === 'approved', 'the factory makes your idea first, though the other was approved earlier', JSON.stringify(disp.map((x) => x.body && x.body.inputs)))
await db.query("update yt_scripts set status = 'failed', render_error = 'fLIB' where id in ($1, $2)", [sq.id, old])

const q1 = await makeVideo('lib-q1.test', 'QueueOne', 91), q2 = await makeVideo('lib-q2.test', 'QueueTwo', 92, true)
const later = new Date(Date.now() + 3600e3).getUTCHours() < 21 ? hm(Date.now() + 3 * 3600e3) : '23:59'
await db.query("update yt_settings set yt_mode = 'autopilot', publish_mode = 'private', publish_time = $1, publish_time2 = null", [later])
await db.query('update meta_settings set per_day = 1, times = $1', [later])
await run()
const qp = Object.fromEntries((await db.query('select id, queue_pos from yt_scripts where id in ($1, $2)', [q1.id, q2.id])).rows.map((x) => [x.id, x.queue_pos]))
check(qp[q1.id] != null && qp[q2.id] != null && qp[q2.id] < qp[q1.id], 'YouTube’s queue puts the “Make it next” video in front', JSON.stringify(qp))
h = await html('/admin/automation/facebook')
check(h.h.indexOf('QueueTwo') > -1 && h.h.indexOf('QueueTwo') < h.h.indexOf('QueueOne'), 'Facebook’s queue does too (though its part number is higher)')

console.log('\n93. The channel ticks')
r = await tick(q1.idea, 'youtube', false)
check(r.s === 200 && r.j.channels.youtube === false && (await one('select queue_pos from yt_scripts where id = $1', [q1.id])).queue_pos == null, 'unticking YouTube takes the video out of YouTube’s queue')
r = await api({ action: 'queue-add', id: q1.id }); check(r.s === 400 && /unticked/.test(r.j.error), 'it can’t be queued for YouTube by hand: “' + r.j.error + '”')
r = await api({ action: 'post-now', id: q1.id, confirm: true }); check(r.s === 400 && /unticked/.test(r.j.error), 'or posted to YouTube now')
await run(); check((await one('select queue_pos from yt_scripts where id = $1', [q1.id])).queue_pos == null, 'Autopilot doesn’t put it back in YouTube’s queue')
r = await tick(q1.idea, 'facebook', false); check(r.s === 400 && /at least one/.test(r.j.error), 'unticking the last channel is refused: “' + r.j.error + '”')
r = await tick(q2.idea, 'facebook', false)
check(r.s === 200 && (await one('select fb from yt_scripts where id = $1', [q2.id])).fb.status === 'off', 'unticking Facebook marks that Short as not for Facebook')
h = await html('/admin/automation/facebook'); check(!h.h.includes('QueueTwo') && h.h.includes('QueueOne'), 'and it leaves Facebook’s queue')
r = await tick(q2.idea, 'facebook', true); check(r.s === 200 && (await one('select fb from yt_scripts where id = $1', [q2.id])).fb == null, 'ticking it again before it posts puts it back')
await tick(q2.idea, 'facebook', false)

// Facebook posts the YouTube-unticked Short: then it's done (copy freed, idea made)
const before = (await fbPosts()).length
await db.query("update meta_posts set at = at - interval '1 day', slot = slot || '-old' where at > now() - interval '2 days'")
await db.query('update meta_settings set per_day = 1, times = $1', [hm(Date.now() - 5 * 60e3)])
let j = await run()
check((await fbPosts()).length === before + 1 && j.facebook && j.facebook.posted === q1.id, 'Facebook posts the Short that’s only for Facebook', JSON.stringify(j.facebook))
check((await pieces(q1.id)) === 0 && (await one('select status from yt_ideas where id = $1', [q1.idea])).status === 'made', 'then its copy is freed and it counts as made (YouTube doesn’t want it)')
r = await tick(q1.idea, 'facebook', false); check(r.s === 400 && /already on Facebook/.test(r.j.error), 'after posting, its Facebook tick is locked: “' + r.j.error + '”')
r = await tick(q1.idea, 'youtube', true); check(r.s === 400 && /freed/.test(r.j.error), 'and YouTube can’t have it now: “' + r.j.error + '”')

// a Short already on YouTube
const q3 = await makeVideo('lib-q3.test', 'QueueThree', 93)
await db.query("update yt_scripts set status = 'uploaded', yt_video_id = 'libvid3', uploaded_at = now(), fb = '{\"status\":\"pending\"}' where id = $1", [q3.id])
r = await tick(q3.idea, 'youtube', false); check(r.s === 400 && /already on YouTube/.test(r.j.error), 'once on YouTube, its YouTube tick is locked')
r = await tick(q3.idea, 'facebook', false)
check(r.s === 200 && (await one('select fb from yt_scripts where id = $1', [q3.id])).fb.status === 'off' && (await pieces(q3.id)) === 0, 'unticking Facebook after YouTube frees the copy kept for Facebook')
r = await tick(q3.idea, 'facebook', true); check(r.s === 400 && /freed/.test(r.j.error), 'and it can’t be ticked again: “' + r.j.error + '”')
await db.query("update yt_scripts set upload = '{\"session\":\"x\"}' where id = $1", [q2.id])
r = await tick(q2.idea, 'youtube', false); check(r.s === 400 && /uploading/.test(r.j.error), 'not while it’s uploading to YouTube')
await db.query('update yt_scripts set upload = null where id = $1', [q2.id])
r = await tick(q2.idea, 'instagram', true); check(r.s === 400, 'Instagram can’t be ticked yet')
r = await api({ action: 'library-channel', id: q2.idea, channel: 'youtube', on: false }, E); check(r.s === 403, 'an editor can’t change ticks')

console.log('\n94. What the Library shows')
h = await html('/admin/automation/library')
check(h.h.includes('QueueOne') && h.h.includes('QueueThree') && h.h.includes('Squoosh'), 'ideas and videos at every stage are listed')
check(h.h.includes('Your idea') && h.h.includes('Not posting') && h.h.includes('Posted'), 'it shows your ideas, and each channel’s status')
check(/libvid3/.test(h.h), 'a Short on YouTube links to it')
h = await html('/admin/automation'); check(h.s === 200, 'the Overview still opens (its count of ready videos respects the ticks)')

// tidy up
await db.query('update yt_settings set yt_mode = $1, publish_mode = $2, publish_time = $3, publish_time2 = $4', [was.yt.yt_mode, was.yt.publish_mode, was.yt.publish_time, was.yt.publish_time2])
await db.query('update meta_settings set per_day = $1, times = $2', [was.meta.per_day, was.meta.times])
for (const id of asideFb) await db.query("update yt_scripts set fb = fb->'was' where id = $1 and fb->>'status' = 'off'", [id])
for (const x of asideSt) await db.query('update yt_scripts set status = $2, render_error = $3 where id = $1', [x.id, x.status, x.render_error])
for (const x of asideQ) await db.query('update yt_scripts set queue_pos = $2 where id = $1', [x.id, x.queue_pos])
await db.query("update yt_scripts set queue_pos = null where id in ($1, $2, $3)", [q1.id, q2.id, q3.id])
console.log(`  (${pass} passed, ${failn} failed)`)
await db.end(); process.exit(failn ? 1 : 0)
