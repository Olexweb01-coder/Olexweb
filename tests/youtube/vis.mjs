// Is every key part actually ON SCREEN (not just in the page)? Phone and laptop.
import pg from 'pg'
import { chromium } from '/home/claude/olexweb-factory/node_modules/playwright/index.mjs'
const db = new pg.Client({ connectionString: 'postgres://olex:olex@localhost/olexweb' }); await db.connect(); await db.query('delete from aoc_listeners')
let pass = 0, failn = 0; const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + extra : '')) } }
const seen = (p, sel) => p.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return 'missing'; const r = e.getBoundingClientRect(), cs = getComputedStyle(e); let o = 1, n = e; while (n && n.nodeType === 1) { o *= +getComputedStyle(n).opacity; n = n.parentElement }
  return r.width > 0 && r.height > 0 && o > 0.95 && cs.visibility !== 'hidden' && r.top < innerHeight && r.bottom > 0 ? 'yes' : `no (opacity ${o.toFixed(2)}, top ${Math.round(r.top)})` }, sel)
const b = await chromium.launch()
for (const [name, vp, mobile] of [['phone', { width: 390, height: 844 }, true], ['laptop', { width: 1366, height: 768 }, false]]) {
  console.log(`\n49. ${name}: is everything that matters on screen?`)
  const ctx = await b.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile }), p = await ctx.newPage()
  await p.goto('http://localhost:3000/aoc', { waitUntil: 'load' }); await p.waitForTimeout(600)
  const wrap = await p.evaluate(() => ['.brand', '.nav .btn'].every((q) => { const e = document.querySelector(q), r = document.createRange(); r.selectNodeContents(e); const tops = new Set([...r.getClientRects()].filter((x) => x.width > 2).map((x) => Math.round(x.top / 4))); return tops.size <= 2 && e.getBoundingClientRect().height < 56 }))
  check(wrap, 'the header’s name and button each stay on one line')
  for (const [sel, what] of [['h1.title', 'the title'], ['.hero .lead', 'the promise'], ['.proof', 'free · 37 minutes · phone'], ['.hero .btn.g', '“Get free access”'], ['.slots', '“Only 300 slots”']]) check(await seen(p, sel) === 'yes', `first screen shows ${what}`, await seen(p, sel))
  await p.click('.nav .btn'); await p.waitForTimeout(1200)
  check(await seen(p, '#access form input[autocomplete=name]') === 'yes' && await seen(p, '#access .btn.g') === 'yes', 'the header’s “Get access” lands on a visible form', await seen(p, '#access form input[autocomplete=name]'))
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300)
  let all = true, why = ''; for (let i = 1; i <= 5; i++) { await p.evaluate((i) => document.querySelector(`.gets li:nth-child(${i})`).scrollIntoView({ block: 'center' }), i); await p.waitForTimeout(750); const v = await seen(p, `.gets li:nth-child(${i})`); if (v !== 'yes') { all = false; why = `item ${i}: ${v}` } }
  check(all, 'all five “What you’ll get” points appear as you scroll', why)
  const p2 = await ctx.newPage(); await p2.goto('http://localhost:3000/aoc', { waitUntil: 'load' }); await p2.waitForTimeout(3000)
  const hidden = await p2.evaluate(() => [...document.querySelectorAll('.rv')].filter((e) => +getComputedStyle(e).opacity < 0.95).length)
  check(hidden === 0, 'after 3 seconds, nothing is left hidden even without scrolling (the safety net)', hidden + ' hidden')
  check(await p.getAttribute('.links a[href="/"], .nav a[href="/"]', 'href').catch(() => null) === '/' || mobile, 'the header links to the main website (laptop)')
  check(await p.locator('.foot a[href="/"]').count() === 1 && (await p.locator('.foot a').allTextContents()).some((t) => /olexweb\.com/.test(t)), 'the page’s own footer has one link to olexweb.com')
  await p.evaluate(() => document.getElementById('access').scrollIntoView({ block: 'start' })); await p.waitForTimeout(400)
  await p.fill('input[autocomplete=name]', name === 'phone' ? 'Ada Okafor' : 'Tunde Bakare'); await p.check('.tick input', { force: true }); await p.click('#access .btn.g'); await p.waitForTimeout(1500)
  check(await seen(p, '.acard h3') === 'yes' && /Welcome/.test(await p.textContent('.acard h3')), 'after joining, “Welcome, …” is on screen', await seen(p, '.acard h3'))
  check(await seen(p, '.acard a.btn.g[download]') === 'yes', '“Download the full course” is on screen', await seen(p, '.acard a.btn.g[download]'))
  check(await seen(p, '.acard .player .pbtn') === 'yes', 'the player is on screen')
  await p.click('.acard details.more summary'); await p.waitForTimeout(500)
  check(await p.locator('.acard .part').count() === 4 && await p.locator('.acard .part a.mini[download]').count() === 4, '“Or part by part” opens four parts, each with a download')
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(800)
  check(/Welcome/.test(await p.textContent('.acard h3').catch(() => '')), 'coming back later goes straight to the course')
  await ctx.close()
}
console.log(`\n${pass} passed, ${failn} failed`); await b.close(); await db.query('delete from aoc_listeners'); await db.end(); process.exit(failn ? 1 : 0)
