import pg from 'pg'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
const APP = 'http://localhost:3000', G = 'http://localhost:4555', S3 = 'http://localhost:4560'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0
const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + extra : '')) } }
const ID = Number(fs.readFileSync('/tmp/fid', 'utf8')), T = fs.readFileSync('/tmp/ftok', 'utf8'), phase = process.argv[2]
const orig = fs.readFileSync('/home/claude/olexweb-factory/out/video.mp4'), md5 = (b) => createHash('md5').update(b).digest('hex')
const owner = { cookie: '__Host-olex_sess=' + T }
if (phase === 'refused') {
  console.log('\n39. The bucket refuses every piece: the video is kept in the database instead')
  const s = (await db.query('select status, video, render_error from yt_scripts where id = $1', [ID])).rows[0]
  const rows = (await db.query('select count(*)::int n, sum(length(data))::int b from yt_pieces where script_id = $1', [ID])).rows[0]
  check(s.status === 'rendered' && rows.n === s.video.pieces && rows.b === orig.length, `finished anyway: ${rows.n} pieces (${rows.b} bytes) kept in the database`, JSON.stringify(s).slice(0, 200))
  const prog = (await (await fetch(APP + '/admin/api/youtube?progress=render', { headers: owner })).json()).progress
  check(prog.finished && !prog.error, 'the progress panel shows it finished, not stopped')
  const parts = []; let at = 0
  while (at < orig.length) { const x = await fetch(APP + `/admin/api/youtube/video?id=${ID}`, { headers: { ...owner, Range: `bytes=${at}-` } }); const b = Buffer.from(await x.arrayBuffer()); if (!b.length) break; parts.push(b); at += b.length }
  check(md5(Buffer.concat(parts)) === md5(orig), 'it plays in the admin, byte-for-byte, from the database')
  const r = await fetch(APP + `/admin/api/youtube/video?id=${ID}`, { headers: { ...owner, Range: 'bytes=1048500-1048700' } }), b = Buffer.from(await r.arrayBuffer())
  check(md5(b) === md5(orig.subarray(1048500, 1048576)), 'seeking works from the database too')
  const up = await fetch(APP + '/admin/api/youtube', { method: 'POST', headers: { ...owner, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'upload', id: ID }) }), uj = await up.json()
  const st = await (await fetch(G + '/_state')).json()
  check(up.status === 200 && st.uploadMd5 === md5(orig), 'and it uploads to YouTube byte-for-byte from the database', JSON.stringify(uj))
  const left = (await db.query('select count(*)::int n from yt_pieces where script_id = $1', [ID])).rows[0].n
  check(left === 0, 'after the upload the database copy is deleted')
}
if (phase === 'hiccup') {
  console.log('\n40. The bucket fails twice, then recovers: quiet retries, stored normally')
  const s = (await db.query('select status from yt_scripts where id = $1', [ID])).rows[0]
  const inDb = (await db.query('select count(*)::int n from yt_pieces where script_id = $1', [ID])).rows[0].n
  const keys = (await (await fetch(S3 + '/_list')).json()).keys.filter(([k]) => k.startsWith(`/olex/vid/${ID}/`)).length
  check(s.status === 'rendered' && inDb === 0 && keys === 4, `finished, all ${keys} pieces in the bucket (the two failures were retried away)`)
}
if (phase === 'broken') {
  console.log('\n41. Something on the admin side really is broken: the reason is shown to you')
  const s = (await db.query('select status, render_error from yt_scripts where id = $1', [ID])).rows[0]
  check(s.status === 'failed' && /Reason on the admin side: (job|upload): .*yt_pieces/.test(s.render_error), 'the red message names the real cause: “' + (s.render_error || '').slice(0, 150) + '…”')
}
console.log(`  (${pass} passed, ${failn} failed)`)
await db.end(); process.exit(failn ? 1 : 0)
