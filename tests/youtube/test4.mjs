// Scripts: writing, checks, repair, edits, approval rules, Autopilot, page and protections.
import pg from 'pg'
const APP = 'http://localhost:3000', G = 'http://localhost:4555', T = process.argv[2], ED = process.argv[3]
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0
const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + extra : '')) } }
const post = (body, t = T) => fetch(APP + '/admin/api/youtube', { method: 'POST', headers: { cookie: '__Host-olex_sess=' + t, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const ideaId = async (name) => (await db.query('select id from yt_ideas where name ilike $1', [name + '%'])).rows[0].id
const scriptOf = async (iid) => (await db.query('select * from yt_scripts where idea_id = $1', [iid])).rows[0]
const failing = (s) => s.checks.filter((c) => !c.ok).map((c) => c.key)
await db.query('delete from yt_scripts'); await db.query("update yt_settings set yt_mode = 'approval' where id = 1")
const pf = await ideaId('PaletteForge'), gl = await ideaId('Gradient Lab'), fp = await ideaId('FontPair'), tl = await ideaId('tldraw')
await db.query("update yt_ideas set status = 'picked', decided_at = now(), script_tried_at = null where id = any($1)", [[pf, gl, fp]])
await db.query("update yt_ideas set status = 'new' where id = $1", [tl])

console.log('\n18. Writing a script: a flawed first draft is caught and repaired')
let r = await post({ action: 'write-script', id: pf }), j = await r.json()
let s = await scriptOf(pf), st = await (await fetch(G + '/_state')).json()
check(r.status === 200 && s && s.status === 'draft', 'PaletteForge’s script is written and waits for your review (Approval mode)', r.status + ' ' + JSON.stringify(j))
check(st.scriptCalls.includes('PaletteForge (repair)'), 'the first draft failed the checks, so the AI was told exactly what to fix')
check(s && !failing(s).length, 'the repaired script passes every check', s && failing(s).join(','))
check(s && s.seconds >= 20 && s.seconds <= 35 && s.script.scenes.length === 8, `runs ${s && s.seconds}s in ${s && s.script.scenes.length} scenes`)
check(s && s.script.scenes[0].type === 'hook' && s.script.scenes.filter((x) => x.type === 'demo').every((x) => x.capture), 'opens with the hook; every scene of the site says what to film')
check(s && s.claims.length && s.claims.every((c) => s.page.toLowerCase().includes(c.quote.toLowerCase())), 'every claim’s quote really appears on the site’s page')
check(s && !/20\d\d/.test(JSON.stringify(s.package)) && s.package.hashtags.includes('#shorts') && s.package.titles.every((t) => t.length <= 60), 'title, description and hashtags pass: no year, under 60 characters, #shorts')
check(s && s.script.scenes.every((x) => x.id && x.type && x.pose && x.text) && s.script.site.url, 'saved in the factory’s format (id, type, pose, line per scene, plus the site)')

console.log('\n19. A script that still fails waits for you')
r = await post({ action: 'write-script', id: gl }); s = await scriptOf(gl)
check(s && s.status === 'needs_review', 'Gradient Lab’s still-flawed script is marked “Needs your eye”, never approved')
const f = s ? failing(s) : []
check(['hook', 'years', 'numbers', 'claims'].every((k) => f.includes(k)), 'it names each problem: long hook, a year, an unproven number, an unbacked claim', f.join(','))
r = await post({ action: 'approve-script', id: s.id }); check(r.status === 400, 'it can’t be approved by the normal button')

console.log('\n20. Your edits are checked again')
const fixed = s.script.scenes.map((x, i) => ({ text: i === 0 ? 'This free site makes gorgeous gradients in seconds.' : i === 4 ? 'Your designs suddenly look expensive.' : x.text }))
r = await post({ action: 'save-script', id: s.id, edit: { scenes: fixed, titles: ['Gorgeous gradients in seconds, free', 'Designers, bookmark this', 'The free gradient maker'], title: 'Gorgeous gradients in seconds, free' } }); j = await r.json(); s = await scriptOf(gl)
check(r.status === 200 && s.status === 'draft' && !failing(s).length, 'after fixing the lines and titles it passes and is ready', JSON.stringify(j) + ' ' + failing(s))
check(s.claims.length === 1, 'the “2 million designers” claim went with the line that said it')
r = await post({ action: 'approve-script', id: s.id }); j = await r.json(); check(r.status === 200 && j.status === 'approved', 'now Approve works')
r = await post({ action: 'save-script', id: s.id, edit: { scenes: s.script.scenes.map((x, i) => ({ text: i === 4 ? 'The best tool of 2027.' : x.text })) } }); s = await scriptOf(gl)
check(s.status === 'needs_review' && !s.approved_at && failing(s).includes('years'), 'editing an approved script into a failing one takes the approval away')

console.log('\n21. Approve anyway (your call, confirmed)')
r = await post({ action: 'write-script', id: fp }); s = await scriptOf(fp)
r = await post({ action: 'approve-script', id: s.id, force: true }); j = await r.json()
check(r.status === 200 && j.status === 'approved', '“Approve anyway” works for a script that didn’t pass')

console.log('\n22. When the site is down')
const down = (await db.query("insert into yt_ideas (key, name, url, source, status, decided_at) values ('down.test', 'Downsite', 'http://down.test:4555/site/down', 'Show HN', 'picked', now()) on conflict (key) do update set status = 'picked' returning id")).rows[0].id
r = await post({ action: 'write-script', id: down }); j = await r.json()
check(r.status === 400 && /didn’t load/.test(j.error) && !(await scriptOf(down)), 'a clear message, and no script is written without the page to check against', j.error)
await db.query('delete from yt_ideas where id = $1', [down])

console.log('\n23. Autopilot')
await db.query("update yt_settings set yt_mode = 'autopilot' where id = 1")
await db.query("update yt_ideas set status = 'picked', decided_at = now(), script_tried_at = null where id = $1", [tl])
await db.query("update yt_idea_runs set last_run = now() where id = 1")                 // ideas aren't due, so the run writes a script
let res = await fetch(APP + '/api/assistant/cron?run=due', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } }); j = await res.json()
s = await scriptOf(tl)
check(res.status === 200 && s && s.status === 'approved' && s.approved_at, 'the frequent run writes the next picked idea’s script, and a passing one is approved by itself', JSON.stringify(j).slice(0, 160))
const calls = (await (await fetch(G + '/_state')).json()).scriptCalls.filter((x) => /tldraw/.test(x)).length
res = await fetch(APP + '/api/assistant/cron?run=due', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } }); j = await res.json()
const calls2 = (await (await fetch(G + '/_state')).json()).scriptCalls.filter((x) => /tldraw/.test(x)).length
check(!j.script && calls2 === calls, 'and it doesn’t write it twice')
await db.query("update yt_settings set yt_mode = 'approval' where id = 1")

console.log('\n24. The Scripts page')
res = await fetch(APP + '/admin/youtube?view=scripts', { headers: { cookie: '__Host-olex_sess=' + T } }); let html = (await res.text()).replace(/<!-- -->/g, '')
check(res.status === 200 && html.includes('Gradient Lab') && html.includes('PaletteForge') && html.includes('the site’s own words'), 'shows each script, its storyboard and the quotes behind its claims')
check(html.includes('Approve anyway') && html.includes('Needs your eye') && html.includes('film: homepage'), 'shows “Needs your eye”, “Approve anyway” and what to film for each scene')

console.log('\n25. Protections')
r = await post({ action: 'write-script', id: pf }, ED); check(r.status === 403, 'an editor can’t write or approve scripts')
r = await post({ action: 'save-script', id: 1, edit: { description: 'x'.repeat(25000) } }); check(r.status === 400, 'an oversized edit is refused')
r = await post({ action: 'approve-script', id: '1; drop table' }); check(r.status === 400, 'a malformed id is refused')
r = await post({ action: 'write-script', id: tl + 99999 }); j = await r.json(); check(r.status === 400 && /Pick the idea/.test(j.error), 'an idea that isn’t picked can’t get a script')

console.log(`\n${pass} passed, ${failn} failed`)
await db.end(); process.exit(failn ? 1 : 0)
