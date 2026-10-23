import pg from 'pg'
import fs from 'node:fs'
import { createHmac, createHash } from 'node:crypto'
const APP = 'http://localhost:3000', G = 'http://localhost:4555', S3 = 'http://localhost:4560'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0
const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + extra : '')) } }
const ID = Number(fs.readFileSync('/tmp/fid', 'utf8')), T = fs.readFileSync('/tmp/ftok', 'utf8'), SECRET = process.env.FACTORY_SECRET
const md5 = (b) => createHash('md5').update(b).digest('hex')
const orig = fs.readFileSync('/home/claude/olexweb-factory/out/video.mp4')
const owner = { cookie: '__Host-olex_sess=' + T }

console.log('\n33. The video arrived')
const s = (await db.query('select status, video, part from yt_scripts where id = $1', [ID])).rows[0]
check(s.status === 'rendered' && s.video.pieces === Math.ceil(orig.length / 1048576) && s.video.bytes === orig.length, `stored as ${s.video.pieces} pieces, ${s.video.bytes} bytes, ${s.video.seconds}s, ${s.video.width}×${s.video.height}`)
const keys = (await (await fetch(S3 + '/_list')).json())
check(keys.keys.filter(([k]) => k.startsWith(`/olex/vid/${ID}/`)).length === s.video.pieces && keys.log.filter((l) => l.startsWith('PUT')).every((l) => l.endsWith('signed')), 'every piece is in the private bucket, uploaded with a signed request')
const prog = (await (await fetch(APP + '/admin/api/youtube?progress=render', { headers: owner })).json()).progress
check(prog.finished && !prog.error && prog.stages.every((x) => x.secs != null), 'the progress panel shows it finished, every stage with its time: ' + prog.stages.map((x) => x.key + ' ' + x.secs + 's').join(', '))

console.log('\n34. Watching it in the admin')
let r = await fetch(APP + `/admin/api/youtube/video?id=${ID}`, { headers: { ...owner, Range: 'bytes=0-' } })
check(r.status === 206 && Number(r.headers.get('content-length')) <= 1048576 && r.headers.get('content-type') === 'video/mp4', 'the player gets the start of the video (one piece at a time, as the browser asks)')
const parts = []; let at = 0
while (at < orig.length) { const x = await fetch(APP + `/admin/api/youtube/video?id=${ID}`, { headers: { ...owner, Range: `bytes=${at}-` } }); const b = Buffer.from(await x.arrayBuffer()); if (!b.length) break; parts.push(b); at += b.length }
check(md5(Buffer.concat(parts)) === md5(orig), 'read back piece by piece, the video is byte-for-byte the one the factory made')
r = await fetch(APP + `/admin/api/youtube/video?id=${ID}`, { headers: { ...owner, Range: 'bytes=1048500-1048700' } }); let b = Buffer.from(await r.arrayBuffer())
check(r.status === 206 && r.headers.get('content-range') === `bytes 1048500-1048575/${orig.length}` && md5(b) === md5(orig.subarray(1048500, 1048576)), 'seeking across a piece boundary returns exactly the right bytes')
r = await fetch(APP + `/admin/api/youtube/video?id=${ID}`, { headers: { ...owner, Range: 'bytes=-1000' } }); b = Buffer.from(await r.arrayBuffer())
check(r.status === 206 && md5(b) === md5(orig.subarray(orig.length - 1000)), 'the last bytes (where some players look first) come back right too')
r = await fetch(APP + `/admin/api/youtube/video?id=${ID}`, { headers: { Range: 'bytes=0-' } }); check(r.status === 401, 'nobody signed out can watch it')
let html = (await (await fetch(APP + '/admin/youtube?view=scripts', { headers: owner })).text()).replace(/<!-- -->/g, '')
check(html.includes(`/admin/api/youtube/video?id=${ID}`) && html.includes(`Part ${s.part} is ready`) && html.includes('Make it again'), 'the Scripts tab shows the player, “Part ' + s.part + ' is ready” and “Make it again”')

console.log('\n35. Only the real factory gets in')
const signed = (path, body, { secret = SECRET, ts = Math.floor(Date.now() / 1000), raw = false, hashOf } = {}) => {
  const buf = raw ? body : Buffer.from(JSON.stringify(body)), h = createHash('sha256').update(hashOf || buf).digest('hex')
  return fetch(APP + path, { method: 'POST', headers: { 'x-factory-sig': ts + '.' + createHmac('sha256', secret).update(`${ts}\nPOST\n${path}\n${h}`).digest('hex'), 'Content-Type': 'application/json' }, body: buf }) }
r = await fetch(APP + `/api/factory/job?id=${ID}`, { method: 'POST', body: '{}' }); check(r.status === 401, 'no signature → refused')
r = await signed(`/api/factory/job?id=${ID}`, {}, { secret: 'wrong-secret-wrong-secret-wrong-secret-00' }); check(r.status === 401, 'the wrong secret → refused')
r = await signed(`/api/factory/job?id=${ID}`, {}, { ts: Math.floor(Date.now() / 1000) - 600 }); check(r.status === 401, 'an old (replayed) signature → refused')
r = await signed(`/api/factory/report?id=${ID}`, { error: 'x' }, { hashOf: Buffer.from('{}') }); check(r.status === 401, 'a changed body under a valid signature → refused')
r = await signed(`/api/factory/job?id=${ID + 1}`, {}, { hashOf: undefined }).then(async (x) => x); check(r.status === 409, 'a valid signature for a video that isn’t in the factory → refused')
r = await signed(`/api/factory/upload?id=${ID}&n=0`, Buffer.alloc(5 * 1024 * 1024), { raw: true }); check(r.status === 413, 'a piece over the size limit → refused')
r = await signed(`/api/factory/../factory/job?id=${ID}`, {}); check(r.status >= 400, 'odd paths are refused')
r = await signed(`/api/factory/delete?id=${ID}`, {}); check(r.status === 404, 'unknown actions don’t exist')

console.log('\n36. When things go wrong')
const post = (body) => fetch(APP + '/admin/api/youtube', { method: 'POST', headers: { ...owner, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
await fetch(G + '/_set?ghDown=true'); r = await post({ action: 'send-to-factory', id: ID }); let j = await r.json()
let row = (await db.query('select status, render_error, part from yt_scripts where id = $1', [ID])).rows[0]
check(r.status === 400 && /FACTORY_GH_TOKEN/.test(j.error) && row.status === 'failed' && row.part === s.part, 'GitHub refusing the token: a plain reason, marked as stopped, and the part number is kept: “' + j.error.slice(0, 70) + '…”')
await fetch(G + '/_set?ghDown=false'); r = await post({ action: 'send-to-factory', id: ID }); j = await r.json()
check(r.status === 200 && j.part === s.part, '“Try again” sends it again as the same part ' + j.part)
r = await signed(`/api/factory/job?id=${ID}`, {}); await r.json()
r = await signed(`/api/factory/upload?id=${ID}&n=0`, orig.subarray(0, 1048576), { raw: true }); check(r.status === 200, 'a new attempt starts fresh and accepts pieces again')
r = await signed(`/api/factory/finish?id=${ID}`, { pieces: 4, bytes: orig.length, seconds: 10 }); j = await r.json()
row = (await db.query('select status, render_error from yt_scripts where id = $1', [ID])).rows[0]
check(r.status === 409 && row.status === 'failed' && /incomplete/.test(row.render_error), 'a video missing pieces is never accepted: “' + row.render_error + '”')
await post({ action: 'send-to-factory', id: ID }); await signed(`/api/factory/job?id=${ID}`, {})
r = await signed(`/api/factory/report?id=${ID}`, { error: 'squoosh.app didn’t load for filming (timeout)' })
row = (await db.query('select status, render_error from yt_scripts where id = $1', [ID])).rows[0]
const p2 = (await (await fetch(APP + '/admin/api/youtube?progress=render', { headers: owner })).json()).progress
check(row.status === 'failed' && /didn’t load/.test(row.render_error) && p2.error && p2.finished, 'the factory’s own error reaches the admin and the progress panel')
await post({ action: 'send-to-factory', id: ID }); await db.query("update yt_scripts set updated_at = now() - interval '30 minutes' where id = $1", [ID])
r = await fetch(APP + '/api/assistant/cron?run=due', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } })
row = (await db.query('select status, render_error from yt_scripts where id = $1', [ID])).rows[0]
check(row.status === 'failed' && /stopped reporting/.test(row.render_error), 'a run that went silent for 25 minutes is marked stopped, so the next video can go')

console.log(`\n${pass} passed, ${failn} failed`)
await db.end(); process.exit(failn ? 1 : 0)
