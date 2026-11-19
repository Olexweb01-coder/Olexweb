// Install 33: every video is "You build it" in 3D (10 worlds, no repeats within three days), one main YouTube video a day,
// everything else replaced in the plan; Storylines instead of Ideas; the websites found become the Directory's New tools (5 to
// 10 a day); no page says where a post or tool came from.
import pg from 'pg'
import { createHmac, createHash, randomBytes } from 'node:crypto'
const APP = 'http://localhost:3000', G = 'http://localhost:4555'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0; const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + String(extra).slice(0, 400) : '')) } }
const u = (await db.query("select id from admin_users where email = 'owner@test.local'")).rows[0], T = randomBytes(32).toString('base64url')
await db.query("insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '1 day')", [createHash('sha256').update(T).digest('hex'), u.id])
const api = async (path, b) => { const r = await fetch(APP + path, { method: 'POST', headers: { cookie: '__Host-olex_sess=' + T, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const html = async (p, auth = true) => (await (await fetch(APP + p, { headers: auth ? { cookie: '__Host-olex_sess=' + T } : {} })).text()).replace(/<!-- -->/g, '')
const run = async () => (await (await fetch(APP + '/api/assistant/cron?run=due', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } })).json())
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0]
const all = async (sql, p = []) => (await db.query(sql, p)).rows
const state = async () => (await fetch(G + '/_state')).json()
const signed = (path, body) => { const buf = Buffer.from(JSON.stringify(body)), ts = Math.floor(Date.now() / 1000), h = createHash('sha256').update(buf).digest('hex')
  return fetch(APP + path, { method: 'POST', headers: { 'x-factory-sig': ts + '.' + createHmac('sha256', process.env.FACTORY_SECRET).update(`${ts}\nPOST\n${path}\n${h}`).digest('hex'), 'Content-Type': 'application/json' }, body: buf }) }
const lagosDay = (ms = Date.now()) => new Date(ms + 3600e3).toISOString().slice(0, 10)
const lagosHM = (ms) => new Date(ms + 3600e3).toISOString().slice(11, 16)

await db.query("update yt_scripts set status = 'uploaded' where status in ('rendering', 'approved', 'draft', 'needs_review', 'rendered', 'failed')")
await db.query('delete from plan_slots'); await db.query("update yt_settings set plan_on = true, yt_mode = 'approval', publish_mode = 'private', publish_time = '20:11', publish_time2 = '21:11', publish_time3 = null")
await db.query("update meta_settings set enabled = true, per_day = 1, times = '13:00', video_days = null, story_on = false, paused_reason = null, paused_at = null")
await db.query("update yt_idea_runs set last_run = now(), running_until = null")
await db.query("update dir_entries set tale_id = 1 where kind = 'alert'")                                  // no fresh alert: no scam story is planned
await fetch(G + '/_set?fbBlock=false&chainBad=true&chainBadDone=false&chainN=0')

console.log('\n240. Every video is a "You build it" chain in 3D, one main video a day on YouTube')
let r = await run()
for (let k = 0; k < 12 && (await one("select count(*)::int n from plan_slots where script_id is null and status = 'planned'")).n; k++) r = await run()
const slots = await all("select p.*, s.kind, s.status as st, s.script, s.package, s.checks from plan_slots p left join yt_scripts s on s.id = p.script_id where p.status = 'planned' order by p.day, p.time, p.channel")
check(slots.filter((s) => s.channel === 'youtube').every((s) => s.time === '20:11'), 'YouTube gets one main video a day, at the first posting time (not also 21:11)', slots.filter((s) => s.channel === 'youtube').map((s) => s.time).join(','))
check(slots.length >= 3 && slots.every((s) => s.format === 'chain' && s.script && s.script.format === 'chain' && s.script.chain.steps.length >= 12), 'every planned video is a chain (no fixed worlds, no stories, no Poor vs Rich)', slots.map((s) => s.format + ':' + (s.script || {}).topic).join(','))
check(new Set(slots.map((s) => s.script.topic)).size === slots.length, 'every one is a different topic')
const c0 = slots[0].script.chain.steps
check(/^Congratulations! You just built/.test(c0[c0.length - 2].line) && c0[c0.length - 1].line === 'Follow to build the next one.' && c0.slice(0, -2).every((x) => x.ops.length), 'each ends on “Congratulations! You just built…”, then “Follow…”, and every line shows something')
const cp = (await state()).chainPrompts || []
check(cp.length >= 2 && /YOUR LAST CHAIN failed/.test(cp[1]) && /problems/.test(cp[1]), 'a chain with no problems in it was sent back and written again', cp.length)
check(cp.slice(2).some((p) => /It must NOT be any of these, already made: [^\n]*a car engine \d/.test(p)), 'each new one is told every topic already made, so none repeats')
check(slots.every((s) => ['draft', 'needs_review'].includes(s.st)), 'on Approval each waits for you')

console.log('\n241. The Plan and Storylines show them')
let h = await html('/admin/automation/plan')
check(h.includes('You build it') && h.includes('What it turns out to be: a car engine') && slots.some((s) => h.includes(s.package.title.replace('…', '…'))), 'the Plan shows each one’s title and what it turns out to be')
h = await html('/admin/youtube?view=ideas')
check(h.includes('Coming up on YouTube') && h.includes('How every video works') && !/Hacker News|Show HN|evergreen/i.test(h), 'YouTube → Storylines shows what’s coming and how it works, with no talk of where websites came from')

console.log('\n242. The factory gets the chain to build')
const y = slots[0]
r = await api('/admin/api/youtube', { action: 'plan-approve', id: y.id }); r = await run()
check((await one('select status from yt_scripts where id = $1', [y.script_id])).status === 'rendering', 'approved, then sent to the factory', JSON.stringify(r.factory || r.errors))
const jr = await signed('/api/factory/job?id=' + y.script_id, {}), job = await jr.json()
check(jr.status === 200 && job.kind === 'story' && job.mode === 'explain' && job.format === 'chain' && job.chain.steps.length === y.script.chain.steps.length && job.chain.hook, 'the job: the chain, its lines and what happens on screen', JSON.stringify(job).slice(0, 300))

console.log('\n243. The old plan is cleaned up by itself')
const fut = Date.now() + 26 * 3600e3, fday = lagosDay(fut)
const old = await one("insert into yt_scripts (status, kind, script, package) values ('draft', 'story', '{\"mode\":\"explain\",\"format\":\"build\",\"world\":\"cable\"}', '{\"title\":\"Old fixed world\"}') returning id")
await db.query("delete from plan_slots where channel = 'youtube' and day = $1 and time = '21:11'", [fday])
const ex = await one("insert into plan_slots (channel, day, time, format, status) values ('youtube', $1, '21:11', 'chain', 'planned') returning id", [fday])
const fbs = await one("select id from plan_slots where channel = 'facebook' and status = 'planned' and day >= $1 order by day limit 1", [fday])
if (fbs) await db.query("update plan_slots set format = 'build', script_id = $2 where id = $1", [fbs.id, old.id])
r = await run(); for (let k = 0; k < 3; k++) r = await run()
check((await one('select status from plan_slots where id = $1', [ex.id])).status === 'skipped', 'a second YouTube time already planned is left empty (one main video a day)')
const healed = fbs ? await one('select p.format, s.script from plan_slots p left join yt_scripts s on s.id = p.script_id where p.id = $1', [fbs.id]) : null
check(!fbs || (healed.format === 'chain' && !(await one('select 1 from yt_scripts where id = $1', [old.id])) && (!healed.script || healed.script.format === 'chain')), 'a planned fixed-world build is replaced by a chain', JSON.stringify(healed && healed.format))

console.log('\n244. Swap gives a new topic')
const sl = await one("select p.id, s.script->>'topic' as w from plan_slots p join yt_scripts s on s.id = p.script_id where p.status = 'planned' and s.status <> 'rendering' order by p.day desc, p.time desc limit 1")
r = await api('/admin/api/youtube', { action: 'plan-swap', id: sl.id })
const sw = await one("select p.format, s.script->>'topic' as w from plan_slots p join yt_scripts s on s.id = p.script_id where p.id = $1", [sl.id])
check(r.s === 200 && sw && sw.format === 'chain' && sw.w !== sl.w, `swapped: ${sl.w} → ${sw && sw.w}`, JSON.stringify(r.j))

console.log('\n245. New tools in the Directory, 5 to 10 a day')
await db.query("update dir_settings set tools_per_day = 10, auto_publish = true, kinds = 'tool,story,update,guide,alert'")
await db.query("delete from dir_entries where slug like 'nt-%'")
for (let k = 0; k < 3; k++) await db.query("insert into dir_entries (slug, name, url, kind, status, category, content, quality) values ($1, $2, $3, 'tool', 'ready', 'design', $4, '{\"score\": 80}')",
  ['nt-' + k, 'NewTool' + k, 'https://newtool' + k + '.test', JSON.stringify({ title: 'NewTool' + k + ': makes pictures', oneLiner: 'Makes pictures from words.', summary: 'A tool.', facts: [], pricing: { status: 'free' } })])
const nowHM = lagosHM(Date.now()), TT = '07:30,09:00,10:30,12:00,13:30,15:00,16:30,18:00,19:30,21:00'.split(','), dueT = [...TT].reverse().find((t) => t <= nowHM)
r = await run()
const pub = await one("select slug, slot from dir_entries where slug like 'nt-%' and status = 'live'")
if (dueT && Date.parse(lagosDay() + 'T' + dueT + ':00Z') - 3600e3 > Date.now() - 3 * 3600e3) check(pub && pub.slot === lagosDay() + ' t' + dueT, `at its tool time (${dueT}) the next new tool goes live`, JSON.stringify([pub, r.directory, r.errors]))
else check(true, 'no tool time due right now (it is outside 07:30 to midnight Lagos)')
h = await html('/admin/directory')
check(h.includes('New tools today') && h.includes('New tools a day') && (h.match(/sm-time/g) || []).length >= 10, 'Directory admin: today’s tool times, and how many a day')
r = await api('/admin/api/directory', { action: 'simple-settings', toolsPerDay: 5 })
check(r.s === 200 && (await one('select tools_per_day from dir_settings')).tools_per_day === 5, 'set to 5 a day')
await db.query("update dir_entries set status = 'live', published_at = now() where slug like 'nt-%'")
await html('/tools', false); await new Promise((r) => setTimeout(r, 2500))      // a cached page is served once more while it refreshes
h = await html('/tools', false)
check(/New tools today|Newest tools/.test(h) && h.includes('NewTool0') && h.includes('/tools/nt-0'), 'olexweb.com/tools opens with the new tools')

console.log('\n246. No page says where a post or tool came from')
await db.query("delete from dir_entries where slug = 'src-test'")
await db.query("insert into dir_entries (slug, name, url, kind, status, source_name, content, published_at) values ('src-test', 'Big phone update', 'https://www.theverge.com/x', 'update', 'live', 'The Verge', $1, now())",
  [JSON.stringify({ title: 'Big phone update', summary: 'Phones get a big update this week for everyone.', points: ['One'], whatToDo: ['Update'], facts: [{ claim: 'The update is out now.', quote: 'Secret quoted sentence from the article' }], faq: [] })])
h = await html('/updates/src-test', false)
check(h.includes('The update is out now.') && !h.includes('The Verge') && !h.includes('theverge.com') && !h.includes('Secret quoted sentence') && !/reporting by|isBasedOn|own words/.test(h), 'a post shows its facts, but never the outlet, its link or the quotes', (h.match(/.{40}(Verge|reporting by|isBasedOn).{40}/) || [''])[0])
await html('/tools', false); await new Promise((r) => setTimeout(r, 2500)); h = await html('/tools', false); check(!h.includes('The Verge') && !/against its source/.test(h), 'the Directory list doesn’t show it either')
await html('/updates', false); await new Promise((r) => setTimeout(r, 2500)); h = await html('/updates', false); check(!h.includes('The Verge') && !/Checked against the source/.test(h), 'nor the Tech updates list')
const feed = await (await fetch(APP + '/feed.xml')).text(); check(!feed.includes('The Verge') && !/against its source/.test(feed), 'nor the feed')
await db.query("delete from dir_entries where slug in ('src-test') or slug like 'nt-%'"); await db.query("update dir_entries set tale_id = null where tale_id = 1")

if (!process.env.KEEP) { await db.query("update yt_scripts set status = 'uploaded' where status in ('rendering', 'approved', 'draft', 'needs_review', 'rendered')"); await db.query('delete from plan_slots'); await db.query('update yt_settings set plan_on = false, publish_time2 = null'); await db.query('update dir_settings set tools_per_day = 0') }
console.log(`\npassed: ${pass}`); if (failn) console.log(`failed: ${failn}`)
await db.end(); process.exit(failn ? 1 : 0)
