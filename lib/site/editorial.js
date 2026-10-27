// The Olexweb editorial rulebook: what every AI-written page must be, and the checks that enforce it in code.
// A page that fails any HARD check never goes live; it stays a private draft with the reasons, for review.
import 'server-only'

export const RULEBOOK = `You write for the Olexweb Directory (olexweb.com/tools): clear, honest, practical guides to useful websites, AI and tech,
for creators, students, freelancers and small businesses, especially in Nigeria and Africa, and readable anywhere.

WHO YOU ARE WRITING FOR: a busy person who wants to know in one minute what this is, whether it's free, if it's for them, and how to start.

ACCURACY (non-negotiable)
1. Every factual statement about the site (what it does, features, limits, that it's free, prices, platforms, sign-up) must come from the
   site's own text given to you. For each one, return the claim AND an exact quote copied word for word from that text.
2. Never invent: prices, plans, user numbers, ratings, awards, founders, dates, integrations, testimonials or results.
3. If the text doesn't say whether it's free, the pricing status is "unknown". Do not guess.
4. Opinion is allowed ONLY in "ourTake", "goodFor" and "watchOut", must be reasonable from the facts, and must not state new facts.
5. If the site's text is too thin to explain it properly, say so in "thin": true. Thin pages are not published.

VALUE (every page must earn its place)
6. Add something the site's own homepage doesn't: who it's really for, when to use it, how to start in steps, its limits, and a clear verdict.
7. Be specific: name the actual task it helps with (e.g. "turn a rough sketch into a clean diagram"), not vague benefits.
8. The page must answer what people search: "what is X", "is X free", "how to use X", "X alternatives".

VOICE
9. Warm, confident, plain English. Short sentences. Explain like a smart friend, not a salesman.
10. Never use: hype ("revolutionary", "game-changer", "ultimate", "unleash", "supercharge", "next-level", "cutting-edge"),
    filler ("in today's fast-paced world", "whether you're", "look no further", "dive into", "delve", "elevate", "seamless", "robust"),
    exclamation marks, emojis, or clickbait.
11. Titles describe the page honestly: "<Name>: <what it does in plain words>". No "best ever", no numbers you can't back.

SAFETY
12. Never recommend sites for piracy, cracking, adult content, gambling, hacking others, or anything illegal. If the site is like that, set "unsafe": true.
13. Mention real risks plainly when they exist (sign-up needed, data or privacy concerns, limits on the free plan).`

const BANNED = ['revolutionary', 'game-changer', 'game changer', 'ultimate', 'unleash', 'supercharge', 'next-level', 'next level', 'cutting-edge', 'cutting edge',
  'in today’s fast-paced', "in today's fast-paced", 'look no further', 'dive into', 'delve', 'elevate', 'seamless', 'robust', 'whether you’re a', "whether you're a", 'unlock the power', 'harness the power', 'in conclusion']
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/u
export const norm = (s) => String(s || '').toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim()

// HARD checks (any failure blocks publishing) and SOFT points (the quality score). Returns { ok, score, problems, notes }.
export function checkEntry(e, pageText) {
  const P = norm(pageText), problems = [], notes = []
  const text = JSON.stringify([e.title, e.metaDescription, e.oneLiner, e.summary, e.whoFor, e.howToStart, e.ourTake, e.goodFor, e.watchOut, e.faq])
  const quoteOk = (q) => q && norm(q).length >= 12 && P.includes(norm(q))
  if (e.unsafe) problems.push('Marked unsafe (piracy, adult, gambling, hacking or illegal use).')
  if (e.thin) problems.push('The site’s own text is too thin to explain it properly.')
  const facts = e.facts || [], bad = facts.filter((f) => !quoteOk(f.quote))
  if (facts.length < 3) problems.push('Fewer than 3 facts backed by the site’s own words.')
  if (bad.length) problems.push(`Not backed by the site’s text: “${String(bad[0].claim).slice(0, 80)}”`)
  const pr = e.pricing || {}
  if (!['free', 'freemium', 'paid', 'unknown'].includes(pr.status)) problems.push('Pricing status missing.')
  else if (pr.status !== 'unknown' && !quoteOk(pr.quote)) problems.push('Says it’s ' + pr.status + ' without the site’s own words to prove it.')
  if (!e.title || e.title.length > 70) problems.push('Title missing or longer than 70 characters.')
  if (!e.metaDescription || e.metaDescription.length < 70 || e.metaDescription.length > 160) problems.push('Search description must be 70–160 characters.')
  if (!e.summary || e.summary.length < 120) problems.push('Summary too short to be useful.')
  if (!(e.howToStart || []).length || (e.howToStart || []).length < 3) problems.push('“How to start” needs at least 3 steps.')
  if (!(e.whoFor || []).length) problems.push('Who it’s for is missing.')
  if (!e.ourTake || e.ourTake.length < 80) problems.push('“Our take” is missing or too short.')
  const low = text.toLowerCase(), hit = BANNED.find((w) => low.includes(w)); if (hit) problems.push(`Uses a banned phrase: “${hit}”.`)
  if (EMOJI.test(text)) problems.push('Contains emoji.')
  if (text.includes('!')) problems.push('Contains an exclamation mark.')
  if (/\$\s?\d|₦\s?\d|\d+\s?(usd|naira|dollars)/i.test(text) && !(facts.some((f) => /\d/.test(f.quote)) || (pr.quote && /\d/.test(pr.quote)))) problems.push('Mentions a price that the site’s text doesn’t show.')
  // quality score (0–100) for ranking and review
  let score = 40
  score += Math.min(20, facts.length * 4); score += Math.min(10, (e.faq || []).length * 3); score += Math.min(10, (e.howToStart || []).length * 2)
  if (pr.status !== 'unknown') score += 8; if ((e.watchOut || []).length) score += 6; if ((e.goodFor || []).length >= 2) score += 6
  if (e.summary && e.summary.length > 220) notes.push('Detailed summary')
  return { ok: problems.length === 0, score: Math.min(100, score), problems, notes }
}
