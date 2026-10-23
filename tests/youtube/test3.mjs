// Ideas: find, verify, gates, coverage, scores, no repeats, lock, decisions, page, daily run, back-off.
import pg from 'pg'
const APP = 'http://localhost:3000', G = 'http://localhost:4555', T = process.argv[2], ED = process.argv[3]
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0
const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + extra : '')) } }
const post = (body, t = T, origin = APP) => fetch(APP + '/admin/api/youtube', { method: 'POST', headers: { cookie: '__Host-olex_sess=' + t, ...(origin ? { Origin: origin } : {}), 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const idea = async (name) => (await db.query('select * from yt_ideas where name ilike $1', [name + '%'])).rows
await db.query('delete from yt_ideas'); await db.query('update yt_idea_runs set last_run = null, last_report = null, running_until = null where id = 1')

console.log('\n11. Find ideas')
let r = await post({ action: 'find-ideas' }, ED); check(r.status === 403, 'an editor cannot run it')
r = await post({ action: 'find-ideas' }, T, null); check(r.status === 403, 'refused without this site’s Origin')
r = await post({ action: 'find-ideas' }); let j = await r.json()
check(r.status === 200 && j.saved >= 4, `the search ran: ${j.found} found, ${j.new} new, ${j.loaded} loaded live, ${j.saved} kept (${j.seconds}s)`, JSON.stringify(j))
const pf = await idea('PaletteForge'), fm = await idea('FreeMovies'), ck = await idea('Clicky'), sq = await idea('Squoosh'), tl = await idea('tldraw'), ms = await idea('Chrome ships')
check(pf.length === 1 && pf[0].status === 'new', 'a real, useful tool is kept (and its ?ref=hn duplicate counted once)')
check(pf[0] && pf[0].score === 86, 'its score follows the weights exactly: 86/100', pf[0] && pf[0].score)
check(fm.length === 1 && fm[0].status === 'passed', 'a piracy site is turned down, never shown (kept only so it isn’t judged again)')
check(ck.length === 1 && ck[0].status === 'passed', 'a thin toy with no real value is turned down')
check(!(await db.query("select 1 from yt_ideas where url like '%/site/down%' or url like '%doesnotexist%'")).rowCount, 'a dead site and an AI-invented address never get in')
check(sq[0] && sq[0].coverage && sq[0].coverage.big === 3 && sq[0].scores.fresh === 3 && sq[0].score === 78, 'heavily covered on YouTube (3 big videos) → “fresh” drops to 3, score 78', sq[0] && JSON.stringify([sq[0].coverage, sq[0].scores, sq[0].score]))
check(tl[0] && tl[0].coverage && tl[0].coverage.videos === 0 && tl[0].scores.fresh === 10, 'nobody covered it → fresh 10/10')
check(ms.length === 1, 'a tech update viewers can actually use is considered too')
check(pf[0] && pf[0].hook && pf[0].what && pf[0].why, 'each idea has an opening line, a plain description and the reason it’s worth it')
const gl = await idea('Gradient Lab'), fp = await idea('FontPair')
check(gl.length === 1 && gl[0].source === 'Mock Picks' && gl[0].signal === 'Recommended by Mock Picks', 'a find from a curated feed is kept, credited to the feed (read from the full text, not the short summary)')
check(!(await db.query("select 1 from yt_ideas where url ~ 'youtube\\.com|feeds\\.test'")).rowCount, 'links to YouTube and to the feed’s own pages are never treated as finds')
const cre = (await db.query("select count(*)::int n from yt_ideas where status = 'new' and category = 'creativity'")).rows[0].n
check(cre === 2, 'variety: at most 2 of one kind per search (3 strong creativity ideas → 2 kept)', cre)
check(fp.length === 0, 'the one held back for variety is not thrown away: it gets another chance next search')

console.log('\n12. The next run never repeats')
const before = (await (await fetch(G + '/_state')).json()).judged.length
await db.query('update yt_idea_runs set last_run = null where id = 1')
r = await post({ action: 'find-ideas' }); j = await r.json()
const st = await (await fetch(G + '/_state')).json()
check(r.status === 200 && j.saved === 1 && (await idea('FontPair')).length === 1, 'nothing already seen is saved again; only the variety-held idea comes back, now there’s room (' + j.found + ' found, ' + j.saved + ' saved)', JSON.stringify(j))
const again = st.judged.slice(before)
check(again.length === 1 && /FontPair/.test(again[0]), 'only the variety-held idea is judged again; nothing else is re-sent to the AI', JSON.stringify(again))

console.log('\n13. Two searches at once')
await db.query('delete from yt_ideas where name ilike \'tldraw%\'')
const [a, b] = await Promise.all([post({ action: 'find-ideas' }), post({ action: 'find-ideas' })])
const codes = [a.status, b.status].sort(), msgs = [await a.json(), await b.json()]
check(codes[0] === 200 && codes[1] === 400 && msgs.some((m) => /already running/.test(m.error || '')), 'the second one is told a search is already running', JSON.stringify(codes))

console.log('\n14. Pick and skip')
r = await post({ action: 'decide', id: pf[0].id, status: 'picked' }); j = await r.json()
check(r.status === 200 && j.status === 'picked', '“Make a video” moves it to Picked')
r = await post({ action: 'decide', id: fm[0].id, status: 'picked' }); check(r.status === 400, 'a turned-down idea can’t be picked by tampering with the request')
r = await post({ action: 'decide', id: 'x', status: 'picked' }); check(r.status === 400, 'nonsense is refused')
r = await post({ action: 'decide', id: sq[0].id, status: 'skipped' }); check(r.status === 200, 'Skip works')

console.log('\n15. The Ideas page')
let res = await fetch(APP + '/admin/youtube?view=ideas', { headers: { cookie: '__Host-olex_sess=' + T } }); let html = await res.text()
check(res.status === 200 && html.includes('tldraw') && html.includes('Chrome ships') && !html.includes('FreeMovies') && !html.includes('Clicky'), 'New shows only kept ideas, never the turned-down ones')
check(html.includes('Fresh on YouTube') && html.includes('Nobody on YouTube covered this'), 'shows the score breakdown and the YouTube check')
res = await fetch(APP + '/admin/youtube?view=ideas&status=picked', { headers: { cookie: '__Host-olex_sess=' + T } }); html = await res.text()
check(html.includes('PaletteForge') && html.includes('86'), 'Picked shows PaletteForge with its score')
res = await fetch(APP + '/admin/youtube', { headers: { cookie: '__Host-olex_sess=' + T } }); html = await res.text()
check(html.includes('Analytics') && html.includes('Ideas') && res.status === 200, 'the Analytics tab still works, with both tabs')

console.log('\n16. Daily, by itself')
await db.query('update yt_idea_runs set last_run = null where id = 1')
res = await fetch(APP + '/api/assistant/cron?run=due', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } }); j = await res.json()
check(res.status === 200 && j.ideas && typeof j.ideas.found === 'number', 'the frequent run finds ideas when a day has passed', JSON.stringify(j).slice(0, 200))
res = await fetch(APP + '/api/assistant/cron?run=due', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } }); j = await res.json()
check(!j.ideas, 'and not again on the next run the same day')

console.log('\n17. When every AI is busy')
await fetch(G + '/_set?aiDown=true'); await db.query('update yt_idea_runs set last_run = null where id = 1'); await db.query("delete from yt_ideas where status = 'passed'")
r = await post({ action: 'find-ideas' }); j = await r.json()
const lr = (await db.query("select extract(epoch from now() - last_run)/3600 as h, last_report from yt_idea_runs where id = 1")).rows[0]
check(r.status === 400 && j.error, 'a clear message: “' + (j.error || '').slice(0, 90) + '”')
check(Math.round(lr.h) === 20, 'it waits about two hours before the daily search tries again (not every few minutes)', lr.h)
await fetch(G + '/_set?aiDown=false')

console.log(`\n${pass} passed, ${failn} failed`)
await db.end(); process.exit(failn ? 1 : 0)
