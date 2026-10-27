import pg from 'pg'
import fs from 'node:fs'
const APP = 'http://localhost:3000', G = 'http://localhost:4555'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0
const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + extra : '')) } }
const ID2 = Number(fs.readFileSync('/tmp/fid2', 'utf8')), phase = process.argv[2] || 'all'
await db.query("update yt_settings set yt_mode = 'autopilot'"); await db.query("update yt_idea_runs set last_run = now()")
if (phase !== 'scheduled') {
await db.query("update yt_settings set publish_mode = 'private', publish_time = '00:00'")
await db.query("update yt_scripts set uploaded_at = now() - interval '1 day' where status = 'uploaded'")   // yesterday's upload
let r0 = await fetch(APP + '/api/assistant/cron?run=due', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } }), j0 = await r0.json()
const S0 = await (await fetch(G + '/_state')).json(), m0 = S0.sessions[S0.sessions.length - 1].meta
const st0 = (await db.query('select status from yt_scripts where id = $1', [ID2])).rows[0].status
check(j0.uploaded && st0 === 'uploaded' && m0.status.privacyStatus === 'private' && !m0.status.publishAt, 'before the audit (Private): Autopilot still uploads one finished video a day, as Private, for you to make Public in Studio')
await db.query("update yt_scripts set status = 'rendered', upload = null, yt_video_id = null where id = $1", [ID2])   // make it again for the scheduled check
}
if (phase === 'private') { await db.query("update yt_scripts set status = 'approved', upload = null, yt_video_id = null where id = $1", [ID2]); console.log(`  (${pass} passed, ${failn} failed)`); await db.end(); process.exit(failn ? 1 : 0) }
await db.query("update yt_settings set publish_mode = 'scheduled', publish_time = '18:30'")
await db.query("update yt_scripts set uploaded_at = now() - interval '1 day' where status = 'uploaded'")   // yesterday's upload
const t0 = Date.now(), r = await fetch(APP + '/api/assistant/cron?run=due', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } }), j = await r.json()
const S = await (await fetch(G + '/_state')).json(), meta = S.sessions[S.sessions.length - 1].meta
const row = (await db.query('select status from yt_scripts where id = $1', [ID2])).rows[0]
check(j.uploaded && row.status === 'uploaded', 'Autopilot uploaded the finished video by itself', JSON.stringify(j).slice(0, 200))
const at = new Date(meta.status.publishAt)
check(meta.status.privacyStatus === 'private' && at.getUTCHours() === 17 && at.getUTCMinutes() === 30 && at - t0 > 30 * 60e3 && at - t0 < 25 * 3600e3, 'scheduled to go public at the next 18:30 Lagos (17:30 UTC): ' + meta.status.publishAt)
await db.query("insert into yt_scripts (idea_id, status, script, package, video, approved_at) select (select id from yt_ideas where name ilike 'PaletteForge%' limit 1), 'rendered', script, package, video, now() from yt_scripts where id = $1 on conflict (idea_id) do update set status = 'rendered'", [ID2]).catch((e) => console.log('   (setup:', e.message, ')'))
const r2 = await fetch(APP + '/api/assistant/cron?run=due', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } }), j2 = await r2.json()
const waiting = (await db.query("select count(*)::int n from yt_scripts where status = 'rendered'")).rows[0].n
const days = (await db.query("select upload from yt_scripts where status = 'uploaded' and uploaded_at > now() - interval '1 hour'")).rows.map((r) => r.upload && r.upload.publishAt && r.upload.publishAt.slice(0, 10))
check(new Set(days).size === days.length, 'one a day: every scheduled video gets its own day, never two on the same day (' + days.join(', ') + ')')
await db.query("update yt_settings set yt_mode = 'approval'"); await db.query("update yt_settings set publish_mode = 'private', publish_time = '18:00'")
console.log(`  (${pass} passed, ${failn} failed)`)
await db.end(); process.exit(failn ? 1 : 0)
