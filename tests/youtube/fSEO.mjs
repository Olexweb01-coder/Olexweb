// Install 30: pages for what people search (and for AI answers), the Services hub, llms.txt, and optional PostHog analytics.
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('playwright')
const APP = 'http://localhost:3000', G = 'http://localhost:4555'
let pass = 0, failn = 0; const check = (ok, what, extra = '') => { if (ok) { pass++; console.log('  ✓ ' + what) } else { failn++; console.log('  ✗ ' + what + (extra ? '  → ' + String(extra).slice(0, 300) : '')) } }
const SLUGS = ['website-design-lagos', 'small-business-website-nigeria', 'ecommerce-website-nigeria', 'web-app-development-nigeria', 'best-business-website', 'website-cost-nigeria', 'seo-services-nigeria', 'geo-ai-search-optimisation', 'ai-for-business-nigeria', 'digital-transformation-nigeria', 'website-redesign', 'church-website-nigeria', 'school-website-nigeria', 'restaurant-website-nigeria', 'real-estate-website-nigeria', 'hotel-website-nigeria']
console.log('\n220. A page for each search')
const bad = [], titles = new Set()
for (const s of SLUGS) {
  const r = await fetch(APP + '/services/' + s), h = await r.text(), t = (h.match(/<title>([^<]*)<\/title>/) || [])[1]
  if (r.status !== 200 || !h.includes('"Service"') || !h.includes('"FAQPage"') || !h.includes('"BreadcrumbList"') || !/<h1[^>]*>/.test(h) || !h.includes(`<link rel="canonical" href="https://olexweb.com/services/${s}"/>`)) bad.push(s + ' ' + r.status)
  titles.add(t)
}
check(!bad.length, `all ${SLUGS.length} service and guide pages answer, each with its own canonical address, heading, service details and questions for Google`, bad.join(', '))
check(titles.size === SLUGS.length, 'every page has its own title')
const hub = await (await fetch(APP + '/services')).text()
check(SLUGS.every((s) => hub.includes(`href="/services/${s}"`)) && hub.includes('href="/olex-ai"') && hub.includes('"ItemList"'), 'olexweb.com/services links to every one (and Olex AI)')
const sm = await (await fetch(APP + '/sitemap.xml')).text(); check(SLUGS.every((s) => sm.includes(`/services/${s}</loc>`)) && sm.includes('/services</loc>'), 'all in the sitemap')
const llms = await (await fetch(APP + '/llms.txt')).text(); check(SLUGS.every((s) => llms.includes(`https://olexweb.com/services/${s}`)) && llms.includes('## Olex AI') && llms.includes('GEO'), 'llms.txt tells AI assistants about all of them')
const home = await (await fetch(APP + '/')).text(); check(home.includes('href=\\"/services\\"') || home.includes('href="/services"'), 'every footer links to All services')
const rb = await (await fetch(APP + '/robots.txt')).text(); check(/GPTBot/.test(rb) && /PerplexityBot/.test(rb) && /ClaudeBot/.test(rb), 'AI assistants are allowed to read the site')

console.log('\n221. Visitor analytics (PostHog)')
const b = await chromium.launch(), p = await (await b.newContext()).newPage()
const before = ((await (await fetch(G + '/_state')).json()).ph || []).length
await p.goto(APP + '/services/website-design-lagos', { waitUntil: 'networkidle' }); await p.waitForTimeout(800)
await p.evaluate(() => { const a = document.querySelector('a[href*="wa.me"]'); a.addEventListener('click', (e) => e.preventDefault()); a.click() }); await p.waitForTimeout(800)
await p.goto(APP + '/admin/login', { waitUntil: 'networkidle' }); await p.waitForTimeout(800)
const ev = ((await (await fetch(G + '/_state')).json()).ph || []).slice(before)
if (process.env.PH_ON) {
  check(ev.some((e) => e.event === '$pageview' && e.properties.$pathname === '/services/website-design-lagos' && e.api_key === 'phc_test') && ev.some((e) => e.event === 'whatsapp_click'), 'with a key: page views and WhatsApp taps reach PostHog, through olexweb.com/ingest', JSON.stringify(ev.map((e) => e.event)))
  check(!ev.some((e) => String(e.properties.$pathname).startsWith('/admin')) && ev.every((e) => e.properties.$process_person_profile === false), 'never from the admin; anonymous (no person profiles)')
} else check(ev.length === 0, 'without a key: nothing is sent anywhere', ev.length)
await b.close()
console.log(`\npassed: ${pass}`); if (failn) console.log(`failed: ${failn}`)
process.exit(failn ? 1 : 0)
