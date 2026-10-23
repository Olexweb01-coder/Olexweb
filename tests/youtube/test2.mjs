// After a server restart (no cached access token): Google refuses the stored sign-in → clear message, sign-in removed.
import pg from 'pg'
const APP = 'http://localhost:3000', G = 'http://localhost:4555'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
const t = process.argv[2]
let r = await fetch(APP + '/admin/api/youtube', { method: 'POST', headers: { cookie: '__Host-olex_sess=' + t, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sync' }) })
const j = await r.json(), a = (await db.query('select refresh_enc, last_error from yt_account where id = 1')).rows[0]
const ok1 = r.status === 400 && /no longer accepts/.test(j.error), ok2 = !a.refresh_enc && /no longer accepts/.test(a.last_error || '')
console.log((ok1 ? '  ✓' : '  ✗') + ' a withdrawn sign-in gives a clear message: “' + j.error + '”')
console.log((ok2 ? '  ✓' : '  ✗') + ' the dead sign-in is removed and the page shows the reason')
r = await fetch(APP + '/admin/youtube', { headers: { cookie: '__Host-olex_sess=' + t } }); const html = await r.text()
const ok3 = html.includes('Connect YouTube again') && html.includes('Last update failed')
console.log((ok3 ? '  ✓' : '  ✗') + ' the page asks to connect again and explains why')
await db.end(); process.exit(ok1 && ok2 && ok3 ? 0 : 1)
