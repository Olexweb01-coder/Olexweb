// Olex Sales: where businesses come from. Each source turns into rows in sales_companies (deduplicated).
//  - Companies House (UK, free key COMPANIES_HOUSE_API_KEY): active companies by industry code and town. Also confirms a
//    UK business is a limited company: UK law (PECR) lets us email limited companies without prior consent, not sole
//    traders or partnerships, so a UK business is only emailed once Companies House confirms its type.
//  - Serper (UK and US, free 2,500 searches, SERPER_API_KEY): map listings ("dentist in Austin TX"), which include
//    businesses with no website, and ordinary search to find a UK company's website.
//  - OpenStreetMap (free, no key; volunteer servers that are often busy, so several are tried and none is relied on).
//  - Pasted lists. Tests point every source at a stand-in with SALES_TEST_BASE.
import 'server-only'
import { q, one } from '@/lib/admin/db'

const T = () => String(process.env.SALES_TEST_BASE || '').replace(/\/$/, '')
const UA = 'OlexwebSales/1.0 (+https://olexweb.com; info@olexweb.com)'
export class SourceError extends Error {}
const GL = (country) => ({ GB: 'gb', US: 'us', FR: 'fr' })[country] || 'us'   // France: Install 18

// what Olaitan targets: each kind with its UK industry codes (SIC 2007), search words and OpenStreetMap tags
export const KINDS = {
  dentist: { label: 'Dentists', sic: ['86230'], search: 'dentist', fr: 'dentiste', osm: [['amenity', 'dentist']] },
  clinic: { label: 'Clinics and therapists', sic: ['86210', '86900'], search: 'private clinic', fr: 'clinique privée', osm: [['amenity', 'clinic'], ['healthcare', 'physiotherapist']] },
  salon: { label: 'Hair and beauty salons', sic: ['96020'], search: 'hair salon', fr: 'salon de coiffure', osm: [['shop', 'hairdresser'], ['shop', 'beauty']] },
  trades: { label: 'Trades (plumbers, electricians, builders)', sic: ['43220', '43210', '41202'], search: 'plumber', fr: 'plombier', osm: [['craft', 'plumber'], ['craft', 'electrician']] },
  law: { label: 'Law firms', sic: ['69102', '69109'], search: 'solicitors', fr: 'avocat', osm: [['office', 'lawyer']] },
  accounting: { label: 'Accountants', sic: ['69201', '69202', '69203'], search: 'accountant', fr: 'expert-comptable', osm: [['office', 'accountant']] },
  consulting: { label: 'Consultants', sic: ['70229', '70210'], search: 'business consultant', fr: 'consultant', osm: [['office', 'consulting']] },
  restaurant: { label: 'Restaurants', sic: ['56101'], search: 'restaurant', fr: 'restaurant', osm: [['amenity', 'restaurant']] },
  cafe: { label: 'Cafés', sic: ['56102'], search: 'cafe', fr: 'café', osm: [['amenity', 'cafe']] },
  shop: { label: 'Independent shops', sic: ['47190', '47710', '47770'], search: 'boutique shop', fr: 'boutique', osm: [['shop', 'clothes'], ['shop', 'gift']] },
}
// websites that are listings about a business, not its own site
const DIRECTORIES = /(^|\.)(companieshouse|gov|find-and-update|endole|opencorporates|yell|yelp|facebook|instagram|linkedin|twitter|x|tiktok|youtube|tripadvisor|google|bing|apple|thomsonlocal|192|checkatrade|trustpilot|nhs|bark|treatwell|booksy|fresha|doctify|indeed|glassdoor|bizapedia|dnb|zoominfo|manta|bbb|yellowpages|mapquest|opentable|ubereats|deliveroo|just-eat|grubhub|doordash|wikipedia|amazon|ebay|etsy)\.[a-z.]+$/i
export const domainOf = (u) => { try { return new URL(/^https?:/i.test(u) ? u : 'https://' + u).hostname.replace(/^www\./, '').toLowerCase() } catch { return null } }
export const isDirectory = (host) => !host || DIRECTORIES.test(host)

async function getJSON(url, init = {}, label) {
  let r; try { r = await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(init.timeout || 25000), headers: { 'User-Agent': UA, Accept: 'application/json', ...(init.headers || {}) } }) }
  catch { throw new SourceError(`${label} didn’t answer`) }
  const text = await r.text(); let j = null; try { j = JSON.parse(text) } catch {}
  if (r.status === 401 || r.status === 403) throw new SourceError(`${label} refused the key. Check it in Vercel.`)
  if (r.status === 429) throw new SourceError(`${label} says slow down (its free limit). Try again later.`)
  if (!r.ok || !j) throw new SourceError(`${label} error ${r.status}`)
  return j
}

// ---------- Companies House (UK) ----------
const chBase = () => (T() ? T() + '/ch' : 'https://api.company-information.service.gov.uk')
const chAuth = () => ({ Authorization: 'Basic ' + Buffer.from(String(process.env.COMPANIES_HOUSE_API_KEY || '') + ':').toString('base64') })
export const chReady = () => !!process.env.COMPANIES_HOUSE_API_KEY
const LIMITED = new Set(['ltd', 'plc', 'llp', 'private-limited-guarant-nsc', 'private-limited-guarant-nsc-limited-exemption', 'private-limited-shares-section-30-exemption'])
export const limitedType = (t) => LIMITED.has(String(t || '').toLowerCase())
export async function companiesHouse({ kind, town, max = 50, newerThanDays = 0 }) {
  if (!chReady()) throw new SourceError('Add your free Companies House key first (COMPANIES_HOUSE_API_KEY).')
  const K = KINDS[kind]; if (!K) throw new SourceError('Unknown kind of business.')
  const p = new URLSearchParams({ sic_codes: K.sic.join(','), location: town, company_status: 'active', size: String(Math.min(100, max)) })
  if (newerThanDays) p.set('incorporated_from', new Date(Date.now() - newerThanDays * 864e5).toISOString().slice(0, 10))
  const j = await getJSON(`${chBase()}/advanced-search/companies?${p}`, { headers: chAuth() }, 'Companies House')
  return (j.items || []).filter((c) => limitedType(c.company_type)).map((c) => ({
    name: titleCase(c.company_name), country: 'GB', city: (c.registered_office_address && (c.registered_office_address.locality || c.registered_office_address.region)) || town,
    category: K.label, source: 'companies_house', source_ref: c.company_number, ch_number: c.company_number, company_type: c.company_type }))
}
// is this UK business a limited company? (by name and town; only a close name match counts)
export async function chConfirm(name, town) {
  if (!chReady()) return null
  const j = await getJSON(`${chBase()}/search/companies?${new URLSearchParams({ q: name, items_per_page: '5' })}`, { headers: chAuth() }, 'Companies House')
  const want = norm(name)
  const hit = (j.items || []).find((c) => c.company_status === 'active' && norm(c.title) === want && (!town || String(c.address_snippet || '').toLowerCase().includes(String(town).toLowerCase())))
    || (j.items || []).find((c) => c.company_status === 'active' && norm(c.title) === want)
  return hit ? { ch_number: hit.company_number, company_type: hit.company_type } : null
}
const norm = (s) => String(s || '').toLowerCase().replace(/\b(limited|ltd|llp|plc|the|and|&)\b/g, '').replace(/[^a-z0-9]/g, '')
const titleCase = (s) => String(s || '').toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(Ltd|Llp|Plc)\b/g, (m) => m.toUpperCase())

// ---------- Serper (UK and US) ----------
export const serperReady = () => !!process.env.SERPER_API_KEY
const serper = (path, body) => getJSON((T() ? T() + '/serper' : 'https://google.serper.dev') + path, { method: 'POST', headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 'Serper')
export async function serperPlaces({ kind, town, country }) {
  if (!serperReady()) throw new SourceError('Add your free Serper key first (SERPER_API_KEY).')
  const K = KINDS[kind]; if (!K) throw new SourceError('Unknown kind of business.')
  const j = await serper('/places', { q: `${country === 'FR' ? (K.fr || K.search) : K.search} in ${town}`, gl: GL(country), ...(country === 'FR' ? { hl: 'fr' } : {}) })
  return (j.places || []).map((p) => { const host = domainOf(p.website || ''); return {
    name: p.title, website: host && !isDirectory(host) ? p.website : null, domain: host && !isDirectory(host) ? host : null, country, city: town,
    phone: p.phoneNumber || null, category: K.label, source: 'serper', source_ref: p.cid || p.placeId || `${p.title}|${p.address}` } })
}
// a company's own website, from search (skipping directories; the name must appear in the result)
export async function findWebsite(name, town, country) {
  if (!serperReady()) return null
  const j = await serper('/search', { q: `${name} ${town || ''}`.trim(), gl: GL(country), num: 10 })
  const words = norm(name).length >= 4 ? norm(name) : null
  for (const r of j.organic || []) {
    const host = domainOf(r.link); if (isDirectory(host)) continue
    const hay = (norm(r.title) + norm(host))
    if (!words || hay.includes(words.slice(0, Math.min(10, words.length)))) return { website: 'https://' + host, domain: host }
  }
  return null
}

// ---------- OpenStreetMap (free; busy volunteer servers) ----------
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter']
export async function openStreetMap({ kind, town, country }) {
  const K = KINDS[kind]; if (!K) throw new SourceError('Unknown kind of business.')
  const sel = K.osm.map(([k, v]) => `nwr["${k}"="${v}"](area.a);`).join('')
  const query = `[out:json][timeout:25];area["name"="${String(town).replace(/"/g, '')}"]["boundary"="administrative"]->.a;(${sel});out tags center 150;`
  let lastErr = 'OpenStreetMap is busy right now. Try again later, or use another source.'
  for (const url of T() ? [T() + '/osm'] : OVERPASS) {
    try {
      const r = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: query }), headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(35000), cache: 'no-store' })
      if (!r.ok) continue
      const j = await r.json()
      return (j.elements || []).filter((e) => e.tags && e.tags.name).map((e) => { const t = e.tags, site = t.website || t['contact:website'] || '', host = domainOf(site); return {
        name: t.name, website: host && !isDirectory(host) ? site : null, domain: host && !isDirectory(host) ? host : null, country, city: t['addr:city'] || town, region: t['addr:state'] || null,
        phone: t.phone || t['contact:phone'] || null, email: t.email || t['contact:email'] || null, category: K.label, source: 'osm', source_ref: `${e.type}/${e.id}` } })
    } catch { lastErr = 'OpenStreetMap is busy right now. Try again later, or use another source.' }
  }
  throw new SourceError(lastErr)
}

// pasted: one business per line, "Name, website, city" (website and city optional)
export function pasted(text, country) {
  return String(text || '').split(/\r?\n/).map((l) => l.split(',').map((x) => x.trim())).filter((x) => x[0]).slice(0, 200).map(([name, site, city]) => {
    const host = site ? domainOf(site) : null
    return { name, website: host ? (/^https?:/i.test(site) ? site : 'https://' + host) : null, domain: host, country, city: city || null, category: 'Added by hand', source: 'manual', source_ref: (host || name).toLowerCase() }
  })
}

// save found businesses (skipping ones already known by website or by source); returns how many were new
export async function saveCompanies(list) {
  let added = 0
  for (const c of list) {
    if (!c.name) continue
    if (c.domain && await one('select 1 from sales_companies where lower(domain) = lower($1)', [c.domain])) continue
    if (c.domain && await one('select 1 from sales_dnc where entry = lower($1)', [c.domain])) continue
    const r = await one(`insert into sales_companies (name, website, domain, country, city, region, phone, category, source, source_ref, ch_number, company_type)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) on conflict do nothing returning id`,
      [String(c.name).slice(0, 200), c.website || null, c.domain || null, c.country, c.city || null, c.region || null, c.phone || null, c.category || null, c.source, String(c.source_ref || c.name).slice(0, 300), c.ch_number || null, c.company_type || null])
    if (r) { added++; if (c.email) await q("insert into sales_contacts (company_id, email, source_url, email_status) values ($1, lower($2), 'OpenStreetMap', 'unchecked') on conflict do nothing", [r.id, c.email]) }
  }
  return added
}
