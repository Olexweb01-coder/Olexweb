// Speed and live progress: parallel stages, every stage reported, honest countdown that learns, protections.
import pg from 'pg'
const APP = 'http://localhost:3000', G = 'http://localhost:4555', T = process.argv[2], ED = process.argv[3]
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0
const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + extra : '')) } }
const post = (body, t = T) => fetch(APP + '/admin/api/youtube', { method: 'POST', headers: { cookie: '__Host-olex_sess=' + t, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const prog = async (kind, t = T) => { const r = await fetch(APP + '/admin/api/youtube?progress=' + kind, { headers: { cookie: '__Host-olex_sess=' + t } }); return [r.status, r.status === 200 ? (await r.json()).progress : null] }
async function watch(kind, start) {            // run a job while reading its progress every 250 ms, like the admin does
  const seen = []; let done = false
  const job = start().then(async (r) => { done = true; return [r.status, await r.json()] })
  while (!done) { const [, s] = await prog(kind); if (s) seen.push({ ...s, t: Date.now() }); await new Promise((r) => setTimeout(r, 250)) }
  const [, last] = await prog(kind); seen.push({ ...last, t: Date.now() })
  return { result: await job, seen }
}
const fresh = async () => { await db.query("delete from yt_ideas where status in ('new', 'passed')"); await db.query('update yt_idea_runs set last_run = null, running_until = null where id = 1') }

console.log('\n26. Faster: sites opened side by side')
await fresh(); await db.query('delete from yt_jobs')
await fetch(G + '/_set?siteDelay=900&aiDelay=1200')
let { result, seen } = await watch('ideas', () => post({ action: 'find-ideas' }))
const fin = seen[seen.length - 1], sites = fin.stages.find((s) => s.key === 'sites')
check(result[0] === 200 && fin.finished && !fin.error, `the search finished: ${result[1].loaded} sites loaded, ${result[1].saved} kept, in ${fin.elapsed}s`, JSON.stringify(result))
check(sites.secs < 3.4, `opening ${result[1].new} sites that each take 0.9–2.7s took ${sites.secs}s, the slowest one’s time (one after another would take about ${(result[1].new * 1.8).toFixed(1)}s)`)

console.log('\n27. Live progress, stage by stage')
const order = [...new Set(seen.filter((s) => s.stage).map((s) => s.stage))]
const ORDER = ['sources', 'sites', 'judge', 'youtube', 'save']
check(order.every((k, i) => i === 0 || ORDER.indexOf(k) > ORDER.indexOf(order[i - 1])) && order.length >= 3 && fin.stages.every((s) => s.secs != null), 'stages arrived in order (seen live: ' + order.join(' → ') + '), and every stage finished')
const siteCounts = seen.filter((s) => s.stage === 'sites').map((s) => s.done)
check(siteCounts.length >= 2 && siteCounts.some((n, i) => i && n > siteCounts[i - 1]), 'the site count went up while you watched: ' + [...new Set(siteCounts)].join(', ') + ' of ' + (seen.find((s) => s.stage === 'sites') || {}).total)
check(fin.bytes > 1000, `download size counted: ${fin.bytes} bytes`)
check(fin.stages.every((s) => typeof s.secs === 'number'), 'each stage’s time is recorded: ' + fin.stages.map((s) => s.key + ' ' + s.secs + 's').join(', '))
check(seen.every((s) => typeof s.eta === 'number'), 'there was always a countdown')

console.log('\n28. The countdown learns')
const hist = (await db.query("select history from yt_jobs where kind = 'ideas'")).rows[0].history
check(Math.abs(hist.sites - sites.secs) < 0.01 && hist.judge > 1, 'each stage’s real time is remembered for next time: ' + JSON.stringify(hist))
await fresh()
;({ result, seen } = await watch('ideas', () => post({ action: 'find-ideas' })))
const first = seen.find((s) => !s.finished && s.eta != null), took = seen[seen.length - 1].elapsed
check(first && Math.abs(first.eta + first.elapsed - took) <= Math.max(3, took * 0.35), `the second run’s first countdown said ${first && first.eta}s; it took ${took}s`)

console.log('\n29. Script writing shows its steps')
await fetch(G + '/_set?siteDelay=0&aiDelay=900')
const tl = (await db.query("select id from yt_ideas where name ilike 'tldraw%'")).rows[0]
if (tl) { await db.query('delete from yt_scripts where idea_id = $1', [tl.id]); await db.query("update yt_ideas set status = 'picked' where id = $1", [tl.id]) }
;({ result, seen } = await watch('script', () => post({ action: 'write-script', id: tl.id })))
let f = seen[seen.length - 1]
check(result[0] === 200 && f.finished && f.stages.find((s) => s.key === 'repair').skipped, 'a first draft that passes: the repair step is shown as not needed')
const pf = (await db.query("select id from yt_ideas where name ilike 'PaletteForge%'")).rows[0]
await db.query('delete from yt_scripts where idea_id = $1', [pf.id]); await db.query("update yt_ideas set status = 'picked' where id = $1", [pf.id])
;({ result, seen } = await watch('script', () => post({ action: 'write-script', id: pf.id })))
f = seen[seen.length - 1]
check(result[0] === 200 && f.stages.find((s) => s.key === 'repair').secs > 0 && seen.some((s) => s.stage === 'repair' && /claims|years|hook|numbers/.test(s.note)), 'a draft that needs fixing: the repair step shows what it’s fixing')

console.log('\n30. Protections and honesty')
let [st] = await prog('ideas', ED); check(st === 403, 'an editor can’t read progress')
;[st] = await prog('../etc'); check(st === 400, 'only known jobs can be read')
const r0 = await fetch(APP + '/admin/api/youtube?progress=ideas'); check(r0.status === 401, 'nobody signed out can read it')
await db.query("update yt_jobs set updated_at = now() - interval '7 minutes', state = jsonb_set(state, '{finished}', 'false') where kind = 'ideas'")
const [, stale] = await prog('ideas'); check(stale.stale === true, 'a job whose server stopped reporting is shown as stopped, not spinning forever')
const histBefore = (await db.query("select history from yt_jobs where kind = 'ideas'")).rows[0].history
await fresh(); await fetch(G + '/_set?aiDown=true&siteDelay=0&aiDelay=0')
;({ result, seen } = await watch('ideas', () => post({ action: 'find-ideas' })))
const fl = seen[seen.length - 1], failedStage = fl.stages.find((s) => s.failed)
check(fl.error && failedStage && failedStage.key === 'judge', 'when the AI is busy, the stage it stopped at is marked as failed, not ticked', JSON.stringify(fl.stages))
const histAfter = (await db.query("select history from yt_jobs where kind = 'ideas'")).rows[0].history
check(JSON.stringify(histAfter) === JSON.stringify(histBefore), 'and a failed run doesn’t teach the countdown wrong timings')
await fetch(G + '/_set?aiDown=false')
await fetch(G + '/_set?siteDelay=0&aiDelay=0')

console.log(`\n${pass} passed, ${failn} failed`)
await db.end(); process.exit(failn ? 1 : 0)
