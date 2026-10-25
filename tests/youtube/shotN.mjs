import pg from 'pg'
import { chromium } from '/home/claude/olexweb-factory/node_modules/playwright/index.mjs'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
await db.query('delete from aoc_listeners'); await db.query("update aoc_settings set goal = 50, accepting = true, content = '{}' where id = 1")
const b = await chromium.launch()
const shoot = async (path, vp, full, mobile) => { const p = await b.newPage({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile }); await p.goto('http://localhost:3000/aoc', { waitUntil: 'load' }); await p.waitForTimeout(700)
  if (full) { await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 100)) } scrollTo(0, 0) }); await p.waitForTimeout(800) }
  await p.screenshot({ path, fullPage: full }); await p.close() }
const { createHash, randomBytes } = await import('node:crypto')
const u = (await db.query("select id from admin_users where email='owner@test.local'")).rows[0], T = randomBytes(32).toString('base64url')
await db.query("insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '1 day')", [createHash('sha256').update(T).digest('hex'), u.id])
const join = (name, ip) => fetch('http://localhost:3000/api/aoc', { method: 'POST', headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json', 'x-forwarded-for': '10.9.0.' + ip }, body: JSON.stringify({ action: 'join', name, consent: true }) })
const admin = (body) => fetch('http://localhost:3000/admin/api/aoc', { method: 'POST', headers: { cookie: '__Host-olex_sess=' + T, Origin: 'http://localhost:3000', 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const seats = async (to) => { const now = (await db.query('select count(*)::int n from aoc_listeners')).rows[0].n; for (let i = now; i < to; i++) await db.query("insert into aoc_listeners (token, name) values ($1, 'x')", ['t' + i + Math.random()]) }
const snap = async (path) => { const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await p.goto('http://localhost:3000/aoc', { waitUntil: 'load' }); await p.waitForTimeout(500)
  await p.evaluate(() => document.querySelector('.cta-box').scrollIntoView({ block: 'center' })); await p.waitForTimeout(300); await p.screenshot({ path }); await p.close() }
await db.query('delete from aoc_listeners'); await seats(29); await join('Thirtieth', 1); await new Promise((r) => setTimeout(r, 400)); await fetch('http://localhost:3000/aoc'); await snap('/tmp/n-few.png')
await seats(49); await join('Fiftieth', 2); await new Promise((r) => setTimeout(r, 400)); await fetch('http://localhost:3000/aoc'); await snap('/tmp/n-bonus.png')
await admin({ action: 'accepting', on: false }); await new Promise((r) => setTimeout(r, 400)); await fetch('http://localhost:3000/aoc'); await snap('/tmp/n-closed.png')
await admin({ action: 'accepting', on: true })
await b.close(); await db.query('delete from aoc_listeners'); await db.query('update aoc_settings set accepting = true where id = 1'); await db.end()
