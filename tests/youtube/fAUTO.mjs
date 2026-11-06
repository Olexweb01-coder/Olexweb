// Install 9: hands-off automation (no human gate). On Autopilot: drafts go ahead at once; a script with problems is mended
// in code (lines the site doesn't back removed, titles and hashtags tidied); small leftovers wait at most an hour, then go
// ahead; critical problems throw the script away and write the idea again (set aside after 2 tries); failed videos are
// made again up to 3 times. On Approval nothing changes.
import pg from 'pg'
import { createHash, randomBytes } from 'node:crypto'
const APP = 'http://localhost:3000'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0; const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + String(extra).slice(0, 260) : '')) } }
const sess = async (e) => { const u = (await db.query('select id from admin_users where email = $1', [e])).rows[0], t = randomBytes(32).toString('base64url'); await db.query("insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '1 day')", [createHash('sha256').update(t).digest('hex'), u.id]); return t }
const T = await sess('owner@test.local')
const api = (path, b, t = T) => fetch(APP + path, { method: 'POST', headers: { cookie: '__Host-olex_sess=' + t, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
const html = async (path, t = T) => { const r = await fetch(APP + path, { headers: { cookie: '__Host-olex_sess=' + t }, redirect: 'manual' }); return (await r.text()).replace(/<!-- -->/g, '') }
const run = async () => (await (await fetch(APP + '/api/assistant/cron?run=due', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } })).json())
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0]
const mode = (m) => db.query('update yt_settings set yt_mode = $1', [m])

const PAGE = 'PaletteForge makes colour palettes from a photo. Export palettes as CSS variables. It is free to use with no sign up. Every colour comes with its code.'
const SCENES = [
  { id: 's1', type: 'hook', pose: 'shocked', text: 'This site turns any photo into a colour palette.' },
  { id: 's2', type: 'demo', pose: 'pointing', text: 'Drop in a photo and it pulls out the main colours.', capture: 'homepage' },
  { id: 's3', type: 'demo', pose: 'pointing', text: 'Every colour comes with its code, ready to copy.', capture: 'scroll to the examples' },
  { id: 's4', type: 'infographic', pose: 'pointing', text: 'You can export palettes as CSS variables in one click.' },
  { id: 's5', type: 'talk', pose: 'thinking', text: 'It is free to use, with no sign up at all.' },
  { id: 's6', type: 'talk', pose: 'thinking', text: 'It also writes your whole brand guide using powerful AI magic.' },
  { id: 's7', type: 'url', pose: 'pointing', text: 'Find it at paletteforge dot test.', big: 'PALETTEFORGE.TEST' },
  { id: 's8', type: 'cta', pose: 'waving', text: 'Which site should I find next? Comment, and follow for more finds.' }]
const CLAIMS = [{ claim: 'Exports palettes as CSS variables', quote: 'Export palettes as CSS variables' }, { claim: 'Free with no sign up', quote: 'It is free to use with no sign up' },
  { claim: 'Writes your whole brand guide with AI', quote: 'Writes your brand guide with AI' }]
const PKG = { title: 'This free site turns any photo into a perfect colour palette instantly wow', titles: ['This free site turns any photo into a perfect colour palette instantly wow', 'Photo to palette in seconds', 'Stop guessing colours'], description: 'Colour palettes from a photo. Find it: paletteforge.test', hashtags: ['#design', '#colors'] }
const SHORT = [SCENES[0], SCENES[1], SCENES[6], SCENES[7]]          // one demo, about 13 seconds: critical

async function idea(key, name) { return (await one("insert into yt_ideas (key, name, url, source, status) values ($1, $2, 'https://paletteforge.test/', 'test', 'picked') on conflict (key) do update set status = 'picked', rewrites = 0, risks = null returning id", [key, name])).id }
async function script(ideaId, status, scenes, extra = '') {
  await db.query('delete from yt_scripts where idea_id = $1', [ideaId])
  return (await one(`insert into yt_scripts (idea_id, status, script, package, claims, checks, seconds, page) values ($1, $2, $3, $4, $5, '[{"key":"claims","ok":false,"note":"x"}]', 30, $6) returning id`,
    [ideaId, status, JSON.stringify({ site: { name: 'PaletteForge', url: 'https://paletteforge.test/' }, voice: 'am_michael', scenes }), JSON.stringify(PKG), JSON.stringify(CLAIMS), PAGE])).id
}
const row = (id) => one('select status, script, package, claims, checks, hold_until, auto_fixes, render_tries from yt_scripts where id = $1', [id])
// other scripts step aside so the frequent run only touches this suite's (restored at the end)
const aside = (await db.query("update yt_scripts set status = 'uploaded', render_error = coalesce(render_error, '') || '#aside:' || status where status in ('draft', 'needs_review', 'failed', 'approved') returning id")).rows.map((x) => x.id)
await db.query("update yt_scripts set status = 'rendered' where status = 'rendering'")

console.log('\n95. On Approval, nothing changes')
await mode('approval')
const iA = await idea('auto-a.test', 'AutoA'), sA = await script(iA, 'needs_review', SCENES)
await db.query("update yt_scripts set hold_until = now() - interval '5 minutes' where id = $1", [sA])
await run(); let r = await row(sA)
check(r.status === 'needs_review' && r.script.scenes.length === 8, 'a script that failed a check still waits for you', r.status)

console.log('\n96. On Autopilot, a script with problems gets an hour, then goes ahead mended')
await mode('autopilot'); await db.query('update yt_scripts set hold_until = null where id = $1', [sA])
let rep = await run(); r = await row(sA)
const mins = r.hold_until ? (new Date(r.hold_until) - Date.now()) / 60000 : -1
check(r.status === 'needs_review' && mins > 55 && mins <= 61, 'first seen: it waits at most an hour (' + Math.round(mins) + ' min left)')
let h = await html('/admin/youtube?view=progress')
check(/goes ahead by itself at \d\d:\d\d \(Lagos\)/.test(h), 'Progress says when it goes ahead by itself (not “waiting for your review”)')
h = await html('/admin/youtube?view=scripts')
check(h.includes('it goes ahead by itself at'), 'the script card says so too')
h = await html('/admin/automation')
check(!h.includes('waiting for approval'), 'Overview doesn’t ask you to approve anything')
await db.query("update yt_scripts set hold_until = now() - interval '1 minute' where id = $1", [sA])
rep = await run(); r = await row(sA)
check(['approved', 'rendering'].includes(r.status), 'after the hour it goes ahead by itself (' + r.status + ')', JSON.stringify(rep).slice(0, 200))
check(rep.autonomy && rep.autonomy.approved >= 1, 'the frequent run reports what Autopilot did', JSON.stringify(rep.autonomy))
check(!r.script.scenes.some((x) => /brand guide/.test(x.text)) && r.script.scenes.length === 7, 'the line the site doesn’t back is gone (7 scenes left)')
check(r.claims.length === 2 && r.claims.every((c) => PAGE.includes(c.quote)), 'only claims with a real quote from the site remain')
check(r.package.titles.length >= 3 && r.package.titles.every((t) => t.length <= 60) && r.package.title.length <= 60, 'titles tidied: 60 characters at most, 3 options', JSON.stringify(r.package.titles))
check(r.package.hashtags.includes('#shorts') && r.package.hashtags.length >= 3, 'hashtags tidied: #shorts added, at least 3', r.package.hashtags.join(' '))
check(r.checks.every((c) => c.ok), 'the mended script passes every check')
check(Array.isArray(r.auto_fixes) && r.auto_fixes.some((f) => /doesn’t back/.test(f)), 'what Autopilot fixed is written down in plain words', JSON.stringify(r.auto_fixes).slice(0, 200))
await db.query("update yt_scripts set status = 'approved' where id = $1", [sA])
h = await html('/admin/youtube?view=scripts')
check(/Autopilot fixed \d+ things? itself/.test(h), 'the script card lists what Autopilot fixed')

console.log('\n97. A critical problem: thrown away and written again, then set aside')
const iC = await idea('auto-c.test', 'AutoCritical'); let sC = await script(iC, 'needs_review', SHORT)
await db.query("update yt_scripts set hold_until = now() - interval '1 minute' where id = $1", [sC])
rep = await run()
let ic = await one('select status, rewrites from yt_ideas where id = $1', [iC])
check(!(await row(sC)), 'the weak script is thrown away (too short, one scene of the site)')
check(ic.status === 'picked' && ic.rewrites === 1, 'the idea stays picked, to be written again (' + ic.rewrites + ' rewrite)')
check(!!(await one("select 1 from audit_log where action = 'yt_script_replaced' and (detail->>'idea')::int = $1", [iC])), 'the replacement is logged with its reason')
sC = await script(iC, 'needs_review', SHORT); await db.query("update yt_scripts set hold_until = now() - interval '1 minute' where id = $1", [sC])
await run(); ic = await one('select status, rewrites, risks from yt_ideas where id = $1', [iC])
check(ic.status === 'passed' && /Autopilot set it aside/.test(ic.risks || ''), 'second time: the idea is set aside with the reason, so the next idea takes its place', ic.status + ' ' + ic.risks)

console.log('\n98. Drafts and failed videos')
const iD = await idea('auto-d.test', 'AutoDraft'), sD = await script(iD, 'draft', SCENES)
await run(); r = await row(sD)
check(['approved', 'rendering'].includes(r.status), 'a draft goes ahead at once on Autopilot (' + r.status + ')')
await db.query("update yt_scripts set status = 'uploaded' where status in ('approved', 'rendering') and idea_id in ($1, $2)", [iA, iD])
const iF = await idea('auto-f.test', 'AutoFailed'), sF = await script(iF, 'failed', SCENES)
await db.query("update yt_scripts set render_tries = 1, render_error = 'Factory: boom', updated_at = now() - interval '20 minutes' where id = $1", [sF])
const iG = await idea('auto-g.test', 'AutoGaveUp'), sG = await script(iG, 'failed', SCENES)
await db.query("update yt_scripts set render_tries = 3, render_error = 'Factory: boom', updated_at = now() - interval '20 minutes' where id = $1", [sG])
const iO = await idea('auto-o.test', 'AutoOld'), sO = await script(iO, 'failed', SCENES)
await db.query("update yt_scripts set render_tries = 1, render_error = 'Factory: boom', updated_at = now() - interval '3 days' where id = $1", [sO])
const iN = await idea('auto-n.test', 'AutoNew'), sN = await script(iN, 'failed', SCENES)
await db.query("update yt_scripts set render_tries = 1, render_error = 'Factory: boom', updated_at = now() where id = $1", [sN])
await run()
r = await row(sF); check(['approved', 'rendering'].includes(r.status), 'a failed video is made again by itself (' + r.status + ')')
check((await row(sG)).status === 'failed', 'after 3 tries it stops trying')
check((await row(sO)).status === 'failed' && (await row(sN)).status === 'failed', 'old failures and ones that just failed are left alone (10 minutes’ breather, 2 days at most)')
h = await html('/admin/automation')
check(h.includes('AutoGaveUp: the factory failed 3 times'), 'Overview → Needs you shows the one it gave up on')

console.log('\n99. Switching to Autopilot starts the hour for scripts already waiting')
await mode('approval'); const iS = await idea('auto-s.test', 'AutoSwitch'), sS = await script(iS, 'needs_review', SCENES)
let j = await (await api('/admin/api/youtube', { action: 'yt-mode', mode: 'autopilot' })).json()
r = await row(sS); check(j.ok && r.hold_until && r.status === 'needs_review', 'its hour starts now; it isn’t approved blindly')
await api('/admin/api/youtube', { action: 'yt-mode', mode: 'approval' }); r = await row(sS)
check(!r.hold_until, 'back on Approval, it waits for you again')

console.log('\n100. The Today tab')
h = await html('/admin/automation')
check(['>Today</a>', 'id="at-status"', 'id="at-yt"', 'id="at-fb"', 'id="at-make"', 'id="at-auto"', 'id="at-needs"'].every((t) => h.includes(t)), 'Today is the first tab, in sections: Status · YouTube · Facebook · Being made · Autopilot · Needs you')
check(/<nav class="at-chips"[^>]*>(<a href="#at-[a-z]+">[^<]+<\/a>){7}<\/nav>/.test(h), 'a row of section chips jumps to each section (7)')
check(h.includes('Something needs you') && h.indexOf('id="at-needs"') < h.indexOf('id="at-yt"'), 'when something needs you, it says so at the top and Needs you comes first')
check(h.includes('Production check') && h.includes('Make more') && /thrown away and written again/.test(h), 'the production check, Make more and what Autopilot did this week are there')
await db.query("update yt_scripts set status = 'failed', render_tries = 1 where id = $1", [sG])
await mode('autopilot')
h = await html('/admin/automation')
check(!h.includes('Something needs you') && h.indexOf('id="at-needs"') > h.indexOf('id="at-auto"'), 'with nothing waiting, Needs you moves to the end')

// clean up
await db.query("delete from yt_scripts where idea_id in (select id from yt_ideas where key like 'auto-%.test')")
await db.query("delete from yt_ideas where key like 'auto-%.test'")
await db.query("update yt_scripts set status = split_part(render_error, '#aside:', 2), render_error = nullif(split_part(render_error, '#aside:', 1), '') where id = any($1)", [aside])
await db.query("update yt_jobs set finished_at = now() where kind = 'render'")
await mode('autopilot')
console.log(`  (${pass} passed, ${failn} failed)`)
await db.end(); process.exit(failn ? 1 : 0)
