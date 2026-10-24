import { chromium } from '/home/claude/olexweb-factory/node_modules/playwright/index.mjs'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const p = await ctx.newPage(), cdp = await ctx.newCDPSession(p)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })          // a budget phone
await p.addInitScript(() => {
  window.__m = { long: [], shift: 0, lcp: 0, frames: [] }
  new PerformanceObserver((l) => l.getEntries().forEach((e) => __m.long.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: true })
  new MutationObserver(() => { if (!__m.go && document.querySelector('.aoc.go')) __m.go = performance.now() }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] })
  new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) __m.shift += e.value })).observe({ type: 'layout-shift', buffered: true })
  new PerformanceObserver((l) => l.getEntries().forEach((e) => { __m.lcp = Math.round(e.startTime) })).observe({ type: 'largest-contentful-paint', buffered: true })
  const tick = (t) => { __m.frames.push(t); requestAnimationFrame(tick) }; requestAnimationFrame(tick)
})
const t0 = Date.now(); await p.goto('http://localhost:3000/aoc', { waitUntil: 'load' }); const loadMs = Date.now() - t0
await p.waitForTimeout(3500)
const fps = async (label, from) => { const r = await p.evaluate((from) => { const f = __m.frames.filter((t) => t >= from); const gaps = f.slice(1).map((t, i) => t - f[i]); return { fps: Math.round((f.length - 1) / ((f.at(-1) - f[0]) / 1000)), worst: Math.round(Math.max(...gaps)), janky: gaps.filter((g) => g > 50).length } }, from); console.log(`  ${label.padEnd(26)} ${r.fps} fps · slowest frame ${r.worst} ms · frames over 50 ms: ${r.janky}`) }
console.log('Budget phone (CPU 4× slower):'); console.log(`  page loaded in ${loadMs} ms`)
await fps('first 3.5 s after load', 0)
let mark = await p.evaluate(() => performance.now())
for (let i = 0; i < 8; i++) { await p.evaluate(() => scrollBy({ top: 220, behavior: 'smooth' })); await p.waitForTimeout(350) }
await fps('scrolling', mark)
await p.evaluate(() => document.getElementById('access').scrollIntoView({ block: 'start' })); await p.waitForTimeout(400)
await p.fill('input[autocomplete=name]', 'Ada Okafor'); await p.check('.tick input', { force: true })
mark = await p.evaluate(() => performance.now()); await p.click('#access .btn.g'); await p.waitForTimeout(2500)
await fps('joining (welcome, bulb lights)', mark)
await p.evaluate(() => { const a = document.querySelector('audio'); a.muted = true }); mark = await p.evaluate(() => performance.now())
await p.click('.pbtn'); await p.waitForTimeout(3000); await fps('player drawing (as if playing)', mark)
const m = await p.evaluate(() => ({ long: __m.long, shift: Math.round(__m.shift * 1000) / 1000, lcp: __m.lcp,
  bytes: performance.getEntriesByType('resource').filter((e) => !/\.m4a/.test(e.name)).reduce((n, e) => n + (e.transferSize || e.encodedBodySize || 0), 0) + (performance.getEntriesByType('navigation')[0].transferSize || 0) }))
console.log(`  freezes over 50 ms: ${m.long.length}${m.long.length ? ' (' + m.long.map(([t, d]) => d + ' ms at ' + t).join(', ') + ')' : ''}`)
console.log(`  layout jumps (CLS): ${m.shift}   (good is under 0.1)`)
console.log(`  biggest content shown at: ${m.lcp} ms   (good is under 2500)`)
console.log(`  downloaded to show the page: ${Math.round(m.bytes / 1024)} KB (the audio streams only when played)`)
await b.close()
