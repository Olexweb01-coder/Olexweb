// Pages & links: addresses, drafts, publishing, sign-ups and stages, audio access, short links, AI that never invents facts
import pg from 'pg'
import { createHash, randomBytes } from 'node:crypto'
const APP = 'http://localhost:3000'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0; const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + String(extra).slice(0, 200) : '')) } }
const sess = async (e) => { const u = (await db.query('select id from admin_users where email = $1', [e])).rows[0], t = randomBytes(32).toString('base64url'); await db.query("insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '1 day')", [createHash('sha256').update(t).digest('hex'), u.id]); return t }
const T = await sess('owner@test.local'), E = await sess('editor@test.local')
const adm = async (b, t = T) => { const r = await fetch(APP + '/admin/api/pages', { method: 'POST', headers: { cookie: '__Host-olex_sess=' + t, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
let ip = 50; const pub = async (b) => { const r = await fetch(APP + '/api/p', { method: 'POST', headers: { Origin: APP, 'Content-Type': 'application/json', 'x-forwarded-for': '10.7.0.' + (ip++) }, body: JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const html = async (p) => { await new Promise((ok) => setTimeout(ok, 200)); const r = await fetch(APP + p); return { s: r.status, h: (await r.text()).replace(/<!-- -->/g, '').replace(/\\"/g, '"') } }
await db.query("delete from pages; delete from site_links where slug <> 'me'")
console.log('\n56. Pages & links: addresses and the admin')
let r = await adm({ action: 'create', type: 'webinar' }, E); check(r.s === 403, 'only you can create pages')
r = await adm({ action: 'create', type: 'webinar' }); const W = r.j.id; check(r.s === 200 && W, 'a new webinar page is created as a draft')
for (const [sl, why] of [['admin', 'part of your website'], ['aoc', 'part of your website'], ['me', 'website|short link'], ['Bad Slug!', 'lowercase']]) { r = await adm({ action: 'slug-check', slug: sl, id: W }); check(r.j.ok === false && new RegExp(why, 'i').test(r.j.why), `“${sl}” is refused (${r.j.why})`) }
r = await adm({ action: 'slug-check', slug: 'build-live', id: W }); check(r.j.ok === true, '“build-live” is available')
r = await adm({ action: 'save', id: W, slug: 'build-live', goal: 5, content: { title: 'Build With AI', when: '14 November' } }); check(r.s === 400 && /2026-11-14T19:00/.test(r.j.error), 'a badly written date is refused with an example')
r = await adm({ action: 'save', id: W, slug: 'build-live', goal: 5, content: { title: 'Build With AI', community: 'https://example.com/group' } }); check(r.s === 400 && /WhatsApp/.test(r.j.error), 'the community link must be a WhatsApp link')
r = await adm({ action: 'save', id: W, slug: 'build-live', goal: 5, content: { title: 'Build With AI', tagline: 'Watch an idea go live.', platform: '[add the platform]' } })
r = await adm({ action: 'publish', id: W }); check(r.s === 400 && /date and time/.test(r.j.error) && /\[add the platform\]/.test(r.j.error), 'publishing is refused until the date is given and every [add …] is filled', r.j.error)
let h = await html('/build-live'); check(h.s === 404, 'a draft is not public (its address shows “not found”)')
r = await adm({ action: 'save', id: W, slug: 'build-live', goal: 5, content: { title: 'Build With AI Live', kicker: 'Free webinar', tagline: 'Watch an idea go live.', when: '2026-11-14T19:00', minutes: 60, platform: 'Google Meet', learn: ['Plan', 'Build', 'Publish'], community: 'https://chat.whatsapp.com/AbC123',
  host: { name: 'Olaitan Adebayo', role: 'Creative ideator', bio: 'Builds with AI.', photo: '/aoc/host.webp' }, speakers: [{ name: 'Tola Ade', role: 'Designer', bio: 'Designs things.', photo: '' }], faq: [{ q: 'Is it free?', a: 'Yes.' }] } })
r = await adm({ action: 'publish', id: W }); check(r.s === 200, 'with everything filled in, it publishes')
console.log('\n57. The public webinar page')
h = await html('/build-live')
check(h.s === 200 && h.h.includes('Build With AI Live') && h.h.includes('Starts in') && h.h.includes('Google Meet') && h.h.includes('60 minutes') && h.h.includes('Save my seat'), 'olexweb.com/build-live shows the title, countdown, details and “Save my seat”')
check(h.h.includes('Only 5 seats.') && h.h.includes('Tola Ade') && h.h.includes('/aoc/host.webp') && h.h.includes('Is it free?'), 'slots, the speaker, the chest-up host photo and the questions are there')
check(!/chat\.whatsapp\.com/.test(h.h), 'the community link is NOT on the public page (only after sign-up)')
check(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(h.h.split('<body')[1] || ''), 'no emoji anywhere on the page (custom icons only)')
const pid = W
r = await pub({ action: 'join', page: pid, name: 'A' }); check(r.s === 400, 'a one-letter name is refused')
r = await pub({ action: 'join', page: pid, name: 'Ada Okafor' }); const tok = r.j.token
check(r.s === 200 && r.j.community === 'https://chat.whatsapp.com/AbC123', 'signing up returns the WhatsApp community link for the required last step')
r = await pub({ action: 'me', page: pid, token: tok }); check(r.s === 200 && r.j.name === 'Ada Okafor', 'coming back later is remembered')
await pub({ action: 'join', page: pid, name: 'Second Person' }); r = await pub({ action: 'join', page: pid, name: 'Third Person' }); h = await html('/build-live')
check(h.h.includes('Join fast.') && h.h.includes('Few spaces left.'), 'at 3 of 5 (60%), the page says “Join fast. Few spaces left.”')
await pub({ action: 'join', page: pid, name: 'Fourth Person' }); await pub({ action: 'join', page: pid, name: 'Fifth Person' }); h = await html('/build-live')
check(h.h.includes('Bonus spots opened.'), 'at 5 of 5, “Bonus spots opened”, and it stays open')
r = await adm({ action: 'accepting', id: W, on: false }); h = await html('/build-live'); const rj = await pub({ action: 'join', page: pid, name: 'Late Person' })
check(h.h.includes('Sign-ups are closed for now.') && rj.s === 400, 'Close sign-ups: the page says so and joining is refused')
await adm({ action: 'accepting', id: W, on: true })
console.log('\n58. Event and audio course')
r = await adm({ action: 'create', type: 'event' }); const EV = r.j.id
await adm({ action: 'save', id: EV, slug: 'meetup', goal: 50, content: { title: 'Creators Meetup Lagos', tagline: 'An evening with makers.', when: '2026-12-05T17:00', venue: 'The Hub', address: 'Yaba, Lagos' } })
r = await adm({ action: 'publish', id: EV }); h = await html('/meetup'); check(r.s === 200 && h.h.includes('Creators Meetup Lagos') && h.h.includes('The Hub') && h.h.includes('IN PERSON') && h.h.includes('pv-event'), 'an event page with its venue, on its own dark-opening template')
r = await adm({ action: 'create', type: 'audio' }); const AU = r.j.id
await adm({ action: 'save', id: AU, slug: 'mindset', goal: 100, content: { title: 'Mindset Audio', tagline: 'Three short talks.', parts: [{ title: 'Part 1', file: '/aoc/anatomy-of-creation-part-1.m4a', minutes: 11 }], full: { file: '/aoc/anatomy-of-creation-full-course.m4a' } } })
await adm({ action: 'publish', id: AU }); h = await html('/mindset'); check(h.s === 200 && h.h.includes('Mindset Audio') && !h.h.includes('anatomy-of-creation-part-1.m4a'), 'audio course page: the recordings’ files are hidden until sign-up')
r = await pub({ action: 'join', page: AU, name: 'Ada Okafor' }); check(r.s === 400 && /tick/.test(r.j.error), 'the audio course asks for the tick, like Anatomy of Creation')
r = await pub({ action: 'join', page: AU, name: 'Ada Okafor', consent: true }); const at = r.j.token
check(r.s === 200 && r.j.parts[0].file.endsWith('part-1.m4a') && r.j.full.file.endsWith('full-course.m4a'), 'after sign-up, the recordings and the full download are given')
await pub({ action: 'track', page: AU, token: at, part: 'p1', event: 'play' }); r = await pub({ action: 'feedback', page: AU, token: at, text: 'Loved part one.' })
const sg = (await db.query('select progress, feedback from page_signups where token = $1', [at])).rows[0]; check(sg.progress.p1 && sg.progress.p1.play && sg.feedback === 'Loved part one.', 'listening and feedback are recorded for the admin')
console.log('\n59. Short links (any address → WhatsApp or a website)')
r = await adm({ action: 'link-save', slug: 'admin', url: 'https://x.test' }); check(r.s === 400, 'a short link can’t take a site address')
r = await adm({ action: 'link-save', slug: 'build-live', url: 'https://x.test' }); check(r.s === 400 && /page/.test(r.j.error), 'nor a page’s address')
r = await adm({ action: 'link-save', slug: 'yt', url: 'http://insecure.test' }); check(r.s === 400 && /https/.test(r.j.error), 'website links must be https')
r = await adm({ action: 'link-save', slug: 'yt', url: 'https://youtube.com/@olexweb' }); h = await html('/yt'); check(r.s === 200 && h.h.includes('https://youtube.com/@olexweb') && h.h.includes('Tap here if nothing happens'), 'olexweb.com/yt opens YouTube (with a fallback link)')
r = await adm({ action: 'link-save', slug: 'join', phone: '+234 701 172 6321', message: 'Hi Olex' }); h = await html('/join'); check(h.h.includes('https://wa.me/2347011726321?text=Hi%20Olex'), 'a WhatsApp short link opens your chat with the message ready')
await pub({ action: 'tap', slug: 'yt' }); check((await db.query("select clicks from site_links where slug = 'yt'")).rows[0].clicks === 1, 'each tap is counted')
r = await adm({ action: 'link-delete', slug: 'me' }); check(r.s === 400, 'olexweb.com/me can’t be deleted by accident')
console.log('\n60. AI writing: drafts and ✨ Suggest, never inventing facts')
r = await adm({ action: 'ai-draft', type: 'webinar', notes: 'Free live session about building with AI, for students and freelancers.' })
check(r.s === 200 && r.j.title && r.j.when === '' && /\[add/.test(r.j.platform), 'with no date in the notes, the draft leaves the date empty and marks “[add the platform]”', JSON.stringify(r.j).slice(0, 160))
r = await adm({ action: 'ai-draft', type: 'webinar', notes: 'Free live session on 14 Nov at 7pm on Google Meet, 60 minutes.' }); check(r.j.when === '2026-11-14T19:00' && r.j.minutes === 60, 'a date given in the notes is used exactly')
r = await adm({ action: 'ai-suggest', type: 'webinar', field: 'title', page: { title: 'x' } }); check(r.s === 200 && r.j.options.length === 3, '✨ Suggest gives 3 options')
r = await adm({ action: 'ai-suggest', type: 'webinar', field: 'password', page: {} }); check(r.s === 400, 'Suggest only works on known text fields')
const list = await (await fetch(APP + '/admin/pages', { headers: { cookie: '__Host-olex_sess=' + T } })).text()
const L2 = list.replace(/<!-- -->/g, ''), miss = ['Anatomy of Creation', 'olexweb.com/build-live', 'olexweb.com/meetup', 'olexweb.com/yt', 'New page'].filter((x) => !L2.includes(x))
check(!miss.length, 'Pages & links lists Anatomy of Creation, the new pages and the short links', 'missing: ' + miss.join(', ') + ' | status ' + (list.match(/<title>[^<]*/) || [''])[0])
h = await html('/aoc'); check(h.s === 200 && h.h.includes('Anatomy of Creation'), 'olexweb.com/aoc is untouched')
console.log(`  (${pass} passed, ${failn} failed)`); await db.end(); process.exit(failn ? 1 : 0)
