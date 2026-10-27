// Before the uploads: connect the Facebook Page through the real flow (connect → Meta → callback) and switch Reels on
import pg from 'pg'
import { createHash, randomBytes } from 'node:crypto'
const APP = 'http://localhost:3000'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0; const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + String(extra).slice(0, 220) : '')) } }
const sess = async (e) => { const u = (await db.query('select id from admin_users where email = $1', [e])).rows[0], t = randomBytes(32).toString('base64url'); await db.query("insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '1 day')", [createHash('sha256').update(t).digest('hex'), u.id]); return t }
const T = await sess('owner@test.local'), E = await sess('editor@test.local')
await db.query("delete from meta_pages; update meta_settings set enabled = false, per_day = 1, paused_at = null, paused_reason = null; update yt_scripts set fb = null")
await db.query("insert into dir_entries (slug, idea_id, name, url, status, content, quality, published_at) select 'guide-' || i.id, i.id, i.name, i.url, 'live', '{}'::jsonb, '{\"ok\":true}'::jsonb, now() from yt_ideas i where exists (select 1 from yt_scripts s where s.idea_id = i.id) and not exists (select 1 from dir_entries d where d.idea_id = i.id)")   // guides for the videos about to upload
console.log('\n73. Connecting the Facebook Page (Meta’s official login)')
let r = await fetch(APP + '/admin/api/meta/connect', { headers: { cookie: '__Host-olex_sess=' + E }, redirect: 'manual' }); check(r.status >= 300 && /login/.test(r.headers.get('location') || ''), 'only you can connect a Page')
r = await fetch(APP + '/admin/api/meta/connect', { headers: { cookie: '__Host-olex_sess=' + T }, redirect: 'manual' }); let loc = r.headers.get('location') || ''
const sc = (r.headers.get('set-cookie') || '').match(/olex_meta_state=([^;]+)/), stateCookie = sc ? 'olex_meta_state=' + sc[1] : ''
check(/\/v21\.0\/dialog\/oauth\?/.test(loc) && loc.includes('config_id=cfg-123') && loc.includes('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fadmin%2Fapi%2Fmeta%2Fcallback') && /state=[\w-]{20,}/.test(loc) && stateCookie && /SameSite=Lax/i.test(r.headers.get('set-cookie')), 'Connect sends you to Meta’s login with the app’s configuration, an unguessable state, and a short-lived state cookie', loc.slice(0, 200))
r = await fetch(loc, { redirect: 'manual' }); const back = r.headers.get('location')
const page = async (url, cookie) => { const x = await fetch(url, { headers: cookie ? { cookie } : {}, redirect: 'manual' }); return { s: x.status, h: await x.text() } }
let pp = await page(back.replace(/state=[^&]+/, 'state=forged'), stateCookie); check(/fb=expired/.test(pp.h), 'a forged state is refused')
pp = await page(back, ''); check(/fb=expired/.test(pp.h), 'coming back in a different browser (no state cookie) is refused')
r = await fetch(APP + '/admin/api/meta/connect', { headers: { cookie: '__Host-olex_sess=' + T }, redirect: 'manual' }); loc = r.headers.get('location'); const sc2 = 'olex_meta_state=' + r.headers.get('set-cookie').match(/olex_meta_state=([^;]+)/)[1]
const back2 = (await fetch(loc, { redirect: 'manual' })).headers.get('location')
pp = await page(back2, sc2)                                     // like a real browser: Meta's hop carries only the Lax state cookie, not the Strict session
check(pp.s === 200 && /fb=connected/.test(pp.h) && /http-equiv="refresh"/.test(pp.h), 'coming back from Meta (without the Strict session cookie) connects the Page, then hands back to the admin from this site')
const pg1 = (await db.query('select page_id, name, token_enc, selected from meta_pages')).rows
check(pg1.length === 1 && pg1[0].name === 'Olexweb' && pg1[0].selected && !pg1[0].token_enc.includes('page-token-777'), 'your Olexweb Page is chosen, and its posting key is stored encrypted (never in plain text)')
const post = (b, t = T) => fetch(APP + '/admin/api/meta', { method: 'POST', headers: { cookie: '__Host-olex_sess=' + t, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
r = await post({ action: 'enable', on: true }, E); check(r.status === 403, 'only you can switch Facebook posting on')
r = await post({ action: 'enable', on: true }); check(r.status === 200 && (await db.query('select enabled from meta_settings')).rows[0].enabled, 'Facebook Reels switched on (1 a day)')
console.log(`  (${pass} passed, ${failn} failed)`); await db.end(); process.exit(failn ? 1 : 0)
