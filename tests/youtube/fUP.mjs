// Install 2: audio uploads in pieces, streaming with seeking, full downloads, photo crop on screen, full preview
import pg from 'pg'
import { createHash, randomBytes } from 'node:crypto'
import { chromium } from '/home/claude/olexweb-factory/node_modules/playwright/index.mjs'
const APP = 'http://localhost:3000'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0; const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + String(extra).slice(0, 200) : '')) } }
const sess = async (e) => { const u = (await db.query('select id from admin_users where email = $1', [e])).rows[0], t = randomBytes(32).toString('base64url'); await db.query("insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '1 day')", [createHash('sha256').update(t).digest('hex'), u.id]); return t }
const T = await sess('owner@test.local'), E = await sess('editor@test.local')
const up = async (q, body, type, t = T) => { const r = await fetch(APP + '/admin/api/pages/upload' + q, { method: 'POST', headers: { cookie: '__Host-olex_sess=' + t, Origin: APP, 'Content-Type': type }, body }); return { s: r.status, j: await r.json().catch(() => ({})) } }
console.log('\n63. Audio uploads: in 3 MB pieces, streamed back with seeking')
let r = await up('', JSON.stringify({ name: 'a.m4a', mime: 'audio/mp4', bytes: 100 }), 'application/json', E); check(r.s === 403, 'only you can upload')
r = await up('', JSON.stringify({ name: 'x.exe', mime: 'application/octet-stream', bytes: 100 }), 'application/json'); check(r.s === 400 && /audio file/.test(r.j.error), 'non-audio files are refused')
r = await up('', JSON.stringify({ name: 'big.m4a', mime: 'audio/mp4', bytes: 400 * 1024 * 1024 }), 'application/json'); check(r.s === 400 && /300 MB/.test(r.j.error), 'files over 300 MB are refused')
const data = randomBytes(7 * 1024 * 1024 + 12345)
r = await up('', JSON.stringify({ name: 'talk.m4a', mime: 'audio/mp4', bytes: data.length }), 'application/json'); const S = r.j
check(r.s === 200 && S.pieces === 3 && S.pieceSize === 3 * 1024 * 1024, 'a 7 MB recording is split into 3 pieces')
r = await up(`?id=${S.id}&n=0`, data.subarray(0, 1000), 'application/octet-stream'); check(r.s === 400 && /incomplete/.test(r.j.error), 'an incomplete piece is refused (the browser sends it again)')
let url = null; for (let n = 0; n < S.pieces; n++) { r = await up(`?id=${S.id}&n=${n}`, data.subarray(n * S.pieceSize, Math.min(data.length, (n + 1) * S.pieceSize)), 'application/octet-stream'); if (r.j.url) url = r.j.url }
check(url && url === `/media/a/${S.id}.m4a`, 'after the last piece, the recording gets its address', url)
let g = await fetch(APP + url); let b = Buffer.from(await g.arrayBuffer())
check(g.status === 200 && b.length === data.length && b.equals(data) && g.headers.get('content-type') === 'audio/mp4', 'a full download returns the whole file, byte for byte')
g = await fetch(APP + url, { headers: { Range: 'bytes=3145700-3145799' } }); b = Buffer.from(await g.arrayBuffer())
check(g.status === 206 && b.equals(data.subarray(3145700, 3145728)) && g.headers.get('content-range') === `bytes 3145700-3145727/${data.length}`, 'seeking across a piece boundary answers correctly (the player asks again for the rest)', g.headers.get('content-range'))
g = await fetch(APP + url, { headers: { Range: 'bytes=-500' } }); b = Buffer.from(await g.arrayBuffer()); check(g.status === 206 && b.equals(data.subarray(data.length - 500)), 'the last bytes (phones check the end of a file first)')
g = await fetch(APP + '/media/a/' + 'f'.repeat(24) + '.m4a'); check(g.status === 404, 'an unknown recording is “not found”')
console.log('\n64. On screen: chest-up photo crop, recording upload, full preview')
await db.query("delete from pages where slug = 'up-test'"); const pid = (await db.query("insert into pages (slug, type, content) values ('up-test', 'audio', $1) returning id", [JSON.stringify({ title: 'Upload Test', tagline: 'x', host: { name: 'Olaitan Adebayo' }, parts: [{ title: 'Part 1', file: '' }] })])).rows[0].id
const br = await chromium.launch(), ctx = await br.newContext({ viewport: { width: 1440, height: 900 }, extraHTTPHeaders: { cookie: '__Host-olex_sess=' + T } }), p = await ctx.newPage()
await p.goto(APP + '/admin/pages/' + pid, { waitUntil: 'load' }); await p.waitForTimeout(800)
const photo = '/home/claude/Olexweb/public/aoc/host.webp'
await p.locator('.pe-box').filter({ hasText: 'Your host' }).locator('input[type=file]').setInputFiles(photo); await p.waitForTimeout(500)
const fr = await p.evaluate(() => { const f = document.querySelector('.up-frame'); if (!f) return null; const r = f.getBoundingClientRect(); return r.width / r.height })
check(fr && Math.abs(fr - 0.8) < 0.01, 'the crop frame is 4:5 (chest-up), with a guide outline', fr)
await p.screenshot({ path: '/tmp/up-crop.png' }); await p.click('text=Use this photo'); await p.waitForTimeout(1500)
const src = await p.locator('.pe-box').filter({ hasText: 'Your host' }).locator('.pe-photo img').getAttribute('src').catch(() => null)
check(src && src.startsWith('/media/img/'), 'the cropped photo uploads and shows in the editor', src)
const small = Buffer.alloc(200 * 1024 + 7, 1); await p.locator('.pe-box').filter({ hasText: 'Recordings' }).locator('input[type=file]').setInputFiles({ name: 'p1.m4a', mimeType: 'audio/mp4', buffer: small }); await p.waitForTimeout(2500)
check(/✓ [a-f0-9]{24}\.m4a/.test(await p.locator('.pe-box').filter({ hasText: 'Recordings' }).textContent()), 'a recording uploads from the editor and is attached to its part')
await p.click('text=Save draft').catch(() => {}); await p.waitForTimeout(800)
const pv = await ctx.newPage(); await pv.goto(APP + '/admin/pages/' + pid + '/preview', { waitUntil: 'load' }); await pv.waitForTimeout(1500)
check(/Upload Test/.test(await pv.textContent('body')) && /Preview/.test(await pv.textContent('body')), 'Full preview shows the page full-size, marked as a preview')
await br.close(); await db.query('delete from pages where id = $1', [pid])
console.log(`  (${pass} passed, ${failn} failed)`); await db.end(); process.exit(failn ? 1 : 0)
