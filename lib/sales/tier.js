// Olex Sales, Install 18: the agent's read of a business. Which price level fits (from evidence only), what to offer, at
// what price, the angle to open with, and the language. A business only ever moves UP a level: a hint of a bigger budget in
// a reply raises it; nothing lowers it.
import 'server-only'
import { q, one } from '@/lib/admin/db'
import { priceOf, offerOf, currencyOf, TIERS, TIER_ORDER, COUNTRIES } from './playbook'
import { factsFor } from './write'

const PREMIUM_KINDS = /law|solicitor|clinic|dentist|dental|medical|real estate|estate agent|architect|private|wealth|finance|consult/i
const GROWTH_KINDS = /accountant|account|agency|hotel|gym|fitness|school|academy|therap/i
// signs of size on their own website (saved as CUE_* signals by profile.js) and in what they write back
export const CUES = [
  ['CUE_LOCATIONS', /(\b(our (locations|branches|offices|clinics|stores)|offices in|branches in|\d+ (locations|branches|clinics|stores))\b|\bnos (\d+ )?(salons|cabinets|agences|boutiques|magasins|restaurants|cliniques)\b)/i, 2, 'more than one location'],
  ['CUE_HIRING', /\b(careers|we'?re hiring|join our team|vacancies|open positions|recrutement|rejoignez[- ]nous|nous recrutons)\b/i, 1, 'hiring'],
  ['CUE_TEAM', /\b(team of (\d{2,}|[a-z]+ty)|\d{2,}\+? (staff|employees|people|professionals|specialists|lawyers|dentists|collaborateurs|salariés)|équipe de \d{2,})\b/i, 2, 'a team of 10 or more'],
  ['CUE_INVEST', /\b(investors?|funding|series [ab]|franchis)/i, 2, 'investors or franchising'],
]
const REPLY_CUES = [[/\b(budget|invest(ment)?|spend)\b[^.?!]{0,40}?(\$|£|€)?\s?\d[\d,.]{3,}/i, 4, 'mentioned a budget in the thousands'],
  [/(\$|£|€)\s?\d{1,3}(,\d{3})+|\b\d{1,3}k\b/i, 3, 'mentioned a figure in the thousands'], [/\b(rebrand|platform|portal|app|dashboard|members? area|e-?commerce|online store)\b/i, 2, 'wants something bigger than a page'],
  [/\b(locations|branches|franchis|investors?|board|our team of)\b/i, 2, 'a bigger organisation'], [/\b(budget|prix|tarif)\b/i, 1, 'asked about budget']]

export function scoreTier(c, codes = [], replyText = '') {
  let points = 0; const reasons = []
  const kind = [c.category, c.name].join(' ')
  if (PREMIUM_KINDS.test(kind)) { points += 2; reasons.push('a high-value trade (' + (c.category || 'by name') + ')') }
  else if (GROWTH_KINDS.test(kind)) { points += 1; reasons.push('a mid-value trade') }
  if (String(c.company_type || '').toLowerCase() === 'plc') { points += 3; reasons.push('a public limited company') }
  for (const [code, , w, why] of CUES) if (codes.includes(code)) { points += w; reasons.push(why) }
  let money = false                                                      // one money sign counts once (the strongest)
  for (const [re, w, why] of REPLY_CUES) { const isMoney = /budget|figure/.test(why); if ((isMoney && money) || !re.test(replyText)) continue; if (isMoney) money = true; points += w; reasons.push(why) }
  const tier = points >= 5 ? 'premium' : points >= 2 ? 'growth' : 'starter'
  return { tier, points, reasons }
}
const higher = (a, b) => TIER_ORDER.indexOf(a) >= TIER_ORDER.indexOf(b) ? a : b

// what to offer, from what's wrong (signals) and the kind of business
const BOOKABLE = /dentist|clinic|salon|beauty|hair|therap|physio|gym|fitness|spa|barber|massage|nail/i
const QUICK = /trade|plumb|electric|build|roof|clean|restaurant|cafe|café|takeaway|bakery/i
export function offerFor(c, codes, tier) {
  const issues = codes.filter((x) => ['SITE_DOWN', 'NO_HTTPS', 'NOT_MOBILE', 'SLOW_MOBILE', 'OLD_COPYRIGHT'].includes(x))
  let key
  if (codes.includes('NO_WEBSITE')) key = QUICK.test(c.category || '') ? 'landing' : 'site'
  else if (codes.includes('NO_BOOKING') && BOOKABLE.test([c.category, c.name].join(' '))) key = issues.length >= 2 ? 'redesign' : 'booking'
  else if (issues.length >= 2 || codes.includes('SITE_DOWN') || codes.includes('NOT_MOBILE') || codes.includes('OLD_COPYRIGHT')) key = 'redesign'
  else if (issues.length) key = 'fix'
  else key = 'site'
  if (tier === 'premium') key = { landing: 'site', site: 'signature', redesign: 'signature', booking: 'admin', fix: 'redesign' }[key] || key
  else if (tier === 'growth') key = { fix: 'redesign', landing: 'site' }[key] || key
  return key
}

// work out (or update) the agent's read of a company and save it; replyText raises the level when it hints at more budget
export async function planCompany(companyId, replyText = '') {
  const c = await one('select * from sales_companies where id = $1', [companyId]); if (!c) return null
  const signals = (await q('select * from sales_signals where company_id = $1', [companyId])).rows, codes = signals.map((s) => s.code)
  const s = scoreTier(c, codes, replyText), tier = higher(s.tier, c.tier || 'starter'), cur = currencyOf(c.country)
  const key = offerFor(c, codes, tier), o = offerOf(key), price = priceOf(key, tier, cur), care = priceOf('care', tier, cur)
  const facts = factsFor(signals)
  const plan = { offer: key, offerName: o.name, tier, tierLabel: TIERS[tier].label, price: price.text, care: care.text, currency: cur,
    angle: facts[0] || null, language: (COUNTRIES[c.country] || {}).lang || 'en', reasons: s.reasons.length ? s.reasons : ['no sign of a bigger budget yet'],
    raised: TIER_ORDER.indexOf(tier) > TIER_ORDER.indexOf(c.tier || 'starter') && !!c.tier, at: new Date().toISOString() }
  await q('update sales_companies set plan = $2, tier = $3 where id = $1', [companyId, JSON.stringify(plan), tier])
  return plan
}
