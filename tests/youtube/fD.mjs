import pg from 'pg'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
const APP = 'http://localhost:3000', G = 'http://localhost:4555', S3 = 'http://localhost:4560'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0
const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + extra : '')) } }
const ID = Number(fs.readFileSync('/tmp/fid', 'utf8')), T = fs.readFileSync('/tmp/ftok', 'utf8'), ED = process.argv[2]
const orig = fs.readFileSync('/home/claude/olexweb-factory/out/video.mp4'), md5 = createHash('md5').update(orig).digest('hex')
const post = (body, t = T) => fetch(APP + '/admin/api/youtube', { method: 'POST', headers: { cookie: '__Host-olex_sess=' + t, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const st = async () => (await fetch(G + '/_state')).json()
const made0 = (await db.query('select made from yt_settings')).rows[0].made
await db.query("update yt_settings set publish_mode = 'private'")

console.log('\n37. Uploading to YouTube')
let r = await post({ action: 'upload', id: ID }, ED); check(r.status === 403, 'an editor can’t upload')
await fetch(G + '/_set?quota=true'); r = await post({ action: 'upload', id: ID }); let j = await r.json()
let row = (await db.query('select status from yt_scripts where id = $1', [ID])).rows[0]
check(r.status === 400 && /allowance/.test(j.error) && row.status === 'rendered', 'out of quota: a plain message, and the video stays ready: “' + j.error.slice(0, 60) + '…”')
await fetch(G + '/_set?quota=false&failOnce=true'); r = await post({ action: 'upload', id: ID }); j = await r.json()
row = (await db.query('select status, upload from yt_scripts where id = $1', [ID])).rows[0]
check(r.status === 400 && /carries on/.test(j.error) && row.status === 'rendered' && row.upload && row.upload.url, 'the connection drops mid-upload: it says so, and remembers the session')
const sent1 = (await st()).uploadedBytes
r = await post({ action: 'upload', id: ID }); j = await r.json(); const S = await st()
check(r.status === 200 && j.video === 'ytNew' + S.sessions.length && S.sessions.length === 1, `pressing Upload again carried on from ${(sent1 / 1048576).toFixed(1)} MB in the same session (no second upload)`, JSON.stringify(j))
check(S.uploadMd5 === md5, 'YouTube received the video byte-for-byte as the factory made it')
const m = S.sessions[0].meta
const part = (await db.query('select part from yt_scripts where id = $1', [ID])).rows[0].part
check(m.snippet.title.startsWith(`Secret Websites You Should Know (Part ${part}) | `) && m.snippet.title.length <= 100, 'the title carries the series and part: “' + m.snippet.title + '”')
const job = JSON.parse(fs.readFileSync('/home/claude/olexweb-factory/work/job.json', 'utf8'))
check(job.intro === `Secret websites you should know, part ${part}.`, 'the factory was told to open with “' + job.intro + '”')
check(m.status.privacyStatus === 'private' && !m.status.publishAt && m.status.selfDeclaredMadeForKids === false && m.status.containsSyntheticMedia === false && m.snippet.categoryId === '28' && m.snippet.tags.every((t) => !t.startsWith('#')), 'sent as private, not made for kids, Science & Technology, tags without #')
row = (await db.query('select s.status, s.yt_video_id, i.status as idea from yt_scripts s join yt_ideas i on i.id = s.idea_id where s.id = $1', [ID])).rows[0]
const made1 = (await db.query('select made from yt_settings')).rows[0].made
check(row.status === 'uploaded' && row.yt_video_id === j.video && row.idea === 'made' && made1 === made0 + 1, 'marked uploaded with its YouTube id; the idea is “made”; the video count went up (for the every-4th olexweb.com mention)')
const keys = (await (await fetch(S3 + '/_list')).json()).keys.filter(([k]) => k.startsWith(`/olex/vid/${ID}/`))
check(keys.length === 0, 'the stored copy was deleted to free the space')
let html = (await (await fetch(APP + '/admin/youtube?view=scripts', { headers: { cookie: '__Host-olex_sess=' + T } })).text()).replace(/<!-- -->/g, '')
check(html.includes('On YouTube as part') && html.includes('studio.youtube.com/video/' + j.video), 'the Scripts tab links to the video and to YouTube Studio')
r = await post({ action: 'upload', id: ID }); check(r.status === 400, 'it can’t be uploaded twice')

console.log('\n38. Scheduled publishing, by Autopilot')
r = await post({ action: 'publish-settings', mode: 'scheduled', time: '25:00', series: 'Secret websites you should know' }); check(r.status === 400, 'a nonsense time is refused')
r = await post({ action: 'publish-settings', mode: 'private', time: '18:00', series: 'ab' }); check(r.status === 400, 'a too-short series name is refused')
r = await post({ action: 'publish-settings', mode: 'scheduled', time: '18:30', series: 'Powerful websites you should know', inTitle: true, intro: true }); j = await r.json()
check(r.status === 200 && j.publish_mode === 'scheduled' && j.series === 'Powerful websites you should know', 'scheduled daily at 18:30 Lagos, and the series renamed to “Powerful websites you should know”')
await post({ action: 'publish-settings', mode: 'scheduled', time: '18:30', series: 'Secret websites you should know', inTitle: true, intro: true })
fs.writeFileSync('/tmp/fid2', '')
console.log(`  (${pass} passed, ${failn} failed so far)`)
await db.end(); process.exit(failn ? 1 : 0)
