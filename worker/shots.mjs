// Portfolio screenshots (Install 28). Started by the Olexweb admin through the "shots" workflow when a project is added
// from a link. It opens the site in a real browser like a visitor (cookie banners cleared, lazy pictures loaded), then
// sends back: the whole page, the first screen, the best sections (the headings Olex AI chose) and the phone view.
// Usage: node worker/shots.mjs --id 7   (OLEX_API, FACTORY_SECRET in env)
import { call } from './api.mjs'

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d }
const ID = Number(arg('id', process.env.JOB_ID))
if (!Number.isInteger(ID) || ID < 1) { console.error('Give the job id: --id 7'); process.exit(2) }
const test = (process.env.FACTORY_TEST_HOSTS || '').split(',').filter(Boolean)
const log = (s) => console.log(new Date().toISOString().slice(11, 19) + '  ' + s)
const MAX_FULL = 7000                                                         // px: a very long page is cut here (still the top of it)

async function tidy(page) {
  await page.waitForTimeout(1500)
  for (let round = 0; round < 3; round++) {                                   // cookie banners and pop-ups, as a visitor would
    let cleared = false
    for (const name of [/^accept( all)?( cookies)?$/i, /^(i )?agree$/i, /^allow all$/i, /^got it!?$/i, /^ok(ay)?$/i, /^continue$/i, /^dismiss$/i, /^close$/i, /^no,? thanks$/i, /^reject( all)?$/i, /^×$/]) {
      const b = page.getByRole('button', { name }).first()
      if (await b.isVisible({ timeout: 250 }).catch(() => false)) { await b.click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(400); cleared = true; break }
    }
    if (!cleared) break
  }
  // scroll down and back so lazy pictures and scroll animations load, then wait for the pictures
  await page.evaluate(async () => { const H = Math.min(document.body.scrollHeight, 9000); for (let y = 0; y < H; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)) } window.scrollTo(0, 0) })
  await page.evaluate(() => Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 4000) }))))
  await page.waitForTimeout(800)
}
async function send(label, buf) { await call(`/api/factory/shot?id=${ID}&label=${encodeURIComponent(label)}`, buf, { raw: true }); log('sent: ' + label + ' (' + Math.round(buf.length / 1024) + ' KB)') }

let browser
try {
  const job = await call(`/api/factory/shotjob?id=${ID}`, {})
  const u = new URL(job.url); if (u.protocol !== 'https:' && !test.includes(u.host)) throw new Error('only https sites are opened')
  log('opening ' + u.host)
  const { chromium } = await import('playwright')
  browser = await chromium.launch()
  // the desktop: the whole page, the first screen, the best sections
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'en-GB' })
  const page = await ctx.newPage()
  const r = await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 45000 })
  if (r && r.status() >= 400) throw new Error('the site answered ' + r.status())
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await tidy(page)
  const H = await page.evaluate(() => document.documentElement.scrollHeight)
  await send('full', await page.screenshot({ type: 'jpeg', quality: 82, fullPage: H <= MAX_FULL, clip: H > MAX_FULL ? { x: 0, y: 0, width: 1440, height: MAX_FULL } : undefined }))
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300)
  await send('hero', await page.screenshot({ type: 'jpeg', quality: 85 }))
  let parts = 0
  for (const h of (job.best || []).slice(0, 4)) {
    const el = page.locator('h1, h2, h3').filter({ hasText: h }).first()
    if (!(await el.count().catch(() => 0))) continue
    const y = await el.evaluate((e) => e.getBoundingClientRect().top + window.scrollY).catch(() => null); if (y == null) continue
    await page.evaluate((top) => window.scrollTo(0, Math.max(0, top - 90)), y); await page.waitForTimeout(700)
    await send('part:' + h, await page.screenshot({ type: 'jpeg', quality: 85 })); parts++
  }
  await ctx.close()
  // the phone
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'en-GB' })
  const pp = await phone.newPage(); await pp.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 45000 }); await pp.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await tidy(pp); await send('phone', await pp.screenshot({ type: 'jpeg', quality: 85 })); await phone.close()
  await call(`/api/factory/shotdone?id=${ID}`, {}); log(`done: whole page, first screen, ${parts} section${parts === 1 ? '' : 's'}, phone`)
} catch (e) {
  log('failed: ' + e.message)
  await call(`/api/factory/shotdone?id=${ID}`, { error: 'The screenshots failed: ' + String(e.message).slice(0, 200) }).catch(() => {})
  process.exitCode = 1
} finally { if (browser) await browser.close().catch(() => {}) }
