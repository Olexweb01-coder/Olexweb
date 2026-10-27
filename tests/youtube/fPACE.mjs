// Blog pace: any number from 1 to 21 a week; even spacing; the frequent run writes only when the pace is above 3
import pg from 'pg'
import { chromium } from '/home/claude/olexweb-factory/node_modules/playwright/index.mjs'
import { createHash, randomBytes } from 'node:crypto'
const APP = 'http://localhost:3000'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect()
let pass = 0, failn = 0; const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + String(extra).slice(0, 200) : '')) } }
const u = (await db.query("select id from admin_users where email='owner@test.local'")).rows[0], T = randomBytes(32).toString('base64url')
await db.query("insert into sessions (id_hash,user_id,expires_at) values ($1,$2,now()+interval '1 day')", [createHash('sha256').update(T).digest('hex'), u.id])
const save = (pace) => fetch(APP + '/admin/api/assistant', { method: 'POST', headers: { cookie: '__Host-olex_sess=' + T, Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'settings', mode: 'approval', pace, hours: 24, topics: ['AI tools'], socials: [] }) })
const pace = async () => (await db.query('select pace from assistant_settings')).rows[0].pace
console.log('\n68. Blog pace: as many a week as you want (up to 21)')
let r = await save(7); check(r.status === 200 && await pace() === 7, '7 a week saves (the old limit was 3)')
r = await save(30); check(await pace() === 21, 'more than 21 is capped at 21 (3 a day)')
let bad = null; try { await db.query('update assistant_settings set pace = 22') } catch (e) { bad = e.message } check(/check/.test(bad || ''), 'the database itself refuses more than 21')
const br = await chromium.launch(), ctx = await br.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { cookie: '__Host-olex_sess=' + T } }), pg2 = await ctx.newPage()
await pg2.goto(APP + '/admin/assistant', { waitUntil: 'load' }); await pg2.waitForTimeout(700); await pg2.getByRole('button', { name: /How it works/ }).first().click().catch(() => {}); await pg2.waitForTimeout(500)
const txt = await pg2.textContent('body'); await pg2.fill('input[aria-label="Custom articles a week"]', '10').catch(() => {}); await pg2.waitForTimeout(200); const note = await pg2.textContent('body')
check(/5 a week/.test(txt) && /7 a week/.test(txt) && /Custom/.test(txt), 'Settings show 1, 2, 3, 5, 7 a week and Custom')
check(/about one every 13 hours/.test(note), 'typing 10 a week explains the spacing: “about one every 13 hours”'); await br.close()
console.log('\n69. The frequent run writes drafts only above 3 a week')
await db.query("delete from audit_log where action = 'assistant_drafted'"); await db.query("update assistant_settings set paused_until = null, research_at = now()")
await db.query("update research_items set used_by = null where false"); await db.query("insert into research_items (topic, why, sources) values ('Test topic for pace', 'why', '[{\"title\":\"x\",\"url\":\"https://example.com\",\"from\":\"test\"}]')")
const run = async () => (await (await fetch(APP + '/api/assistant/cron?run=due', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } })).json())
await save(2); let j = await run(); check(!j.drafted && !(j.errors || []).some((e) => /blog draft/.test(e)), 'at 2 a week, the frequent run leaves blog drafting to the morning run (as before)')
await save(7); j = await run(); check(j.drafted || (j.errors || []).some((e) => /blog draft/.test(e)), 'at 7 a week, the frequent run starts a draft when one is due', JSON.stringify(j).slice(0, 200))
await db.query("insert into audit_log (action, detail) values ('assistant_drafted', '{}')"); j = await run(); check(!j.drafted && !(j.errors || []).some((e) => /blog draft/.test(e)), 'right after a draft, it waits for the spacing (about 19 hours at 7 a week)')
await save(2); await db.query("delete from research_items where topic = 'Test topic for pace'"); await db.query("delete from audit_log where action = 'assistant_drafted'")
console.log(`  (${pass} passed, ${failn} failed)`); await db.end(); process.exit(failn ? 1 : 0)
