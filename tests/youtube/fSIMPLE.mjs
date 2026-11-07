// Install 14: the simple Automation screen (Today): four plain questions, the video style choice, big switches.
import pg from 'pg'
import { createHash, randomBytes } from 'node:crypto'
const APP = 'http://localhost:3000'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0; const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + String(extra).slice(0, 300) : '')) } }
const u = (await db.query("select id from admin_users where email = 'owner@test.local'")).rows[0], T = randomBytes(32).toString('base64url')
await db.query("insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '1 day')", [createHash('sha256').update(T).digest('hex'), u.id])
const html = async () => (await (await fetch(APP + '/admin/automation', { headers: { cookie: '__Host-olex_sess=' + T } })).text()).replace(/<!-- -->/g, '')
const api = async (b) => (await fetch(APP + '/admin/api/youtube', { method: 'POST', headers: { cookie: '__Host-olex_sess=' + T, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify(b) })).status

console.log('\n130. The simple Automation screen')
await db.query("update yt_settings set short_style = 'classic', yt_mode = 'autopilot'")
let h = await html()
check(h.includes('aria-pressed="true">Simple') && h.includes('Detailed'), 'it opens on Simple, with a switch to Detailed')
check(['Today</h2>', 'Being made now</h2>', 'What kind of videos?</h2>', 'Switches</h2>', 'This week</h2>'].every((x) => h.includes(x)), 'four plain questions: today, being made, what kind of videos, switches (+ this week)')
check(/sm-hero sm-(ok|low|needs|off)/.test(h) && /Checked .* ago|Checked just now|It’s running by itself|need(s)? you/.test(h), 'a big status at the top')
check(h.includes('Classic Shorts · on') && h.includes('Story videos') && h.includes('role="switch"'), 'the video style is a plain choice; the switches are real on/off switches')
check(h.includes('Posting agent') && h.includes('Autopilot this week'), 'the detailed view is still there, one tap away')
check(await api({ action: 'short-style', style: 'story' }) === 200, 'choosing Story videos works')
h = await html()
check(h.includes('Story videos · on') && h.includes('The long story goes up at') && (h.includes('Make today’s long story now') || h.includes('Today’s is already written')), 'with stories on: the long story’s time, and a button to make today’s now')
await db.query("update yt_settings set short_style = 'classic'")

console.log('\n131. Simple YouTube and Facebook tabs')
const page = async (path) => (await (await fetch(APP + path, { headers: { cookie: '__Host-olex_sess=' + T } })).text()).replace(/<!-- -->/g, '')
let y = await page('/admin/youtube')
check(y.includes('aria-pressed="true">Simple') && ['views</b>', 'Coming up on YouTube</h2>', 'Your best videos lately</h2>', 'How it posts</h2>', 'Everything else</h2>'].every((x) => y.includes(x)), 'YouTube opens simple: the channel’s views, coming up, best lately, how it posts')
check(y.includes('aria-label="Channel"') && y.includes('Analytics'), 'the full numbers are still there (Detailed)')
check(!(await page('/admin/youtube?yt=connected')).includes('aria-pressed="true">Simple'), 'just back from connecting: straight to the detailed view with its message')
await db.query('update meta_settings set enabled = true, paused_at = null, paused_reason = null')
let f = await page('/admin/automation/facebook')
check(f.includes('aria-pressed="true">Simple') && ['Posting ', 'Coming up on Facebook</h2>', 'Posted lately</h2>', 'How many Reels a day?</h2>'].every((x) => f.includes(x)), 'Facebook opens simple: is it posting, coming up, posted lately, how many a day')
const r = await fetch(APP + '/admin/api/meta', { method: 'POST', headers: { cookie: '__Host-olex_sess=' + T, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'per-day', n: 2 }) })
f = await page('/admin/automation/facebook')
check(r.status === 200 && f.includes('Posting 2 Reels a day.'), 'the 1 / 2 / 3 a day buttons work')
console.log(`  (${pass} passed, ${failn} failed)`)
await db.end(); process.exit(failn ? 1 : 0)
