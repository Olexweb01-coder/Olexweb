import pg from 'pg'
import fs from 'node:fs'
const APP = 'http://localhost:3000', G = 'http://localhost:4555'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0
const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + extra : '')) } }
const ID = Number(fs.readFileSync('/tmp/fid', 'utf8')), T = fs.readFileSync('/tmp/ftok', 'utf8')
const post = (body) => fetch(APP + '/admin/api/youtube', { method: 'POST', headers: { cookie: '__Host-olex_sess=' + T, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
console.log('\n44. The long video comes back with its chapters, and goes to YouTube')
const s = (await db.query('select status, video from yt_scripts where id = $1', [ID])).rows[0]
check(s.status === 'rendered' && Array.isArray(s.video.chapters) && s.video.chapters.length === 6, `back from the factory with ${s.video.chapters && s.video.chapters.length} chapter times: ` + (s.video.chapters || []).map((c) => c.start + 's ' + c.title.split(':')[0]).join(', '))
await db.query("update yt_settings set publish_mode = 'private'")
const r = await post({ action: 'upload', id: ID }), j = await r.json(), st = await (await fetch(G + '/_state')).json(), m = st.sessions.at(-1).meta
check(r.status === 200, 'uploaded', JSON.stringify(j))
check(m.snippet.title === '4 Secret Websites You Should Know (Vol. 1)' && !/\(Part/.test(m.snippet.title), 'titled as a volume, with no part number: “' + m.snippet.title + '”')
const lines = (m.snippet.description.split('Chapters\n')[1] || '').split('\n')
check(lines[0] === '0:00 Intro' && lines.length === 6 && lines.every((l) => /^\d+:\d\d .+/.test(l)), 'the description ends with YouTube chapters:\n      ' + lines.join('\n      '))
check(/1\. Squoosh: http/.test(m.snippet.description) && /olexweb\.com/.test(m.snippet.description), 'and lists each site with its address, plus olexweb.com')
console.log(`  (${pass} passed, ${failn} failed)`)
await db.end(); process.exit(failn ? 1 : 0)
