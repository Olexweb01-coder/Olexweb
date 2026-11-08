// Olex Sales, Install 18: the playbook. What Olexweb sells, at what price, in which currency, and how it talks. The agent can
// only offer what is here: it never invents a service, a price, a timeline or a past client.
// Prices are in US dollars at the Starter level; the Growth and Premium levels are for businesses that clearly have more to
// spend (tier.js decides, from evidence, and a business only ever moves up). Pounds and euros are rounded to friendly numbers.

export const POSITIONING = `Every Olexweb build is made for that one business: motion-led, scroll-stopping and fast, with features that do real work
(booking, quotes, admin, automation). Never a static template. Built and run by Olaitan Adebayo, who designs and codes every project himself.`
export const PROOF = ['Viverst Global (corporate group: main site, studio and agro platforms, admin)', 'Mojatech Electrical (quote requests and a product admin)',
  'Leathrock (community, courses and events with an admin)', 'Tolu Afilaka Live (event tickets and admin)', 'Needar (own SaaS product)']
export const COUNTRIES = { GB: { name: 'United Kingdom', lang: 'en', currency: 'GBP' }, US: { name: 'United States', lang: 'en', currency: 'USD' }, FR: { name: 'France', lang: 'fr', currency: 'EUR' } }
// never: Germany and Austria need consent even for business emails
export const NEVER = ['DE', 'AT']
export const CURRENCIES = { USD: { sym: '$', rate: 1 }, GBP: { sym: '£', rate: 0.8 }, EUR: { sym: '€', rate: 0.92 } }
export const TIERS = { starter: { label: 'Starter', x: 1 }, growth: { label: 'Growth', x: 2.5 }, premium: { label: 'Premium', x: 6 } }
export const TIER_ORDER = ['starter', 'growth', 'premium']

export const OFFERS = [
  { key: 'fix', name: 'Website fix', what: 'The padlock (HTTPS), a proper mobile layout, speed fixes and anything out of date, sorted on the site they already have.', usd: [60, 80], time: '2–3 days' },
  { key: 'landing', name: 'Landing page', what: 'One motion-led page that turns visitors into calls, quotes or bookings: mobile-first, fast, with search basics done right.', usd: [100, 100], time: '3–5 days' },
  { key: 'booking', name: 'Online booking', what: 'Customers book from the website, day or night, instead of calling.', usd: [100, 150], time: '3–5 days' },
  { key: 'site', name: 'Business website', what: 'Up to 5 pages, built around how their customers decide: motion, speed, search, and contact or booking where it counts.', usd: [250, 400], time: '1–2 weeks' },
  { key: 'redesign', name: 'Redesign', what: 'Their current site rebuilt: modern, fast, memorable, and easier to buy from.', usd: [200, 400], time: '1–2 weeks' },
  { key: 'admin', name: 'Website with admin', what: 'A site plus their own admin to update products, prices, content and enquiries themselves.', usd: [500, null], time: '2–4 weeks' },
  { key: 'signature', name: 'Signature experience', what: 'An immersive, story-led website (3D, scroll stories, motion) people remember and talk about, with the features the business runs on.', usd: [2500, null], time: '3–6 weeks', premiumOnly: true },
  { key: 'platform', name: 'Web app or platform', what: 'A custom platform or SaaS product: portals, dashboards, automation, built end to end.', usd: [4000, null], time: '4–10 weeks', premiumOnly: true },
  { key: 'partner', name: 'Partner builds (white-label)', what: 'Websites for an agency’s clients, built under the agency’s name to its brief: motion-led and unique. The agency keeps the client and the margin.', usd: [80, null], time: 'per project', flat: true, partnerOnly: true },   // Install 21
  { key: 'care', name: 'Care plan', what: 'Monthly upkeep: updates, monitoring, backups and small changes, so the site keeps working.', usd: [20, 40], time: 'monthly', monthly: true },
]
export const offerOf = (key) => OFFERS.find((o) => o.key === key)
const nice = (n) => n < 100 ? Math.round(n / 5) * 5 : n < 1000 ? Math.round(n / 10) * 10 : Math.round(n / 50) * 50
const fmt = (n, cur) => CURRENCIES[cur].sym + Number(n).toLocaleString('en-GB')
export const currencyOf = (country) => (COUNTRIES[country] || COUNTRIES.US).currency
// a price for an offer at a tier, in a currency: { from, to, text } (to null = "from")
export function priceOf(key, tier = 'starter', currency = 'USD') {
  const o = offerOf(key); if (!o) return null
  const x = o.flat ? 1 : o.premiumOnly ? (tier === 'premium' ? 1.5 : 1) : (TIERS[tier] || TIERS.starter).x, r = CURRENCIES[currency] || CURRENCIES.USD
  const from = nice(o.usd[0] * x * r.rate), to = o.usd[1] == null ? null : nice(o.usd[1] * x * r.rate)
  const text = to == null ? 'from ' + fmt(from, currency) : to === from ? fmt(from, currency) : fmt(from, currency) + '–' + fmt(to, currency)
  return { from, to, currency, text: text + (o.monthly ? ' a month' : ''), monthly: !!o.monthly }
}
// the offers a tier can see (the premium-only ones appear from Growth up, as "custom" bigger projects)
export const offersFor = (tier) => OFFERS.filter((o) => !o.partnerOnly && (!o.premiumOnly || tier !== 'starter'))

// how the agent writes (added to every writing prompt)
export const VOICE = `Write as Olaitan: a real person who builds every project himself. Warm, direct, specific, short sentences. Curious about their
business before talking about his. Never salesy, never hype, no buzzwords, no exclamation marks, no flattery. Only offer what the playbook lists, at its
prices; never promise dates beyond its times; never mention a client that isn't in the proof list.`
export const FR_PS = 'P.S. Je vous écris en français, mais je travaille en anglais : mes réponses seront en anglais. Vous pouvez m’écrire en français ou en anglais, je comprends les deux.'
export const FR_OPT_OUT = 'Pas intéressé ? Répondez « non merci » et je ne vous écrirai plus.'
