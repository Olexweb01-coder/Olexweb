import pg from 'pg'
import { createHash, randomBytes } from 'node:crypto'
const APP = 'http://localhost:3000'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0
const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + extra : '')) } }
const sess = async (email) => { const u = (await db.query('select id from admin_users where email = $1', [email])).rows[0]; const t = randomBytes(32).toString('base64url'); await db.query("insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '1 day')", [createHash('sha256').update(t).digest('hex'), u.id]); return t }
const T = await sess('owner@test.local'), E = await sess('editor@test.local')
await db.query('delete from aoc_listeners'); await db.query("update site_links set phone = '2347011726321', message = 'Hi Olex, I want Anatomy of Creation 🙌', clicks = 0 where slug = 'me'"); await db.query('delete from site_link_clicks')
await db.query("update aoc_settings set goal = 100, accepting = true, content = '{}' where id = 1")
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
for (const t of []) if (!html.includes(t.replace('’', '&#x27;')) && !html.includes(t)) console.log('    missing: ' + t)
check(['The hidden strategy behind every creation', 'How to spot ideas worth creating', 'How to start, even when you don’t feel ready', 'How to turn your idea into a real creation', 'How to keep your creation alive'].every((t) => html.includes(t)), 'the new flyer’s five points (00–04) are on the page, word for word')
check(html.includes('Why do some people create') && html.includes('while others only watch?') && html.includes('100% free · no payment') && html.includes('/aoc/card-900.webp') && html.includes('/aoc/card-1600.webp') && html.includes('og.jpg') && html.includes('/aoc/avatar.webp') && !html.includes('photo.webp'), 'the new landing card is the hero, with the flyer’s question, “no payment”, the new link preview and portrait')
check(html.includes('Only 100 slots.') && html.includes('Get in before it closes.') && !/of 100|spots claimed/.test(html), 'at the start it says “Only 100 slots. Get in before it closes.” (no count shown)')
check(/<a href="\/">Main website/.test(html) && html.includes('href="#get"') && html.includes('href="#access"') && /Visit olexweb\.com/.test(html), 'the page’s own header (“Main website” → olexweb.com) and own footer (one olexweb.com link) are there')
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
check(html.includes('Ada Okafor') && html.includes('joined (of 100)') && html.includes('visitors see') && html.includes('Close sign-ups') && ['Overview', 'People', 'Feedback', 'WhatsApp link', 'Course settings'].every((t) => html.includes(t)), 'Course & links opens on Overview: the big numbers, “joined (of 100)”, what visitors see, Close sign-ups, and the five sections')
check(html.includes('started listening') && html.includes('shared what they learned') && html.includes('WhatsApp taps today'), 'the five big numbers are in plain words')
r = await adm({ action: 'save-content', content: { title: 'Anatomy of Creation', parts: [{ key: 'welcome', title: 'Welcome', file: 'javascript:alert(1)' }], goal: 300 } }); check(r.status === 400, 'a dangerous file address is refused')
r = await adm({ action: 'save-content', content: { title: 'Anatomy of Creation', tagline: 'Free', intro: 'Hi', goal: 500, parts: [{ key: 'welcome', title: 'Welcome: User or Creator?', file: '/aoc/00-welcome.mp3' }, { key: 'part1', title: 'Part One: The Question', file: '/aoc/01.mp3' }], map: { title: 'The Creation Map', file: '/aoc/map.pdf' } } })
const adminHtml = (await (await fetch(APP + '/admin/aoc', { headers: { cookie: '__Host-olex_sess=' + T } })).text()).replace(/<!-- -->/g, '')
console.log('\n48. Slots: “Only 100” → “Few spaces left” from 60 → “Bonus spots” after 100 → closed only by hand')
const page = async () => { await new Promise((ok) => setTimeout(ok, 250)); await fetch(APP + '/aoc'); return (await (await fetch(APP + '/aoc')).text()).replace(/<!-- -->/g, '') }
const fill = async (to) => { const now = (await db.query('select count(*)::int n from aoc_listeners')).rows[0].n; for (let i = now; i < to; i++) await db.query("insert into aoc_listeners (token, name) values ($1, 'Seat')", ['seat' + i + Math.random()]) }
await db.query("update aoc_settings set goal = 100, accepting = true where id = 1")
await fill(59); r = await pub({ action: 'join', name: 'Thirtieth', consent: true, _ip: 31 }); let ph = await page()
check(r.status === 200 && ph.includes('Join fast.') && ph.includes('Few spaces left.') && !ph.includes('Only 100 slots.'), 'when the 60th person joins, the page switches to “Join fast. Few spaces left.” straight away')
await fill(99); r = await pub({ action: 'join', name: 'Fiftieth', consent: true, _ip: 32 }); ph = await page()
check(r.status === 200 && ph.includes('Bonus spots opened.') && ph.includes('Join while it’s open.'), 'when the 100th joins, it switches to “Bonus spots opened. Join while it’s open.”')
r = await pub({ action: 'join', name: 'Fifty-first', consent: true, _ip: 33 }); check(r.status === 200, 'it never closes by itself: the 101st person gets in')
r = await adm({ action: 'accepting', on: true }, E); check(r.status === 403, 'only you can close or reopen sign-ups')
r = await adm({ action: 'accepting', on: false }); ph = await page(); const rj = await pub({ action: 'join', name: 'Late', consent: true, _ip: 34 }), jj = await rj.json()
check(r.status === 200 && ph.includes('Sign-ups are closed for now.') && rj.status === 400 && /closed/.test(jj.error || ''), 'Close sign-ups: the page says “Sign-ups are closed for now” at once, and joining is refused')
r = await pub({ action: 'track', token: tok, part: 'part1', event: 'play' }); const kj = await r.json(); check(r.status === 200 && kj.ok, 'people who already joined keep their access while closed', r.status + ' ' + JSON.stringify(kj))
r = await adm({ action: 'accepting', on: true }); ph = await page(); r = await pub({ action: 'join', name: 'Back', consent: true, _ip: 35 })
check(r.status === 200 && ph.includes('Bonus spots opened.'), 'Reopen sign-ups: open again, back to “Bonus spots opened”')
await db.query("delete from aoc_listeners where name in ('Seat', 'Thirtieth', 'Fiftieth', 'Fifty-first', 'Back', 'Late')")
await db.query('update aoc_settings set goal = 70 where id = 1')
const { execSync } = await import('node:child_process'); execSync('PGPASSWORD=olex psql -h localhost -U olex -d olexweb -q -f /home/claude/Olexweb/db/schema.sql', { stdio: 'ignore' })
check((await db.query('select goal from aoc_settings')).rows[0].goal === 70, 'the one-time switch to 100 never runs again: re-running the database setup keeps your own number (70 here)')
await db.query('update aoc_settings set goal = 100 where id = 1')
check(r.status === 200 && adminHtml.includes('joined (of 500)'), 'course content and the number of spots are edited from the admin (the count shows there only)')
r = await adm({ action: 'remove', id: (await db.query('select id from aoc_listeners limit 1')).rows[0].id }); check(r.status === 200 && (await db.query('select count(*)::int n from aoc_listeners')).rows[0].n === 0, 'you can remove a name')
await db.query("update aoc_settings set goal = 100, accepting = true, content = '{}' where id = 1")
console.log(`\n${pass} passed, ${failn} failed`)
await db.end(); process.exit(failn ? 1 : 0)
