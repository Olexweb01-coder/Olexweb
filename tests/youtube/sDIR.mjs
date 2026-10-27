import { chromium } from '/home/claude/olexweb-factory/node_modules/playwright/index.mjs'
const b = await chromium.launch()
for (const [path, out] of [['/tools/dirtool', '/tmp/d-entry.png'], ['/tools', '/tmp/d-lib.png']]) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true }); await p.goto('http://localhost:3000' + path, { waitUntil: 'load' }); await p.waitForTimeout(1800)
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 90)) } scrollTo(0, 0) }); await p.waitForTimeout(900)
  await p.screenshot({ path: out, fullPage: true }); const wide = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1); console.log(path, 'spills sideways:', wide); await p.close() }
const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true }), p = await c.newPage(), cdp = await c.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
await p.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }); new PerformanceObserver((l) => { const e = l.getEntries(); window.__lcp = e[e.length - 1].startTime }).observe({ type: 'largest-contentful-paint', buffered: true }) })
let bytes = 0; p.on('response', async (r) => { try { bytes += (await r.body()).length } catch {} })
await p.goto('http://localhost:3000/tools/dirtool', { waitUntil: 'load' }); await p.waitForTimeout(3000); const m = await p.evaluate(() => ({ cls: window.__cls, lcp: Math.round(window.__lcp || 0) }))
console.log(`budget phone: CLS ${m.cls.toFixed(3)} · main content ${m.lcp} ms · ${Math.round(bytes / 1024)} KB`); await b.close()
