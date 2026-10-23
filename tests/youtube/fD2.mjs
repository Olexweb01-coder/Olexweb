import pg from 'pg'
import fs from 'node:fs'
const APP = 'http://localhost:3000', G = 'http://localhost:4555'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0
const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + extra : '')) } }
const ID2 = Number(fs.readFileSync('/tmp/fid2', 'utf8'))
await db.query("update assistant_settings set mode = 'autopilot'"); await db.query("update yt_idea_runs set last_run = now()")
const t0 = Date.now(), r = await fetch(APP + '/api/assistant/cron?run=due', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } }), j = await r.json()
const S = await (await fetch(G + '/_state')).json(), meta = S.sessions[S.sessions.length - 1].meta
const row = (await db.query('select status from yt_scripts where id = $1', [ID2])).rows[0]
check(j.uploaded && row.status === 'uploaded', 'Autopilot uploaded the finished video by itself', JSON.stringify(j).slice(0, 200))
const at = new Date(meta.status.publishAt)
check(meta.status.privacyStatus === 'private' && at.getUTCHours() === 17 && at.getUTCMinutes() === 30 && at - t0 > 30 * 60e3 && at - t0 < 25 * 3600e3, 'scheduled to go public at the next 18:30 Lagos (17:30 UTC): ' + meta.status.publishAt)
await db.query("update assistant_settings set mode = 'approval'"); await db.query("update yt_settings set publish_mode = 'private'")
console.log(`  (${pass} passed, ${failn} failed)`)
await db.end(); process.exit(failn ? 1 : 0)
