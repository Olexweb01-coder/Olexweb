// Olex Sales: personal previews. Before the first email, the agent makes each business a mock-up of a new homepage, at
// olexweb.com/preview/<token>: their own name, their own words and services, their colour, their phone, and the things a
// new site would fix (from the real signals). Clearly marked as a mock-up by Olexweb, never indexed, never their live site.
// The first email offers it ("want me to see it?"); when they say yes, the conversation agent sends the link (converse.js).
// With "link in the first email" on, the link goes in the first email instead.
// The words are written by the free AI pool from what their own site says, then checked by plain code: no number that isn't
// on their site, no reviews, awards, prices, promises or made-up people. If the AI can't pass, safe words are used instead.
// Opening is counted by the page itself after a moment on screen (link scanners don't count), never for Olaitan himself.
import 'server-only'
import { randomBytes } from 'node:crypto'
import { q, one } from '@/lib/admin/db'
import { safeFetch } from '@/lib/assistant/net'
import { askJSON } from '@/lib/assistant/llm'
import { notify } from '@/lib/assistant/notify'

const T = () => String(process.env.SALES_TEST_BASE || '').replace(/\/$/, '')
const mainOrigin = () => String(process.env.MAIN_ORIGIN || 'https://olexweb.com').trim().replace(/\/$/, '')
export const previewUrl = (token) => `${mainOrigin()}/preview/${token}`
export const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/

// ---------- the kind of business: look, words and the default services when their site says little ----------
export const LOOKS = {
  dentist: { re: /dent/i, icon: 'tooth', color: '#2f9fd8', en: { cta: 'Book a check-up', services: [['Check-ups and cleaning', 'Regular visits that keep problems small.'], ['Cosmetic dentistry', 'Whitening and treatments for a smile you like.'], ['Emergency appointments', 'Seen quickly when something hurts.']] }, fr: { cta: 'Prendre rendez-vous', services: [['Contrôles et détartrage', 'Des visites régulières pour garder des dents saines.'], ['Esthétique dentaire', 'Blanchiment et soins pour un sourire qui vous plaît.'], ['Urgences', 'Reçu rapidement en cas de douleur.']] } },
  clinic: { re: /clinic|therap|physio|health|clinique|kin[ée]/i, icon: 'leaf', color: '#3aa58a', en: { cta: 'Book an appointment', services: [['Assessment', 'A clear first look at what’s going on.'], ['Treatment plans', 'Care that fits you, step by step.'], ['Follow-up visits', 'Checking progress until you’re better.']] }, fr: { cta: 'Prendre rendez-vous', services: [['Bilan', 'Un premier regard clair sur votre situation.'], ['Plan de soins', 'Des soins adaptés, étape par étape.'], ['Suivi', 'Un suivi jusqu’à votre rétablissement.']] } },
  salon: { re: /salon|hair|beauty|barber|nail|coiff|beaut/i, icon: 'scissors', color: '#d4577f', en: { cta: 'Book your visit', services: [['Cuts and styling', 'Shaped to suit you.'], ['Colour', 'From subtle tones to a full change.'], ['Treatments', 'Care that keeps hair healthy.']] }, fr: { cta: 'Réserver', services: [['Coupe et coiffage', 'Une coupe qui vous ressemble.'], ['Couleur', 'Des reflets subtils au grand changement.'], ['Soins', 'Pour des cheveux en pleine forme.']] } },
  trades: { re: /trade|plumb|electric|build|roof|heating|gas|carpent|plomb|[ée]lectric|b[âa]timent/i, icon: 'wrench', color: '#f08a24', en: { cta: 'Get a free quote', services: [['Repairs', 'Fixed properly, first time.'], ['Installations', 'New fittings, done neatly.'], ['Emergency call-outs', 'There when it can’t wait.']] }, fr: { cta: 'Demander un devis', services: [['Dépannage', 'Réparé correctement, du premier coup.'], ['Installation', 'Des installations neuves, faites avec soin.'], ['Urgences', 'Disponible quand ça ne peut pas attendre.']] } },
  law: { re: /law|solicit|legal|attorney|avocat|juridi/i, icon: 'scale', color: '#5b6fd6', en: { cta: 'Book a consultation', services: [['Advice', 'Clear answers about where you stand.'], ['Representation', 'On your side from start to finish.'], ['Documents', 'Contracts and papers done right.']] }, fr: { cta: 'Prendre rendez-vous', services: [['Conseil', 'Des réponses claires sur votre situation.'], ['Défense', 'À vos côtés du début à la fin.'], ['Actes', 'Contrats et documents bien rédigés.']] } },
  accounting: { re: /account|bookkeep|tax|compta|fiscal/i, icon: 'chart', color: '#2e9e6b', en: { cta: 'Book a free call', services: [['Accounts and tax returns', 'Done on time, explained in plain words.'], ['Bookkeeping', 'Your numbers kept tidy all year.'], ['Payroll', 'Your team paid right, every month.']] }, fr: { cta: 'Prendre rendez-vous', services: [['Comptes et déclarations', 'Dans les délais, expliqués simplement.'], ['Tenue comptable', 'Des comptes en ordre toute l’année.'], ['Paie', 'Votre équipe payée correctement, chaque mois.']] } },
  consulting: { re: /consult|advis|conseil/i, icon: 'compass', color: '#7a5af5', en: { cta: 'Book a call', services: [['Strategy', 'A clear plan for what comes next.'], ['Operations', 'Smoother ways of working.'], ['Growth', 'Practical steps to grow.']] }, fr: { cta: 'Prendre rendez-vous', services: [['Stratégie', 'Un plan clair pour la suite.'], ['Organisation', 'Des façons de travailler plus fluides.'], ['Croissance', 'Des étapes concrètes pour grandir.']] } },
  restaurant: { re: /restaurant|bistro|grill|kitchen|pizz|brasserie/i, icon: 'plate', color: '#d9542c', en: { cta: 'Book a table', services: [['Lunch and dinner', 'Come in, sit down, enjoy.'], ['Private dining', 'Space for your celebrations.'], ['Takeaway', 'Your favourites, at home.']] }, fr: { cta: 'Réserver une table', services: [['Déjeuner et dîner', 'Installez-vous et profitez.'], ['Salle privée', 'Un espace pour vos fêtes.'], ['À emporter', 'Vos plats préférés, chez vous.']] } },
  cafe: { re: /caf[eé]|coffee|bakery|boulang|p[âa]tiss|tea/i, icon: 'cup', color: '#b9773d', en: { cta: 'Find us', services: [['Coffee', 'Made with care, every cup.'], ['Fresh food', 'Made today, here.'], ['A place to sit', 'Stay a while.']] }, fr: { cta: 'Nous trouver', services: [['Café', 'Préparé avec soin, à chaque tasse.'], ['Fait maison', 'Préparé ici, aujourd’hui.'], ['Un lieu où s’asseoir', 'Restez un moment.']] } },
  shop: { re: /shop|boutique|store|gift|cloth|magasin/i, icon: 'bag', color: '#c2559b', en: { cta: 'Visit the shop', services: [['New in', 'Fresh pieces, chosen with care.'], ['Gifts', 'Something special for someone.'], ['Shop online', 'Browse and buy from home.']] }, fr: { cta: 'Voir la boutique', services: [['Nouveautés', 'De nouvelles pièces, choisies avec soin.'], ['Idées cadeaux', 'Quelque chose de spécial.'], ['Boutique en ligne', 'Achetez depuis chez vous.']] } },
  other: { re: /.^/, icon: 'spark', color: '#4f7cff', en: { cta: 'Get in touch', services: [['What we do', 'Done well, by people who care.'], ['How we help', 'Clear, friendly and on time.'], ['Talk to us', 'A quick call is all it takes.']] }, fr: { cta: 'Nous contacter', services: [['Notre métier', 'Bien fait, par des gens qui s’en soucient.'], ['Notre aide', 'Clair, aimable et dans les délais.'], ['Parlons-en', 'Un simple appel suffit.']] } },
}
export function lookOf(category) { const k = Object.keys(LOOKS).find((k) => LOOKS[k].re.test(String(category || ''))); return k || 'other' }

// what the new version fixes, from the real signals (shown at the end of the mock-up)
const FIXES = {
  en: { NO_WEBSITE: 'You’d be easy to find online, with a site of your own', SITE_DOWN: 'A site that’s always up when customers look', SLOW_MOBILE: (s) => `Fast on phones${s.value_num ? ` (your current homepage scores ${s.value_num}/100 on Google’s phone test)` : ''}`,
    NOT_MOBILE: 'Made for phones first: no pinching and zooming', NO_HTTPS: 'The padlock: browsers stop calling it “Not secure”', NO_BOOKING: 'Customers book online, any hour, without calling', OLD_COPYRIGHT: (s) => `Up to date (your footer still says © ${s.value_num})` },
  fr: { NO_WEBSITE: 'Facile à trouver en ligne, avec votre propre site', SITE_DOWN: 'Un site toujours en ligne quand vos clients le cherchent', SLOW_MOBILE: (s) => `Rapide sur mobile${s.value_num ? ` (votre page d’accueil obtient ${s.value_num}/100 au test mobile de Google)` : ''}`,
    NOT_MOBILE: 'Pensé pour le mobile d’abord', NO_HTTPS: 'Le cadenas : plus de « Non sécurisé » dans le navigateur', NO_BOOKING: 'Réservation en ligne, à toute heure, sans appeler', OLD_COPYRIGHT: (s) => `À jour (votre pied de page indique encore © ${s.value_num})` },
}
const ALWAYS = { en: ['Motion and design made for you, not a template', 'Search basics done right, so Google understands you'], fr: ['Un design animé fait pour vous, pas un modèle', 'Les bases du référencement bien faites'] }
export function fixesFor(signals, lang) {
  const F = FIXES[lang] || FIXES.en, out = []
  for (const s of signals) { const f = F[s.code]; if (f) out.push(typeof f === 'function' ? f(s) : f) }
  return [...out, ...(ALWAYS[lang] || ALWAYS.en)].slice(0, 5)
}

// ---------- reading their own site ----------
const clean = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, '’').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()
function hexParts(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((x) => x + x).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
function hsl([r, g, b]) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; return { s: d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)), l } }
export function brandColor(html) {
  const ok = (h) => { const { s, l } = hsl(hexParts(h)); return s > 0.35 && l > 0.25 && l < 0.68 }
  const meta = (String(html).match(/<meta[^>]+name=["']theme-color["'][^>]+content=["'](#[0-9a-f]{3}(?:[0-9a-f]{3})?)["']/i) || [])[1]
  if (meta && ok(meta)) return meta.toLowerCase()
  const count = new Map()
  for (const m of String(html).matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) { const h = '#' + m[1].toLowerCase(); if (ok(h)) count.set(h.length === 4 ? '#' + h.slice(1).split('').map((x) => x + x).join('') : h, (count.get(h) || 0) + 1) }
  const best = [...count.entries()].sort((a, b) => b[1] - a[1])[0]
  return best && best[1] >= 2 ? best[0] : null
}
export function readSite(html) {
  const h = String(html || '')
  const body = h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>|<svg[\s\S]*?<\/svg>/gi, ' ')
  const title = clean((h.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]).slice(0, 120)
  const desc = clean((h.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) || [])[1]).slice(0, 300)
  const heads = [...body.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((m) => clean(m[1])).filter((t) => t.length > 2 && t.length < 90).slice(0, 14)
  const paras = [...body.matchAll(/<(p|li)[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => clean(m[2])).filter((t) => t.length > 20).slice(0, 30).join(' ').slice(0, 1800)
  // schema.org (many local businesses publish their phone, address and hours this way)
  let ld = {}
  for (const m of h.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { const j = JSON.parse(m[1]); for (const x of [j, ...(Array.isArray(j) ? j : []), ...((j && j['@graph']) || [])]) if (x && (x.telephone || x.address || x.openingHours)) { ld = x; break } } catch {}
  }
  const addr = ld.address && typeof ld.address === 'object' ? [ld.address.streetAddress, ld.address.addressLocality, ld.address.postalCode].filter(Boolean).join(', ') : typeof ld.address === 'string' ? ld.address : ''
  const tel = (h.match(/href=["']tel:([+\d\s().-]{7,20})["']/i) || [])[1] || ld.telephone || ''
  const hours = Array.isArray(ld.openingHours) ? ld.openingHours.slice(0, 4).join(', ') : String(ld.openingHours || '')
  return { title, desc, heads, text: paras, phone: clean(tel).slice(0, 24), address: clean(addr).slice(0, 120), hours: clean(hours).slice(0, 120), color: brandColor(h) }
}

// ---------- the words: AI, then plain-code checks ----------
const NEVER_SAY = /\b(award|awarded|winning|rated|rating|reviews?|testimonial|stars?|#\s?1|number one|best in|leading|guarantee[ds]?|certified|accredited|years of experience|since \d|trusted by|voted|top[- ]rated|free consultation|discount|offer|% off|cheap)\b|[$£€]\s?\d|\b(prix|tarif|garanti|meilleur|n°\s?1|avis|étoiles|récompens|certifi|depuis \d)/i
export function checkCopy(c, source) {
  const p = [], src = String(source || '')
  const all = [c.tagline, c.headline, c.sub, c.about, c.cta, ...(c.services || []).flatMap((s) => [s.name, s.line]), ...(c.reasons || [])].map((x) => String(x || ''))
  const words = (s) => s.split(/\s+/).filter(Boolean).length
  if (!c.headline || words(c.headline) > 10) p.push('the headline must be 1 to 10 words')
  if (!c.sub || words(c.sub) > 30) p.push('the sub line must be 1 to 30 words')
  if (c.about && words(c.about) > 45) p.push('about must be 45 words or fewer')
  if (!c.cta || words(c.cta) > 4) p.push('the button must be 1 to 4 words')
  if (!Array.isArray(c.services) || c.services.length < 3 || c.services.length > 4 || c.services.some((s) => !s || !s.name || words(String(s.name)) > 5 || words(String(s.line || '')) > 14)) p.push('3 or 4 services, each a name of up to 5 words and a line of up to 14')
  if (!Array.isArray(c.reasons) || c.reasons.length !== 3 || c.reasons.some((r) => words(String(r)) > 8)) p.push('exactly 3 reasons, up to 8 words each')
  for (const t of all) {
    if (NEVER_SAY.test(t)) { p.push(`“${t.slice(0, 40)}” claims something (reviews, awards, prices, promises): leave it out`); break }
    const nums = t.match(/\d(?:[\d,.]*\d)?/g) || []; const bad = nums.find((n) => !src.includes(n))
    if (bad) { p.push(`the number ${bad} isn’t on their website: no numbers that aren’t theirs`); break }
    if (/https?:|www\.|<[a-z]/i.test(t)) { p.push('no links or HTML'); break }
  }
  return p
}
const SYSTEM = (lang) => `You write the words for a mock-up homepage that a web designer made for a small business, to show them how a new site could look. Use what their current website says (given below) so it sounds like them.
${lang === 'fr' ? 'Write everything in natural French (vous).' : 'Write in plain, warm English.'} Short, concrete, confident. No hype, no exclamation marks.
Never invent facts: no numbers that aren't in their text, no reviews, ratings, awards, prices, offers, guarantees, certifications, team names, years in business or claims like "best" or "leading".
Services: only what their text mentions; if it says nothing, name the usual services of this kind of business in general words.
Answer JSON only: {"tagline": "2 to 6 words", "headline": "up to 10 words, about what customers get", "sub": "one sentence, up to 30 words", "services": [{"name": "up to 5 words", "line": "up to 14 words"}, 3 or 4 of these], "reasons": ["3 short reasons to choose them, up to 8 words each, from their text"], "about": "up to 45 words, from their text, or empty", "cta": "the main button, 1 to 4 words (e.g. Book a visit)"}`

function fallbackCopy(c, kind, lang, site) {
  const L = LOOKS[kind][lang] || LOOKS[kind].en, fr = lang === 'fr', where = c.city ? (fr ? ` à ${c.city}` : ` in ${c.city}`) : ''
  return { tagline: c.city || (fr ? 'Bienvenue' : 'Welcome'), headline: fr ? `${c.name}${where}` : `${c.name}${where}`, sub: site.desc && site.desc.split(/\s+/).length <= 30 ? site.desc : (fr ? 'Tout ce que vous devez savoir, et un moyen simple de nous joindre.' : 'Everything you need to know, and an easy way to reach us.'),
    services: L.services.map(([name, line]) => ({ name, line })), reasons: fr ? ['Une équipe à votre écoute', 'Simple et rapide', 'Près de chez vous'] : ['People who listen', 'Quick and easy', 'Close to you'], about: '', cta: L.cta, safe: true }
}

// make (or remake) the mock-up for one company; returns { token, url } or null
export async function makePreview(companyId, { again = false } = {}) {
  const c = await one('select * from sales_companies where id = $1', [companyId]); if (!c) return null
  const had = await one('select token from sales_previews where company_id = $1', [companyId])
  if (had && !again) return { token: had.token, url: previewUrl(had.token) }
  const signals = (await q('select * from sales_signals where company_id = $1', [companyId])).rows
  if (signals.some((s) => s.code === 'AGENCY')) return null                                  // partners get a different pitch
  const lang = c.country === 'FR' ? 'fr' : 'en', kind = lookOf(c.category)
  let site = { title: '', desc: '', heads: [], text: '', phone: '', address: '', hours: '', color: null }
  if (c.domain && !signals.some((s) => s.code === 'SITE_DOWN')) {
    const home = T() ? `${T()}/site/${c.domain}/` : `https://${c.domain}/`
    const page = await safeFetch(home, { maxBytes: 1_200_000, timeoutMs: 12000, allowHttp: true }).catch(() => null)
    if (page && !page.error && page.status < 400) site = readSite(page.text)
  }
  const source = [c.name, c.city, c.phone, site.title, site.desc, ...site.heads, site.text, site.address, site.hours].join(' \n')
  const prompt = `Business: ${c.name}${c.city ? ', ' + c.city : ''}. Kind: ${c.category || 'small business'}.\n` +
    (site.text || site.heads.length ? `Their website's title: ${site.title}\nDescription: ${site.desc}\nHeadings: ${site.heads.join(' | ')}\nText: ${site.text}` : 'They have no website we could read; write general but specific-sounding words for this kind of business, with no facts.')
  let copy = null, problems = []
  for (let i = 0; i < 3 && !copy; i++) {
    const j = await askJSON({ system: SYSTEM(lang), prompt: i ? prompt + `\n\nYour last answer had problems: ${problems.join('; ')}. Fix them.` : prompt, kind: 'quick', temperature: 0.5 }).catch(() => null)
    if (!j) { problems = ['no answer came back']; continue }
    const d = { tagline: String(j.tagline || '').trim(), headline: String(j.headline || '').trim(), sub: String(j.sub || '').trim(), about: String(j.about || '').trim(), cta: String(j.cta || '').trim(),
      services: (Array.isArray(j.services) ? j.services : []).map((s) => ({ name: String((s && s.name) || '').trim(), line: String((s && s.line) || '').trim() })), reasons: (Array.isArray(j.reasons) ? j.reasons : []).map((r) => String(r || '').trim()) }
    problems = checkCopy(d, source); if (!problems.length) copy = d
  }
  if (!copy) copy = fallbackCopy(c, kind, lang, site)
  const data = { name: c.name, city: c.city || null, country: c.country, lang, kind, icon: LOOKS[kind].icon, color: site.color || LOOKS[kind].color,
    phone: site.phone || c.phone || null, address: site.address || null, hours: site.hours || null, copy, fixes: fixesFor(signals, lang),
    booking: kind !== 'cafe' && kind !== 'shop', hadSite: !!site.text, made: new Date().toISOString() }
  const token = had ? had.token : randomBytes(16).toString('base64url')
  await q(`insert into sales_previews (company_id, token, data) values ($1, $2, $3) on conflict (company_id) do update set data = excluded.data, created_at = now()`, [companyId, token, JSON.stringify(data)])
  return { token, url: previewUrl(token) }
}
export async function previewOf(companyId) {
  const p = await one('select token, views, first_view_at, shared_at from sales_previews where company_id = $1', [companyId])
  return p ? { ...p, url: previewUrl(p.token) } : null
}
export async function previewByToken(token) {
  if (!TOKEN_RE.test(String(token || ''))) return null
  const p = await one('select p.company_id, p.token, p.data from sales_previews p where p.token = $1', [token])
  if (!p) return null
  const { bookLink } = await import('./inbox')
  return { ...p.data, token: p.token, book: bookLink(p.company_id) }
}
// the page says it was really looked at (a moment on screen); Olaitan's own visits don't count
export async function seen(token, what) {
  if (!TOKEN_RE.test(String(token || ''))) return { ok: false }
  if (what === 'click') { await q('update sales_previews set clicks = clicks + 1 where token = $1', [token]); return { ok: true } }
  const r = await one(`update sales_previews set views = views + 1, first_view_at = coalesce(first_view_at, now()), last_view_at = now() where token = $1
    returning company_id, views, (select name from sales_companies c where c.id = company_id) as name`, [token])
  if (r && r.views === 1) notify('sales', `${r.name} opened the mock-up you made them.`, '/admin/sales')
  return { ok: !!r }
}
