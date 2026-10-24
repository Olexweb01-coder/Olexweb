import pg from 'pg'
import { createHash, randomBytes } from 'node:crypto'
const APP = 'http://localhost:3000'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0
const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + extra : '')) } }
const sess = async (email) => { const u = (await db.query('select id from admin_users where email = $1', [email])).rows[0]; const t = randomBytes(32).toString('base64url'); await db.query("insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '1 day')", [createHash('sha256').update(t).digest('hex'), u.id]); return t }
const T = await sess('owner@test.local'), E = await sess('editor@test.local')
await db.query('delete from aoc_listeners'); await db.query("update site_links set phone = '2347011726321', message = 'Hi Olex, I want Anatomy of Creation 🙌', clicks = 0 where slug = 'me'"); await db.query('delete from site_link_clicks')
await db.query("update aoc_settings set goal = 300, content = '{}' where id = 1")
const adm = (body, t = T) => fetch(APP + '/admin/api/aoc', { method: 'POST', headers: { cookie: '__Host-olex_sess=' + t, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const pub = (body, origin = APP) => fetch(APP + '/api/aoc', { method: 'POST', headers: { ...(origin ? { Origin: origin } : {}), 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.' + (body._ip || 1) }, body: JSON.stringify(body) })

console.log('\n45. olexweb.com/me opens your WhatsApp')
let r = await fetch(APP + '/me', { redirect: 'manual' })
check(r.status === 302 && r.headers.get('location') === 'https://wa.me/2347011726321?text=' + encodeURIComponent('Hi Olex, I want Anatomy of Creation 🙌'), 'it goes straight to your chat with the message ready: ' + r.headers.get('location'))
check(/no-store/.test(r.headers.get('cache-control') || ''), 'never cached, so a changed message works at once')
await fetch(APP + '/me', { redirect: 'manual' })
const l = (await db.query("select clicks from site_links where slug = 'me'")).rows[0], d = (await db.query("select n from site_link_clicks where slug = 'me'")).rows[0]
check(l.clicks === 2 && d.n === 2, 'every tap is counted (2 taps, 2 today)')
r = await adm({ action: 'save-link', phone: '123', message: 'x' }); check(r.status === 400, 'a number without the country code is refused')
r = await adm({ action: 'save-link', phone: '+234 701 172 6321', message: 'Hi Olex, I want the next free course' }, E); check(r.status === 403, 'an editor can’t change it')
r = await adm({ action: 'save-link', phone: '+234 701 172 6321', message: 'Hi Olex, I want the next free course' }); r = await fetch(APP + '/me', { redirect: 'manual' })
check(r.headers.get('location') === 'https://wa.me/2347011726321?text=' + encodeURIComponent('Hi Olex, I want the next free course'), 'change the message in the admin: the same link now opens with the new one')
await adm({ action: 'save-link', phone: '2347011726321', message: 'Hi Olex, I want Anatomy of Creation 🙌' })

console.log('\n46. olexweb.com/aoc, open like a shared folder')
let html = (await (await fetch(APP + '/aoc')).text()).replace(/<!-- -->/g, '')
check(html.includes('Anatomy of Creation') && !/spots claimed|of 300/.test(html), 'the page shows the course, with no counter (that stays in your admin)')
const fs = await import('node:fs')
for (let n = 1; n <= 4; n++) {
  const f = `/home/claude/Olexweb/public/aoc/anatomy-of-creation-part-${n}.m4a`, size = fs.statSync(f).size
  const a = await fetch(APP + `/aoc/anatomy-of-creation-part-${n}.m4a`), buf = Buffer.from(await a.arrayBuffer())
  const rg = await fetch(APP + `/aoc/anatomy-of-creation-part-${n}.m4a`, { headers: { Range: 'bytes=1000-1999' } })
  check(a.status === 200 && /audio\/(mp4|x-m4a|aac)/.test(a.headers.get('content-type') || '') && buf.length === size && rg.status === 206, `Part ${n} is served whole (${(size / 1048576).toFixed(1)} MB, ${a.headers.get('content-type')}) and can be skipped through (partial requests work)`)
}
{ const f = '/home/claude/Olexweb/public/aoc/anatomy-of-creation-full-course.m4a', size = fs.statSync(f).size
  const a = await fetch(APP + '/aoc/anatomy-of-creation-full-course.m4a'), buf = Buffer.from(await a.arrayBuffer())
  check(a.status === 200 && buf.length === size, `the full course is served as one file (${(size / 1048576).toFixed(1)} MB)`) }
for (const t of ['Why you were never meant to be a user', 'The Eye: where every creation begins', 'The Question you can’t leave alone', 'Giving your idea a body', 'Keeping it alive, for good']) if (!html.includes(t.replace('’', '&#x27;')) && !html.includes(t)) console.log('    missing: ' + t)
check(['Why you were never meant to be a user', 'Giving your idea a body', 'Keeping it alive, for good'].every((t) => html.includes(t)) && html.includes('/aoc/photo.webp') && html.includes('/aoc/bulb.svg') && html.includes('og.jpg'), 'the flyer’s five lessons are on the page, with the live hero (photo, bulb) and the WhatsApp link preview')
check(/<a href="\/">View full website/.test(html) && html.includes('href="#learn"') && html.includes('href="#access"') && html.includes('Creator’s Room') && html.includes('class="foot"'), 'the Olexweb header (with “View full website” → olexweb.com) and footer are there')
check(html.replace(/\\"/g, '"').includes('"peaks":['), 'each recording’s real waveform is sent with the page')
check(!html.includes('<audio id="anAudio"') && !html.includes('class="foot-copy"') && !html.includes('class="foot-legal"'), 'a standalone page: no site menu, footer or anthem on screen')
r = await pub({ action: 'join', name: 'Ada Okafor', consent: false }); check(r.status === 400, 'without the tick, it asks for it')
r = await pub({ action: 'join', name: 'A', consent: true }); check(r.status === 400, 'a name is needed')
r = await pub({ action: 'join', name: 'Ada Okafor', consent: true }, null); check(r.status === 403, 'refused from other websites')
r = await pub({ action: 'join', name: '  Ada   <b>Okafor</b> ', consent: true }); let j = await r.json()
check(r.status === 200 && j.token && j.name === 'Ada Okafor', 'name and tick: in, with the name cleaned (“' + j.name + '”)')
const tok = j.token
html = (await (await fetch(APP + '/aoc')).text()).replace(/<!-- -->/g, ''); check(!/of 300/.test(html), 'still no counter on the page after someone joins')
r = await pub({ action: 'track', token: tok, part: 'part1', event: 'dance' }); check(r.status === 400, 'unknown events are refused')
r = await pub({ action: 'track', token: tok, part: 'nope', event: 'play' }); check(r.status === 400, 'unknown parts are refused')
for (const [part, event] of [['part1', 'play'], ['part1', 'finish'], ['part2', 'download'], ['part4', 'play'], ['full', 'download']]) await pub({ action: 'track', token: tok, part, event })
const pr = (await db.query('select progress from aoc_listeners where token = $1', [tok])).rows[0].progress
check(pr.part1 && pr.part1.play && pr.part1.finish && pr.part2.download && pr.part4.play && pr.full.download, 'listening is recorded: Part 1 played and finished, Part 2 downloaded, Part 4 started, the full course downloaded')
r = await pub({ action: 'feedback', token: tok, text: 'no' }); check(r.status === 400, '“What did you learn?” needs a few words')
r = await pub({ action: 'feedback', token: 'bad', text: 'Creation starts with a question.' }); check(r.status === 400, 'feedback from an unknown browser is refused')
r = await pub({ action: 'feedback', token: tok, text: 'Creation starts with a question I can’t leave alone.' }); check(r.status === 200, 'what they learned is saved')
let lim = 0; for (let i = 0; i < 21; i++) { const x = await pub({ action: 'join', name: 'Spam ' + i, consent: true, _ip: 9 }); if (x.status === 400) lim++ }
check(lim >= 1, 'a flood of sign-ups from one connection is slowed down (after 20 an hour)')
await db.query("delete from aoc_listeners where name like 'Spam %'")

console.log('\n47. Your admin: Course & links')
r = await fetch(APP + '/admin/aoc', { headers: { cookie: '__Host-olex_sess=' + E }, redirect: 'manual' }); check(r.status >= 300 && r.status < 400, 'only you can open it (an editor is sent elsewhere)')
html = (await (await fetch(APP + '/admin/aoc', { headers: { cookie: '__Host-olex_sess=' + T } })).text()).replace(/<!-- -->/g, '')
check(html.includes('olexweb.com/me') && html.includes('Ada Okafor') && html.includes('1 of 300') && html.includes('Export (CSV)'), 'shows the WhatsApp link, the taps, everyone who joined, “1 of 300” and the export')
r = await adm({ action: 'save-content', content: { title: 'Anatomy of Creation', parts: [{ key: 'welcome', title: 'Welcome', file: 'javascript:alert(1)' }], goal: 300 } }); check(r.status === 400, 'a dangerous file address is refused')
r = await adm({ action: 'save-content', content: { title: 'Anatomy of Creation', tagline: 'Free', intro: 'Hi', goal: 500, parts: [{ key: 'welcome', title: 'Welcome: User or Creator?', file: '/aoc/00-welcome.mp3' }, { key: 'part1', title: 'Part One: The Question', file: '/aoc/01.mp3' }], map: { title: 'The Creation Map', file: '/aoc/map.pdf' } } })
const adminHtml = (await (await fetch(APP + '/admin/aoc', { headers: { cookie: '__Host-olex_sess=' + T } })).text()).replace(/<!-- -->/g, '')
console.log('\n48. “300 slots only, then it closes”')
const have = (await db.query('select count(*)::int n from aoc_listeners')).rows[0].n
await db.query('update aoc_settings set goal = $1, close_when_full = true where id = 1', [have])
r = await pub({ action: 'join', name: 'Latecomer', consent: true, _ip: 7 }); j = await r.json()
let pg2 = (await (await fetch(APP + '/aoc')).text()).replace(/<!-- -->/g, '')
check(r.status === 400 && /slots have been taken/.test(j.error || '') && /"closed":true/.test(pg2.replace(/\\"/g, '"')), 'when the slots are full, new people are told “All ' + have + ' slots have been taken” and the page shows it')
r = await pub({ action: 'track', token: tok, part: 'part1', event: 'play' }); const kj = await r.json(); check(r.status === 200 && kj.ok, 'people who already joined keep their access', r.status + ' ' + JSON.stringify(kj))
await db.query('update aoc_settings set close_when_full = false where id = 1')
r = await pub({ action: 'join', name: 'Latecomer', consent: true, _ip: 7 }); check(r.status === 200, 'switch “close when full” off, and it stays open')
await db.query("delete from aoc_listeners where name = 'Latecomer'"); await db.query('update aoc_settings set close_when_full = true where id = 1')
check(r.status === 200 && adminHtml.includes('of 500'), 'course content and the number of spots are edited from the admin (the count shows there only)')
r = await adm({ action: 'remove', id: (await db.query('select id from aoc_listeners limit 1')).rows[0].id }); check(r.status === 200 && (await db.query('select count(*)::int n from aoc_listeners')).rows[0].n === 0, 'you can remove a name')
await db.query("update aoc_settings set goal = 300, content = '{}' where id = 1")
console.log(`\n${pass} passed, ${failn} failed`)
await db.end(); process.exit(failn ? 1 : 0)
