// Install 28: a portfolio project from a link. Olex AI reads the site and fills the project in (only from what's on it);
// the factory opens it in a real browser and sends back the screenshots; the whole page goes on the project.
import pg from 'pg'
import { execFileSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
const APP = 'http://localhost:3000', G = 'http://localhost:4555', SITE = 'http://bakery.test:4555/site/bakery'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0; const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + String(extra).slice(0, 400) : '')) } }
const u = (await db.query("select id from admin_users where email = 'owner@test.local'")).rows[0], T = randomBytes(32).toString('base64url')
await db.query("insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '1 day')", [createHash('sha256').update(T).digest('hex'), u.id])
const api = async (b) => { const r = await fetch(APP + '/admin/api/portfolio', { method: 'POST', headers: { cookie: '__Host-olex_sess=' + T, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0]
const state = async () => (await fetch(G + '/_state')).json()
const worker = (id, extra = {}) => { try { return execFileSync('node', ['worker/shots.mjs', '--id', String(id)], { cwd: '/home/claude/olexweb-factory', env: { ...process.env, OLEX_API: APP, FACTORY_TEST_HOSTS: 'bakery.test:4555,down.test:4555', ...extra }, timeout: 120000 }).toString() } catch (e) { return 'FAILED ' + (e.stdout || '') + (e.stderr || '') } }
await db.query("delete from projects where url like 'http://bakery.test%' or url like 'http://down.test%'")

console.log('\n200. Paste a link: the project is filled in from the site')
const before = ((await state()).dispatches || []).length
let r = await api({ action: 'from-link', url: SITE })
const P = r.j.id && await one('select * from projects where id = $1', [r.j.id])
check(r.s === 200 && P && P.name === 'Mama’s Bakery' && P.kind === 'Client website' && P.status === 'draft', 'it’s saved as a draft project with the business’s name and type', JSON.stringify(r.j).slice(0, 300))
check(P && /Ibadan/.test(P.text) && P.built.includes('Cake order form') && /order a celebration cake/.test(P.result) && P.role && P.url === SITE, 'description, what was built, the result, your role and the live link are filled in')
const prompt = (await state()).portfolioPrompt || ''
check(/Family bakery in Ibadan since 2009/.test(prompt) && /“Our menu”/.test(prompt) && !/elsewhere\.example/.test(prompt), 'Olex AI read the home page and an inside page (About), with the page’s real headings; never other sites')
check(/No made-up numbers/.test(prompt) && /from what is on the site/.test(prompt), 'it’s told to use only what the site shows, with no made-up numbers')
const job = await one('select * from portfolio_shots where project_id = $1', [r.j.id]), d = ((await state()).dispatches || []).slice(before)
check(job && job.status === 'waiting' && JSON.stringify(job.headings) === JSON.stringify(['Our menu', 'Order a celebration cake']), 'the best sections are chosen from headings really on the page (an invented one is dropped)', JSON.stringify(job && job.headings))
check(d.length === 1 && /shots\.yml/.test(d[0].path) && d[0].body.inputs.id === String(job.id), 'the factory is asked to take the screenshots', JSON.stringify(d))
r = await api({ action: 'shots', id: P.id }); check(r.j.status === 'waiting', 'the project screen shows “Starting the browser…” meanwhile')

console.log('\n201. The factory takes the screenshots')
const out = worker(job.id)
const j2 = await one('select * from portfolio_shots where id = $1', [job.id]), P2 = await one('select image from projects where id = $1', [P.id])
const labels = (j2.shots || []).map((x) => x.label)
check(j2.status === 'done' && labels[0] === 'The whole page' && labels.includes('The first screen') && labels.includes('Section: Our menu') && labels.includes('Section: Order a celebration cake') && labels.includes('On a phone'), 'the whole page, the first screen, the two best sections and the phone view', labels.join(', ') + ' ' + out.slice(-300))
const full = j2.shots[0]
check(full.width === 1440 && full.height > 1200 && j2.shots[1].height === 900, 'the whole page is the full length of the site; the others are one screen', JSON.stringify(j2.shots.map((x) => [x.width, x.height])))
check(P2.image === full.url && /^\/media\/img\/[a-f0-9]{24}\.webp$/.test(full.url), 'the whole page goes on the project straight away')
const wall = (await one('select wall from projects where id = $1', [P.id])).wall, wm = await one('select width, height from media where key = $1', [String(wall).replace('/media/', '')])
check(/^\/media\/img\/[a-f0-9]{24}\.webp$/.test(wall || '') && wm && wm.width === 880 && wm.height === 1924, 'and its top is cut for the homepage wall (880 × 1924)', JSON.stringify([wall, wm]))
let m = await fetch(APP + full.url); check(m.status === 200 && /webp/.test(m.headers.get('content-type') || ''), 'and the picture opens', m.status)
r = await api({ action: 'shots', id: P.id }); check(r.j.status === 'done' && r.j.shots.length === 5, 'the project screen shows all five to choose from')
r = await fetch(APP + '/admin/api/content', { method: 'POST', headers: { cookie: '__Host-olex_sess=' + T, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', type: 'project', id: P.id, data: { ...P, image: j2.shots[2].url } }) })
check(r.status === 200 && (await one('select image from projects where id = $1', [P.id])).image === j2.shots[2].url, 'picking another one saves it like any change')

console.log('\n202. When things go wrong')
r = await fetch(APP + '/api/factory/shot?id=1&label=full&w=10&h=10', { method: 'POST', body: 'x' }); check(r.status === 401, '(only the factory can send pictures)')
r = await api({ action: 'from-link', url: 'not a site at all' }); check(r.s === 400 && /web address|couldn’t be opened/.test(r.j.error), 'a bad address: a plain reason', r.j.error)
r = await api({ action: 'from-link', url: 'http://down.test:4555/site/down' }); check(r.s === 400 && /answered 500/.test(r.j.error), 'a site that’s down: says so', r.j.error)
r = await api({ action: 'from-link', url: 'http://10.0.0.1/' }); check(r.s === 400, 'a private or internal address is refused')
r = await fetch(APP + '/api/factory/shot?id=' + job.id + '&label=full', { method: 'POST', body: 'x' }); check(r.status === 401, 'nobody but the factory can send screenshots')
r = await fetch(APP + '/admin/api/portfolio', { method: 'POST', headers: { Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'from-link', url: SITE }) }); check(r.status === 401, 'nobody signed out can use it')
// the site goes down between reading and screenshots
await db.query("update portfolio_shots set status = 'waiting', shots = '[]', url = 'http://down.test:4555/site/down' where id = $1", [job.id])
worker(job.id)
r = await api({ action: 'shots', id: P.id }); check(r.j.status === 'failed' && /answered 500/.test(r.j.error), 'screenshots that fail say why', JSON.stringify(r.j))
await db.query("update portfolio_shots set url = $2 where id = $1", [job.id, SITE])
r = await api({ action: 'retry-shots', id: P.id }); check(r.s === 200 && r.j.status === 'waiting', 'Try again starts them again'); worker(job.id)
check((await one('select status from portfolio_shots where id = $1', [job.id])).status === 'done', 'and they arrive')
// it mends itself: a failure is started again by the scheduler, up to 3 times, with nothing to press
await db.query("update portfolio_shots set status = 'failed', error = 'the admin kept failing on /api/factory/shot (500)', tries = 0, updated_at = now() - interval '9 minutes' where id = $1", [job.id])
r = await api({ action: 'shots', id: P.id }); check(r.j.status === 'failed' && r.j.retrying === true, 'after a failure the screen says it tries again by itself')
let dn = ((await state()).dispatches || []).length
await fetch(APP + '/api/assistant/cron?run=due', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } })
let jj = await one('select status, tries from portfolio_shots where id = $1', [job.id])
check(jj.status === 'waiting' && jj.tries === 1 && ((await state()).dispatches || []).length === dn + 1, 'and the next scheduler run starts the screenshots again by itself', JSON.stringify(jj))
worker(job.id); check((await one('select status from portfolio_shots where id = $1', [job.id])).status === 'done', 'which arrive')
await db.query("update portfolio_shots set status = 'failed', tries = 3, updated_at = now() - interval '9 minutes' where id = $1", [job.id])
await fetch(APP + '/api/assistant/cron?run=due', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } })
r = await api({ action: 'shots', id: P.id }); check(r.j.status === 'failed' && r.j.retrying === false && (await one('select tries from portfolio_shots where id = $1', [job.id])).tries === 3, 'after 3 tries it stops and shows Try again')
await db.query("update portfolio_shots set status = 'waiting', updated_at = now() - interval '25 minutes' where id = $1", [job.id])
await fetch(APP + '/api/assistant/cron?run=due', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } })
check((await one('select status, error from portfolio_shots where id = $1', [job.id])).status === 'failed', 'screenshots that go quiet for 20 minutes are caught')
const h = await (await fetch(APP + '/admin/projects', { headers: { cookie: '__Host-olex_sess=' + T } })).text(); check(h.includes('Add from a link'), 'the Projects screen has “Add from a link”')

if (!process.env.KEEP) await db.query("delete from projects where url like 'http://bakery.test%'")
console.log(`\npassed: ${pass}`); if (failn) console.log(`failed: ${failn}`)
await db.end(); process.exit(failn ? 1 : 0)
