import pg from 'pg'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
const APP = 'http://localhost:3000', S3 = 'http://localhost:4560'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0
const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + extra : '')) } }
const ID = Number(fs.readFileSync('/tmp/fid', 'utf8')), T = fs.readFileSync('/tmp/ftok', 'utf8'), secs = Number(process.argv[2])
const orig = fs.readFileSync('/home/claude/olexweb-factory/out/video.mp4'), md5 = (b) => createHash('md5').update(b).digest('hex')
console.log('\n42. The bucket takes the upload and never answers (what happened on Vercel)')
const s = (await db.query('select status, video, render_detail from yt_scripts where id = $1', [ID])).rows[0]
const rows = (await db.query('select count(*)::int n from yt_pieces where script_id = $1', [ID])).rows[0].n
const st = await (await fetch(S3 + '/_list')).json()
check(s.status === 'rendered' && rows === s.video.pieces, `finished anyway: all ${rows} pieces kept in the database`, JSON.stringify(s).slice(0, 160))
check(/didn’t answer within 1.5 seconds/.test(s.render_detail || ''), 'the reason is recorded: “' + (s.render_detail || '').slice(0, 110) + '”')
check(st.hung === 2, `the bucket was given only 2 tries for the whole video (it hung ${st.hung} times), not 2 per piece`)
check(secs < 30, `the whole send-back took ${secs}s (before the fix: every piece hung until Vercel’s 60-second cutoff)`)
check(s.video.piece === 1048576, 'the video remembers its piece size (1 MiB)')
const parts = []; let at = 0
while (at < orig.length) { const x = await fetch(APP + `/admin/api/youtube/video?id=${ID}`, { headers: { cookie: '__Host-olex_sess=' + T, Range: `bytes=${at}-` } }); const b = Buffer.from(await x.arrayBuffer()); if (!b.length) break; parts.push(b); at += b.length }
check(md5(Buffer.concat(parts)) === md5(orig), 'and it plays in the admin, byte-for-byte')
console.log(`  (${pass} passed, ${failn} failed)`)
await db.end(); process.exit(failn ? 1 : 0)
