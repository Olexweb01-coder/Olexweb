// Install 12: story Shorts. The writer tries 10 situations and writes the best in the story shape; code checks the hook, the
// loop, the length, every line's feeling and every fact about the site; Autopilot mends or replaces; a test story waits for
// you while new Shorts are classic; the factory gets a 'story' job.
import pg from 'pg'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
const APP = 'http://localhost:3000', G = 'http://localhost:4555'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0; const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + String(extra).slice(0, 300) : '')) } }
const sess = async (e) => { const u = (await db.query('select id from admin_users where email = $1', [e])).rows[0], t = randomBytes(32).toString('base64url'); await db.query("insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '1 day')", [createHash('sha256').update(t).digest('hex'), u.id]); return t }
const T = await sess('owner@test.local'), E = await sess('editor@test.local')
const api = async (b, t = T) => { const r = await fetch(APP + '/admin/api/youtube', { method: 'POST', headers: { cookie: '__Host-olex_sess=' + t, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const html = async (path) => (await (await fetch(APP + path, { headers: { cookie: '__Host-olex_sess=' + T }, redirect: 'manual' })).text()).replace(/<!-- -->/g, '')
const run = async () => (await (await fetch(APP + '/api/assistant/cron?run=due', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } })).json())
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0]
const idea = async (key, name) => (await one("insert into yt_ideas (key, name, url, what, source, status, decided_at) values ($1, $2, 'http://masonry.test:4555/site/masonry', 'a handy site', 'test', 'picked', now() - interval '1 day') on conflict (key) do update set status = 'picked', rewrites = 0, risks = null, script_tried_at = null returning id", [key, name])).id
const script = (ideaId) => one('select id, kind, status, script, package, claims, checks, seconds, hold_until from yt_scripts where idea_id = $1', [ideaId])
// a clean stage: no other picked ideas waiting, nothing rendering, on Approval, new Shorts classic
await db.query("update yt_ideas set status = 'passed' where status = 'picked' and id not in (select idea_id from yt_scripts where idea_id is not null)")
await db.query("update yt_settings set yt_mode = 'approval', short_style = 'classic'")
await db.query("update yt_scripts set status = 'uploaded' where status in ('rendering', 'approved', 'draft', 'needs_review')")
await db.query('update post_agent set enabled = false')

console.log('\n110. The controls')
let h = await html('/admin/youtube?view=scripts')
check(h.includes('New Shorts') && h.includes('Story (sketch)') && /aria-checked="true"[^>]*>Classic|Classic<\/button>/.test(h) && h.includes('Write a test story'), 'Scripts tab: “New Shorts: Story (sketch) · Classic”, classic by default, with “Write a test story”')
let r = await api({ action: 'short-style', style: 'story' }, E); check(r.s === 403, 'an editor can’t switch it')
r = await api({ action: 'short-style', style: 'loud' }); check(r.s === 400, 'an unknown style is refused')
r = await api({ action: 'write-story' }); check(r.s === 400 && /no picked idea/i.test(r.j.error || ''), 'no picked idea: it says so', r.j.error)

console.log('\n111. A test story, written and checked')
const i1 = await idea('story-one.test', 'Masonry')
r = await api({ action: 'write-story' }); let s = await script(i1)
check(r.s === 200 && s && s.kind === 'story' && s.status === 'draft', 'written as a story (on Approval it waits for review)', JSON.stringify(r.j).slice(0, 200))
const beats = s.script.story.beats
check(beats.length === 11 && beats[0].scene === 'yell' && beats[1].scene === 'timejump' && beats.at(-1).scene === 'again', 'the story shape: yell, 3 minutes earlier … the loop')
check(s.checks.every((c) => c.ok) && ['shape', 'hook', 'loop', 'length', 'feelings', 'claims', 'facts', 'named'].every((k) => s.checks.some((c) => c.key === k)), 'every story check ran and passed', JSON.stringify(s.checks.filter((c) => !c.ok)))
check(s.seconds >= 18 && s.seconds <= 36, `about ${s.seconds} seconds`)
check(s.script.ideas.length === 10 && s.script.chosen === 3, 'it tried 10 situations and wrote the best (#4, 19/30)')
check(beats[4].props.message.big === 'TODAY' && beats[9].props.stamp === 'CANCELLED' && beats[1].props.label[1] === 'EARLIER' && beats[8].props.cards.length === 2, 'the phone, the stamp, the time jump and the proof cards are set')
check(s.script.scenes.length === 11 && s.script.scenes[0].type === 'story-yell', 'its lines are listed for the Scripts tab too')
h = await html('/admin/youtube?view=scripts')
check(h.includes('>Story</span>') && h.includes('The peak (opens the video)') && h.includes('The 10 situations it considered'), 'the card shows it’s a story, each beat, and the 10 situations')

console.log('\n112. Editing a story')
const e0 = { scenes: s.script.scenes.map((x) => ({ text: x.text })), title: s.package.title, titles: s.package.titles, description: s.package.description, hashtags: s.package.hashtags }
e0.scenes[2].text = 'Day thirty of my free trial. I feel great!'
r = await api({ action: 'save-script', id: s.id, edit: e0 }); s = await script(i1)
check(r.s === 200 && s.script.story.beats[2].text === 'Day thirty of my free trial. I feel great!' && s.script.scenes[2].text === s.script.story.beats[2].text && s.status === 'draft', 'a changed line goes into the story; checks still pass')
e0.scenes[0].text = 'No no no no this cannot be happening to me right now!'
r = await api({ action: 'save-script', id: s.id, edit: e0 }); s = await script(i1)
check(s.status === 'needs_review' && s.checks.some((c) => c.key === 'hook' && !c.ok), 'a long opening yell fails the hook check (the peak, 7 words at most)')
e0.scenes[0].text = 'No! No no no no!'; await api({ action: 'save-script', id: s.id, edit: e0 })

console.log('\n113. The factory gets a story job')
await api({ action: 'approve-script', id: s.id })
await db.query("update yt_scripts set status = 'rendering', render_started_at = now() where id = $1", [s.id])
const out = execFileSync('node', ['worker/run.mjs', '--id', String(s.id), '--step', 'job'], { cwd: '/home/claude/olexweb-factory', env: process.env }).toString()
const job = JSON.parse(fs.readFileSync('/home/claude/olexweb-factory/work/job.json', 'utf8'))
check(job.kind === 'story' && job.story.beats.length === 11 && job.site.url.includes('masonry') && /story Short( \(\+ Facebook version\))?, 11 beats/.test(out), 'the worker receives kind “story” with its 11 beats', out.trim().split('\n').pop())

console.log('\n114. A test story waits for you')
await db.query(`update yt_scripts set status = 'rendered', video = '{"pieces":1,"bytes":1000,"seconds":24}', queue_pos = null where id = $1`, [s.id])
await run(); let q1 = await one('select queue_pos from yt_scripts where id = $1', [s.id])
check(q1.queue_pos == null, 'while new Shorts are classic, a finished story isn’t queued by itself')
r = await api({ action: 'short-style', style: 'story' }); await db.query("update yt_settings set yt_mode = 'autopilot'"); await run(); q1 = await one('select queue_pos from yt_scripts where id = $1', [s.id])
check(r.s === 200 && q1.queue_pos != null, 'once you switch new Shorts to story, it joins the queue')
h = await html('/admin/youtube?view=scripts'); check(!h.includes('Write a test story') && h.includes('Every new Short is a story'), 'and the Scripts tab says every new Short is a story')
await db.query("update yt_scripts set status = 'uploaded', queue_pos = null where id = $1", [s.id])

console.log('\n115. Autopilot: mended, or written again')
const i2 = await idea('story-fix.test', 'FixStory')
r = await api({ action: 'write-script', id: i2 }); let s2 = await script(i2)
check(s2 && s2.kind === 'story' && s2.status === 'approved', 'with new Shorts on story, “Write script” writes a story; on Autopilot a passing one is approved', s2 && s2.status)
const calls = (await (await fetch(G + '/_state')).json()).storyCalls || []
check(calls.includes('FixStory (repair)') || s2.checks.every((c) => c.ok), 'a story with a too-long yell gets one repair pass')
const i3 = await idea('story-bad.test', 'BadStory')
r = await api({ action: 'write-script', id: i3 }); const s3 = await script(i3), id3 = await one('select status, rewrites from yt_ideas where id = $1', [i3])
check(!s3 && id3.rewrites === 1 && id3.status === 'picked', 'a story without the opening yell and time jump is thrown away and written again', JSON.stringify(id3))
const k3 = await one("select detail from audit_log where action = 'yt_script_replaced' order by id desc limit 1")
check(k3 && k3.detail.critical.includes('shape'), 'the reason (its shape) is logged')

console.log('\n116. A story waiting an hour')
const i4 = await idea('story-wait.test', 'Masonry')
await api({ action: 'write-story', id: i4 }); let s4 = await script(i4)
await db.query(`update yt_scripts set status = 'needs_review', hold_until = now() - interval '1 minute', checks = '[{"key":"titles","ok":false,"note":"x"}]' where id = $1`, [s4.id])
await run(); s4 = await script(i4)
check(['approved', 'rendering'].includes(s4.status) && s4.checks.every((c) => c.ok), 'small leftovers: it goes ahead after the hour, mended', s4.status)
await db.query("update yt_scripts set status = 'uploaded' where id = $1", [s4.id])

// clean up
await db.query("delete from yt_scripts where idea_id in (select id from yt_ideas where key like 'story-%.test')")
await db.query("delete from yt_ideas where key like 'story-%.test'")
await db.query("update yt_settings set short_style = 'classic', yt_mode = 'autopilot'")
console.log(`  (${pass} passed, ${failn} failed)`)
await db.end(); process.exit(failn ? 1 : 0)
