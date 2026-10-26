import { chromium } from '/home/claude/olexweb-factory/node_modules/playwright/index.mjs'
const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true }), p = await ctx.newPage(), cdp = await ctx.newCDPSession(p)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); let bytes = 0; p.on('response', async (r) => { try { bytes += (await r.body()).length } catch {} })
await p.addInitScript(() => { window.__f = []; let last = performance.now(); const loop = (t) => { window.__f.push(t - last); last = t; requestAnimationFrame(loop) }; requestAnimationFrame(loop)
  window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true })
  new PerformanceObserver((l) => { const e = l.getEntries(); window.__lcp = e[e.length - 1].startTime }).observe({ type: 'largest-contentful-paint', buffered: true }) })
for (const path of ['/build-live', '/meetup']) {
  const t0 = Date.now(); await p.goto('http://localhost:3000' + path, { waitUntil: 'load' }); const load = Date.now() - t0; await p.waitForTimeout(3500)
  const a = await p.evaluate(() => { const f = window.__f.slice(5); return { fps: Math.round(1000 / (f.reduce((x, y) => x + y, 0) / f.length)), long: f.filter((x) => x > 50).length, cls: window.__cls, lcp: Math.round(window.__lcp || 0) } })
  await p.evaluate(() => { window.__f = [] }); for (let y = 0; y < 2000; y += 60) { await p.evaluate((y) => scrollTo(0, y), y); await p.waitForTimeout(30) }
  const s = await p.evaluate(() => { const f = window.__f.slice(2); return { fps: Math.round(1000 / (f.reduce((x, y) => x + y, 0) / f.length)), long: f.filter((x) => x > 50).length } })
  console.log(`${path}: loaded ${load} ms · opening ${a.fps} fps (${a.long} slow frames) · scrolling ${s.fps} fps (${s.long} slow) · CLS ${a.cls.toFixed(3)} · biggest content ${a.lcp} ms · ${Math.round(bytes / 1024)} KB`); bytes = 0
}
await b.close()
