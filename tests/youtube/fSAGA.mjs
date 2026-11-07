// Install 13: the long story (his whole day in chapters, the main video), Shorts cut from it that link to it, the five formats
// taking turns, Facebook's own version of each story, Reel views for the posting agent, the Series box only for classic,
// and today's slot counting a video scheduled the day before.
import pg from 'pg'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
const APP = 'http://localhost:3000', G = 'http://localhost:4555', FAC = '/home/claude/olexweb-factory'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0; const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + String(extra).slice(0, 300) : '')) } }
const sess = async (e) => { const u = (await db.query('select id from admin_users where email = $1', [e])).rows[0], t = randomBytes(32).toString('base64url'); await db.query("insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '1 day')", [createHash('sha256').update(t).digest('hex'), u.id]); return t }
const T = await sess('owner@test.local')
const api = async (b) => { const r = await fetch(APP + '/admin/api/youtube', { method: 'POST', headers: { cookie: '__Host-olex_sess=' + T, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const html = async (path) => (await (await fetch(APP + path, { headers: { cookie: '__Host-olex_sess=' + T }, redirect: 'manual' })).text()).replace(/<!-- -->/g, '')
const run = async () => (await (await fetch(APP + '/api/assistant/cron?run=due', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } })).json())
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0]
const state = async () => (await fetch(G + '/_state')).json()
const metas = async () => (await (await fetch(G + '/_metas')).json()).metas
const hm = (ms) => new Date(ms + 3600e3).toISOString().slice(11, 16)        // Lagos clock
const SITES = [['saga-a.test', 'Squoosh', 'squoosh'], ['saga-b.test', 'tldraw', 'tldraw'], ['saga-c.test', 'Shotcut AI', 'shotcut'], ['saga-d.test', 'Gradient Lab', 'gradientlab'], ['saga-e.test', 'CSS masonry', 'masonry']]
const idea = async (key, name, site, status = 'picked', score = 70) => (await one(`insert into yt_ideas (key, name, url, what, why, source, status, score, decided_at) values ($1, $2, $3, 'a handy site', 'it saves time', 'test', $4, $5, now() - interval '1 day')
  on conflict (key) do update set status = $4, score = $5, rewrites = 0 returning id`, [key, name, `http://${site}.test:4555/site/${site}`, status, score])).id
const worker = (id, step) => execFileSync('node', ['worker/run.mjs', '--id', String(id), '--step', step], { cwd: FAC, env: process.env }).toString()
const mp4 = (file, w, h, secs) => execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `testsrc=size=${w}x${h}:rate=24:duration=${secs}`, '-f', 'lavfi', '-i', `sine=frequency=440:duration=${secs}`, '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', file])

// YouTube connected (with uploads), as the earlier phases do it; Facebook posting off until its own section
{ const c = await fetch(APP + '/admin/api/youtube/connect', { headers: { cookie: '__Host-olex_sess=' + T }, redirect: 'manual' }), loc = c.headers.get('location') || ''
  const stt = decodeURIComponent((loc.match(/[?&]state=([^&]*)/) || [])[1] || ''), back = (await fetch(loc, { redirect: 'manual' })).headers.get('location')
  await fetch(back, { headers: { cookie: 'olex_yt_state=' + encodeURIComponent(stt) }, redirect: 'manual' }) }
await db.query('update meta_settings set enabled = false')
// (a re-run: nothing left from an earlier one)
await db.query("delete from yt_scripts where kind = 'saga' or idea_id in (select id from yt_ideas where key like 'saga-%' or key like 'fmt-%')")
await db.query("delete from audit_log where action = 'yt_saga_skipped'")
// a clean stage: nothing else waiting or rendering, on Approval, new Shorts classic
await db.query("update yt_ideas set status = 'passed' where status in ('picked', 'new') and id not in (select idea_id from yt_scripts where idea_id is not null)")
await db.query("update yt_scripts set status = 'uploaded' where status in ('rendering', 'approved', 'draft', 'needs_review', 'rendered')")
await db.query("update yt_settings set yt_mode = 'approval', short_style = 'classic', format_turn = 0, saga_turn = 0, long_count = 5, publish_mode = 'private'")
await db.query('update post_agent set enabled = false')

console.log('\n120. The Series box is only for the classic style')
let h = await html('/admin/youtube?view=scripts')
check(h.includes('Series (classic Shorts and long videos only)'), 'classic: the box says “Series (classic Shorts and long videos only)”')
let r = await api({ action: 'short-style', style: 'story' }); h = await html('/admin/youtube?view=scripts')
const st0 = await one('select long_days from yt_settings')
check(r.s === 200 && !h.includes('Series (classic') && h.includes('The long story') && h.includes('Write today’s long story now') && h.includes('The five formats take turns'), 'story style: the Series box is hidden; the long story has its own controls')
check(st0.long_days === 'sun,mon,tue,wed,thu,fri,sat', 'switching to story makes the long story daily (the main video)', st0.long_days)

console.log('\n121. The five formats take turns')
const f1 = await idea('fmt-1.test', 'Masonry', 'masonry'); await api({ action: 'write-story', id: f1 })
const f2 = await idea('fmt-2.test', 'Squoosh', 'squoosh'); await api({ action: 'write-story', id: f2 })
const s1 = await one('select script from yt_scripts where idea_id = $1', [f1]), s2 = await one('select script from yt_scripts where idea_id = $1', [f2])
check(s1.script.format === 'stop-paying' && s2.script.format === 'tested', 'one Short is “Stop paying for this”, the next “I tested it so you don’t have to”', s1.script.format + ', ' + s2.script.format)
check(s1.script.story.ask && /\?/.test(s1.script.story.ask), 'each story also has Facebook’s ending: a question to the viewers', s1.script.story.ask)
await db.query('delete from yt_scripts where idea_id in ($1, $2)', [f1, f2]); await db.query("update yt_ideas set status = 'passed' where id in ($1, $2)", [f1, f2])

console.log('\n122. Today’s long story')
r = await api({ action: 'write-saga' }); check(r.s === 400 && /at least 4 sites/.test(r.j.error || ''), 'too few sites: it says so', r.j.error)
const ids = []; for (const [k, n, site] of SITES) ids.push(await idea(k, n, site))
r = await api({ action: 'write-saga' })
const saga = await one("select id, status, script, package, checks, seconds, items from yt_scripts where kind = 'saga' order by id desc limit 1")
check(r.s === 200 && saga && saga.status === 'draft' && r.j.chapters === 5, 'written: 5 chapters, waiting for your review (Approval)', JSON.stringify(r.j).slice(0, 200))
const B = saga.script.story.beats, sc = B.map((b) => b.scene)
check(sc[0] === 'intro' && sc.at(-1) === 'outro' && sc.filter((x) => x === 'chapter').length === 5 && sc.filter((x) => x === 'again').length === 4 && sc.filter((x) => x === 'yell').length === 5, 'hello, a title card and a story per chapter, a line leading into each next chapter, goodbye')
check(B.every((b) => Number.isInteger(b.ch)) && B.find((b) => b.scene === 'reveal' && b.ch === 2).props.pill === 'shotcut.test:4555', 'every beat knows its chapter, and each chapter’s own site')
check(saga.checks.every((c) => c.ok) && saga.seconds >= 180 && saga.seconds <= 600, `its checks pass, about ${Math.round(saga.seconds / 6) / 10} minutes`, JSON.stringify(saga.checks))
check(saga.script.format === 'stop-paying' && saga.package.title.includes('Stopped Paying') && saga.script.chapters[0].time === '8:15 AM', 'in the format whose turn it is, with a clock time per chapter', saga.package.title)
check((await one('select saga_turn from yt_settings')).saga_turn === 1 && (await one("select count(*)::int n from yt_long_items where script_id = $1", [saga.id])).n === 5, 'the next long story takes the next format; these 5 sites are used up')
const shorts = (await db.query('select id, idea_id, kind, status, script, checks, seconds, parent_id from yt_scripts where parent_id = $1 order by id', [saga.id])).rows
check(shorts.length === 3 && shorts.every((x) => x.kind === 'story' && x.status === 'draft' && x.script.story.beats.at(-1).scene === 'again' && x.seconds <= 36 && x.checks.every((c) => c.ok)), '3 Shorts cut from it, each a complete story with its loop, passing every check', JSON.stringify(shorts.map((x) => [x.seconds, x.checks.filter((c) => !c.ok).map((c) => c.key)])))
check(shorts[0].script.from.chapter === 1 && shorts[0].idea_id === ids[0] && shorts[0].script.story.ask, 'each knows which chapter it came from, and has Facebook’s question')
h = await html('/admin/youtube?view=scripts')
check(h.includes('>Long story</span>') && h.includes('Chapter 1: Disaster 1 · 8:15 AM · Squoosh') && h.includes('cut from a long story (chapter 1)'), 'the Scripts tab shows the long story by chapter, and where each Short came from')
r = await api({ action: 'save-script', id: saga.id, edit: { title: 'My worst day, saved by websites', titles: saga.package.titles, description: saga.package.description, hashtags: saga.package.hashtags } })
check(r.s === 200 && (await one('select package from yt_scripts where id = $1', [saga.id])).package.title === 'My worst day, saved by websites', 'you can choose its title')

console.log('\n123. The factory gets the long story')
await api({ action: 'approve-script', id: saga.id })
await db.query("update yt_scripts set status = 'rendering', render_started_at = now() where id = $1", [saga.id])
let out = worker(saga.id, 'job'), job = JSON.parse(fs.readFileSync(FAC + '/work/job.json', 'utf8'))
check(job.kind === 'saga' && job.chapters.length === 5 && job.chapters[1].site.url.includes('tldraw') && /long story, 5 chapters/.test(out), 'kind “saga”, with its 5 chapters and their sites', out.trim().split('\n').pop())
// its timing, as the voice step would write it, then a finished video (1280×720) sent back with YouTube chapters
let t = 0; const timing = { fps: 24, beats: job.story.beats.map((b) => { const d = b.text ? 2 : 1.5, x = { start: t, end: t + d }; t += d + 0.3; return x }), secs: t, amp: [] }
fs.writeFileSync(FAC + '/work/story.json', JSON.stringify(timing)); fs.mkdirSync(FAC + '/out', { recursive: true }); mp4(FAC + '/out/video.mp4', 1280, 720, 6); fs.rmSync(FAC + '/out/video_fb.mp4', { force: true })
out = worker(saga.id, 'upload'); let v = await one('select status, video from yt_scripts where id = $1', [saga.id])
check(v.status === 'rendered' && v.video.width === 1280 && v.video.chapters.length === 7 && v.video.chapters[1].title === 'Disaster 1' && v.video.chapters.at(-1).title === 'Your pick?', 'it comes back 1280×720 with its chapters (Intro, 5 chapters, Your pick?)', JSON.stringify(v.video.chapters).slice(0, 200))

console.log('\n124. Shorts wait for the long story, then link to it')
await db.query("update yt_scripts set status = 'approved' where parent_id = $1", [saga.id])
const sh = shorts[0].id
await db.query("update yt_scripts set status = 'rendering', render_started_at = now() where id = $1", [sh]); worker(sh, 'job')
const sjob = JSON.parse(fs.readFileSync(FAC + '/work/job.json', 'utf8'))
check(sjob.kind === 'story' && !sjob.fb, 'without Facebook set up, a story is made once (no Facebook version)')
mp4(FAC + '/out/video.mp4', 720, 1280, 3); worker(sh, 'upload')
await db.query("update yt_settings set yt_mode = 'autopilot'"); await db.query("update yt_settings set saga_time = $1", ["23:59"])   // later today (Lagos), whatever the hour
await run(); let q1 = await one('select queue_pos from yt_scripts where id = $1', [sh])
check(q1.queue_pos == null, 'while the long story isn’t on YouTube yet, its Shorts aren’t queued')
await db.query("update yt_settings set saga_time = $1", [hm(Date.now() - 60e3)])
let j = await run(); const up = await one('select status, yt_video_id, upload from yt_scripts where id = $1', [saga.id]), M1 = await metas()
check(up.status === 'uploaded' && up.upload.lane === 'saga' && up.upload.slot.endsWith(' saga'), 'at its own time the long story goes up (its own lane, not a Short’s slot)', JSON.stringify(j.uploadedLong || j.errors).slice(0, 200))
q1 = await one('select queue_pos from yt_scripts where id = $1', [sh])
check(q1.queue_pos != null, 'once it’s up, its Shorts join the queue')
r = await api({ action: 'post-now', id: sh, confirm: true }); const last = (await metas()).at(-1)
const desc = last && last.snippet && last.snippet.description || ''
check(r.s === 200 && desc.startsWith('Watch my whole day: https://youtu.be/' + up.yt_video_id), 'a Short cut from it points to the whole day first in its description', r.s + ' ' + JSON.stringify(r.j).slice(0, 150) + ' ' + desc.slice(0, 120))
const sagaDesc = M1.find((x) => x && /Chapters\n0:00 Intro/.test(x.snippet.description))
check(!!sagaDesc && /Free guides|1\. Disaster 1: Squoosh/.test(sagaDesc.snippet.description), 'the long story’s description lists the chapters with times', sagaDesc && sagaDesc.snippet.description.slice(0, 160))
h = await html('/admin/automation')
check(h.includes('Long story'), 'the Today tab shows the long story')

console.log('\n125. Facebook gets its own version')
const page = async (url, cookie) => { const x = await fetch(url, { headers: { cookie }, redirect: 'manual' }); return { s: x.status, h: await x.text() } }
if (!(await one('select 1 as x from meta_pages where selected'))) {
  const c = await fetch(APP + '/admin/api/meta/connect', { headers: { cookie: '__Host-olex_sess=' + T }, redirect: 'manual' }), sc2 = 'olex_meta_state=' + c.headers.get('set-cookie').match(/olex_meta_state=([^;]+)/)[1]
  await page((await fetch(c.headers.get('location'), { redirect: 'manual' })).headers.get('location'), sc2)
}
await db.query("update meta_settings set enabled = true, paused_at = null, paused_reason = null, per_day = 1, times = $1", [hm(Date.now() - 5 * 60e3)])
await db.query("delete from meta_posts where at > now() - interval '2 days'")
const sh2 = shorts[1].id
await db.query("update yt_scripts set status = 'rendering', render_started_at = now() where id = $1", [sh2]); worker(sh2, 'job')
const fjob = JSON.parse(fs.readFileSync(FAC + '/work/job.json', 'utf8'))
check(fjob.fb && fjob.fb.ask.scene === 'ask' && /\?/.test(fjob.fb.ask.text), 'with Facebook on, the job asks for Facebook’s version too (the question ending)', JSON.stringify(fjob.fb))
mp4(FAC + '/out/video.mp4', 720, 1280, 3); mp4(FAC + '/out/video_fb.mp4', 720, 1280, 4); worker(sh2, 'upload')
v = await one('select status, video from yt_scripts where id = $1', [sh2]); const fbBytes = fs.statSync(FAC + '/out/video_fb.mp4').size
check(v.status === 'rendered' && v.video.fb && v.video.fb.bytes === fbBytes && v.video.fb.base === 500, 'both come back: Facebook’s version is kept beside the main video', JSON.stringify(v.video.fb))
await db.query("update yt_scripts set fb = null, queue_pos = null where id = $1", [sh2]); await db.query("update yt_scripts set fb = '{\"status\":\"skipped\"}' where id <> $1 and (fb is null or fb->>'status' not in ('posted', 'skipped'))", [sh2])
j = await run(); const F = await (await fetch(G + '/_fb')).json(), lastUp = F.uploads.at(-1)
check(j.facebook && j.facebook.posted === sh2 && lastUp && lastUp.bytes === fbBytes, 'the Reel posted is Facebook’s own version, byte for byte', JSON.stringify(j.facebook))
const fbs = await one('select fb from yt_scripts where id = $1', [sh2]); check(fbs.fb.version === 'facebook', 'and it’s marked as Facebook’s version')
fs.rmSync(FAC + '/out/video_fb.mp4', { force: true })

console.log('\n126. Reel views for the posting agent')
await db.query("update meta_posts set at = now() - interval '5 days', views = null, views_at = null"); await db.query("insert into meta_posts (script_id, video_id, at, slot) values (null, 'fbold1', now() - interval '12 days', 'x1'), (null, 'fbold2', now() - interval '14 days', 'x2'), (null, 'fbold3', now() - interval '16 days', 'x3'), (null, 'fbnew2', now() - interval '6 days', 'x4'), (null, 'fbnew3', now() - interval '7 days', 'x5')")
await fetch(G + '/_set?insightsDenied=true')
await db.query("update post_agent set enabled = true, reviewed_at = now() - interval '8 days', reviews = 2, per_day = 1 where platform = 'facebook'")
await db.query("update post_agent set enabled = false where platform = 'youtube'")
j = await run(); let ag = await one("select note from post_agent where platform = 'facebook'"), ms = await one('select insights from meta_settings')
check(ms.insights === 'denied' && /read_insights/.test(ag.note), 'Meta doesn’t allow reading Reel views: it says how to allow it, and stays careful', ag.note)
await fetch(G + '/_set?insightsDenied=false&reelViewsAll=120'); await db.query("update meta_settings set insights = null, insights_at = null"); await db.query("update post_agent set reviewed_at = now() - interval '8 days' where platform = 'facebook'")
j = await run(); ag = await one("select note from post_agent where platform = 'facebook'"); const read = (await one('select count(*)::int n from meta_posts where views = 120')).n
check(read >= 5 && (await one('select insights from meta_settings')).insights === 'ok', `once allowed, each Reel’s plays are read 3 days on (${read} read)`)
check(/views per video|results held|not clear enough|fewer than 3 days/.test(ag.note), 'and the agent judges Facebook from real views, like YouTube', ag.note)
await db.query("update post_agent set enabled = false")

console.log('\n127. Autopilot writes the long story by itself')
await db.query("update yt_scripts set status = 'uploaded' where status in ('rendering', 'approved', 'draft', 'needs_review', 'rendered')")
await db.query("update yt_scripts set created_at = now() - interval '1 day' where kind = 'saga'")
await db.query("delete from audit_log where action = 'yt_saga_skipped'")                    // the early “too few sites” try waits 3 hours; this is a new day
const ids2 = []; for (const [k, n, site] of [['saga-f.test', 'Squoosh', 'squoosh'], ['saga-g.test', 'BadChapter', 'tldraw'], ['saga-h.test', 'Shotcut AI', 'shotcut'], ['saga-i.test', 'Gradient Lab', 'gradientlab']]) ids2.push(await idea(k, n, site))
await idea('saga-j.test', 'CSS masonry', 'masonry', 'new', 75)                               // a strong new find: Autopilot may use it
const w0 = (await state()).scriptCalls || []
j = await run(); const sg2 = await one("select id, status, script from yt_scripts where kind = 'saga' order by id desc limit 1")
check(sg2 && sg2.id !== saga.id && ['approved', 'rendering'].includes(sg2.status) && sg2.script.chapters.length === 4 && !sg2.script.chapters.some((c) => /BadChapter/.test(c.site.name)), 'on a long-story day it writes it by itself: the chapter that failed its checks is left out, 4 remain', JSON.stringify(j.long || j.errors).slice(0, 200) + ' ' + JSON.stringify(sg2 && sg2.script.chapters.map((c) => c.site.name)))
check(sg2.script.chapters.some((c) => c.site.name === 'CSS masonry') && (await one("select status from yt_ideas where key = 'saga-j.test'")).status === 'picked', 'a strong new find was picked for it (no one has to pick 5 ideas a day)')
check(sg2.script.format === 'tested', 'the next format: “I tested it so you don’t have to”', sg2.script.format)
check(((await state()).scriptCalls || []).length === w0.length, 'in story style, picked ideas aren’t made into Shorts one by one: the long story uses them')

console.log('\n128. A video scheduled the day before counts for today')
await db.query("update yt_settings set publish_mode = 'scheduled', publish_time = $1, publish_time2 = null, publish_time3 = null", [hm(Date.now() + 2 * 3600e3)])
const today = new Date(Date.now() + 3600e3).toISOString().slice(0, 10)
await db.query(`update yt_scripts set uploaded_at = now() - interval '20 hours', upload = jsonb_build_object('slot', $1::text, 'publishAt', $2::text, 'privacy', 'private') where id = $3`, [today + ' ' + hm(Date.now() + 2 * 3600e3), new Date(Date.now() + 2 * 3600e3).toISOString(), sh])
h = await html('/admin/automation')
const row = h.slice(h.indexOf(hm(Date.now() + 2 * 3600e3)), h.indexOf(hm(Date.now() + 2 * 3600e3)) + 600)
check(row.includes('Scheduled') && !row.includes('No video ready for this time yet'), 'today’s time shows the video scheduled for it, not “Empty”', row.replace(/<[^>]+>/g, ' ').slice(0, 200))

// clean up
await db.query("update yt_settings set publish_mode = 'private', short_style = 'classic', yt_mode = 'autopilot', long_days = 'tue,fri'")
await db.query("update yt_scripts set status = 'uploaded' where status in ('rendering', 'approved', 'draft', 'needs_review', 'rendered')")
console.log(`  (${pass} passed, ${failn} failed)`)
await db.end(); process.exit(failn ? 1 : 0)
