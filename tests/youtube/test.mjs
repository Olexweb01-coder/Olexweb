// End-to-end: the real admin (npm start) against the stand-in Google.
import pg from 'pg'
import { createHash, randomBytes } from 'node:crypto'
const APP = 'http://localhost:3000', G = 'http://localhost:4555'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0
const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + extra : '')) } }
const sha = (s) => createHash('sha256').update(s).digest('hex')

// a signed-in owner and an editor (sessions made directly, like a finished two-step sign-in)
await db.query("delete from admin_users where email in ('owner@test.local','editor@test.local')")
const mk = async (email, role) => { const u = (await db.query("insert into admin_users (email, name, role, totp_enabled) values ($1, $2, $3, true) returning id", [email, role, role])).rows[0]
  const t = randomBytes(32).toString('base64url'); await db.query("insert into sessions (id_hash, user_id, expires_at) values ($1, $2, now() + interval '1 day')", [sha(t), u.id]); return t }
const owner = await mk('owner@test.local', 'owner'), editor = await mk('editor@test.local', 'editor')
await db.query('update yt_account set channel_id=null,title=null,refresh_enc=null,connected_at=null,last_sync=null,last_error=null where id=1')
await db.query('delete from yt_videos; delete from yt_daily; delete from yt_snap; delete from yt_oauth_states')
const C = (t, extra = '') => ({ cookie: '__Host-olex_sess=' + t + (extra ? '; ' + extra : '') })
const go = (path, opts = {}) => fetch(APP + path, { redirect: 'manual', ...opts })

console.log('\n1. Before connecting')
let r = await go('/admin/youtube', { headers: C(owner) }); let html = await r.text()
check(r.status === 200 && html.includes('Connect your channel'), 'the page shows “Connect your channel”')
r = await go('/admin/youtube', { headers: C(editor) }); check(r.status === 307 || r.status === 303 || (r.headers.get('location') || '').includes('/admin/more'), 'an editor is sent away from the YouTube page', r.status + ' ' + r.headers.get('location'))
r = await go('/admin/youtube'); check((r.headers.get('location') || '').includes('/admin/login'), 'no session → sign-in page')

console.log('\n2. Connect: start')
r = await go('/admin/api/youtube/connect', { headers: C(editor) }); check((r.headers.get('location') || '').includes('yt=owner'), 'an editor cannot start connecting')
r = await go('/admin/api/youtube/connect', { headers: C(owner) })
const loc = r.headers.get('location') || '', setc = r.headers.get('set-cookie') || ''
check(r.status === 303 && loc.startsWith(G + '/auth?'), 'the owner is sent to Google', r.status + ' ' + loc.slice(0, 80))
const au = new URL(loc), state = au.searchParams.get('state')
check(au.searchParams.get('code_challenge_method') === 'S256' && au.searchParams.get('code_challenge'), 'PKCE challenge is included')
check(au.searchParams.get('access_type') === 'offline' && /consent/.test(au.searchParams.get('prompt')), 'asks for lasting (offline) access with consent')
check(['youtube.readonly', 'yt-analytics.readonly', 'youtube.upload'].every((s) => au.searchParams.get('scope').includes(s)), 'asks for read, analytics and upload')
check(au.searchParams.get('redirect_uri') === APP + '/admin/api/youtube/callback', 'uses the registered return address')
check(/olex_yt_state=/.test(setc) && /HttpOnly/i.test(setc) && /SameSite=lax/i.test(setc) && /Path=\/admin\/api\/youtube/i.test(setc), 'state cookie: HttpOnly, Lax, limited to the YouTube routes', setc)
const stRow = (await db.query('select * from yt_oauth_states')).rows
check(stRow.length === 1 && stRow[0].state_hash === sha(state) && !stRow[0].verifier_enc.includes(state), 'the state is stored only as a fingerprint; the PKCE verifier encrypted')
const stateCookie = 'olex_yt_state=' + state

console.log('\n3. The way back from Google: refusals first')
r = await go('/admin/api/youtube/callback?code=x&state=' + state); html = await r.text()
check(html.includes('yt=expired'), 'without the state cookie (another browser) → refused')
r = await go('/admin/api/youtube/callback?code=x&state=wrong', { headers: { cookie: 'olex_yt_state=wrong' } }); html = await r.text()
check(html.includes('yt=expired'), 'a made-up state → refused')
r = await go('/admin/api/youtube/callback?error=access_denied&state=' + state, { headers: { cookie: stateCookie } }); html = await r.text()
check(html.includes('yt=denied'), 'cancelling at Google → “you cancelled” message')

console.log('\n4. The way back: approve (no admin session cookie, as with a real Strict cookie)')
r = await fetch(loc, { redirect: 'manual' }); const back = r.headers.get('location')
r = await go(back.replace(APP, ''), { headers: { cookie: stateCookie } }); html = await r.text()
check(r.status === 200 && html.includes('url=/admin/youtube?yt=connected'), 'connected, then moved on to the YouTube page from this site', html.slice(0, 300))
check(/olex_yt_state=;/.test(r.headers.get('set-cookie') || ''), 'the state cookie is cleared')
r = await go(back.replace(APP, ''), { headers: { cookie: stateCookie } }); html = await r.text()
check(html.includes('yt=expired'), 'the same return link cannot be used twice')
const acc = (await db.query('select * from yt_account where id = 1')).rows[0]
check(acc.channel_id === 'UCW_CpkVYb6Z_ijQqNTiJthQ' && acc.handle === '@olexweb', 'channel saved: ' + acc.title + ' ' + acc.handle)
check(acc.refresh_enc && acc.refresh_enc.startsWith('v1.') && !acc.refresh_enc.includes('SECRET-REFRESH'), 'the refresh token is stored encrypted, never readable')
const audit = (await db.query("select action from audit_log where action like 'youtube%' order by id desc limit 1")).rows[0]
check(audit && audit.action === 'youtube_connected', 'connecting is written to the audit log')

console.log('\n5. Numbers arrived with the connection')
const nv = (await db.query('select count(*)::int n, sum(is_short::int)::int s from yt_videos')).rows[0]
check(nv.n === 6, 'all 6 uploads saved across two pages of results', JSON.stringify(nv))
check(nv.s === 5, '5 Shorts and 1 long video told apart by length')
const nd = (await db.query('select count(*)::int n from yt_daily')).rows[0].n
check(nd >= 35, nd + ' days of channel numbers saved')
const p4 = (await db.query("select views, avg_view_pct, subs_gained from yt_videos where video_id = 'afKsIoJghQw'")).rows[0]
check(p4 && Number(p4.views) === 224 && Math.round(p4.avg_view_pct) === 93 && p4.subs_gained === 4, 'per-video analytics merged (Part 4: 224 views, 93% watched, +4 subscribers)')

console.log('\n6. The page with numbers')
r = await go('/admin/youtube?yt=connected', { headers: C(owner) }); html = await r.text()
check(html.includes('YouTube connected') && html.includes('Secret websites you should know (Part 4)') && html.includes('41 subscribers'), 'shows the channel, the uploads and the “connected” note')
check(/img-src[^;]*i\.ytimg\.com/.test(r.headers.get('content-security-policy') || ''), 'the security policy allows YouTube thumbnails')
r = await go('/admin/youtube?days=7', { headers: C(owner) }); check(r.status === 200, '7-day view works')

console.log('\n7. Fetch now, and its protections')
r = await go('/admin/api/youtube', { method: 'POST', headers: { ...C(owner), 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sync' }) })
check(r.status === 403, 'refused without this site’s Origin (cross-site request)')
r = await go('/admin/api/youtube', { method: 'POST', headers: { ...C(editor), Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sync' }) })
check(r.status === 403, 'refused for an editor')
r = await go('/admin/api/youtube', { method: 'POST', headers: { ...C(owner), Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sync' }) })
let j = await r.json(); check(r.status === 200 && j.videos === 6, 'Fetch now works for the owner', JSON.stringify(j))

console.log('\n9. Disconnect')
r = await go('/admin/api/youtube', { method: 'POST', headers: { ...C(owner), Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'disconnect' }) })
check(r.status === 200, 'disconnect works')
const st = await (await fetch(G + '/_state')).json()
check(st.revokeCalls >= 1, 'the sign-in is revoked at Google too')
const acc2 = (await db.query('select refresh_enc, channel_id from yt_account where id = 1')).rows[0]
check(!acc2.refresh_enc && acc2.channel_id, 'the stored sign-in is deleted; the numbers stay')
r = await go('/admin/youtube', { headers: C(owner) }); html = await r.text()
check(html.includes('Connect YouTube again') && html.includes('Secret websites'), 'the page offers “Connect YouTube again” and keeps the numbers')

console.log(`\n${pass} passed, ${failn} failed`)
await db.end(); process.exit(failn ? 1 : 0)
