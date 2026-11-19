// The daily Short as a real story (Install 32). One main video a day, planned: a cast of 2 to 4 people, at least three
// places, a cold open (the most dramatic moment first), a flashback card, a twist, and a last line that leads back into
// the first (so it loops). The factory films it with a moving camera (worker/story/taleshort.mjs).
// Four series take turns in the plan (lib/site/plan.js), each planned by code before the AI writes a word, so the same
// storyline never comes round twice:
//   turnaround  "The comeback": a small business is dying for a reason the owner can't see; someone finds the real
//               reason (it's always something a good website or being findable online fixes); the comeback. This is the
//               series that brings Olexweb customers: every owner watching sees their own shop in it.
//   scam        "The scam": a short thriller built on one of our real, checked safety alerts (never an invented scam).
//   relatable   "Can you relate?": a funny everyday moment with tech, customers or family, ending on a punchline.
//   mystery     "The mystery": something strange happens with tech; the answer is logical and satisfying.
// Fiction only: no real people, companies, banks or apps; never a year; Olexweb is never named in the story itself.
import 'server-only'
import { q, one } from '@/lib/admin/db'
import { askJSON, writtenBy } from '@/lib/assistant/llm'
import { notify } from '@/lib/assistant/notify'
import { linesOf } from './story'
import { BUSINESSES } from './explain'
import { PLACES, TALE_EMOTIONS, LOOK, BRANDS, toBeat, LOOKS, CITIES } from './tale'

export const SERIES = {
  turnaround: { name: 'The comeback', music: 'hope', tag: 'smallbusiness' },
  scam: { name: 'The scam', music: 'tense', tag: 'scam' },
  relatable: { name: 'Can you relate?', music: 'hope', tag: 'relatable' },
  mystery: { name: 'The mystery', music: 'mystery', tag: 'mystery' },
}
// what is really wrong with the business (the twist), each one something a good website or being found online fixes
export const PROBLEMS = [
  'people search for it on their phones and it simply does not show up; a newer shop does',
  'the website takes ages to open on a phone, so people give up before they see anything',
  'the only way to book is to phone, and the phone rings out while the owner is busy',
  'someone has made a fake page using the business name and is taking customers’ deposits',
  'the opening hours online are wrong, so customers keep arriving to a locked door and leave bad reviews',
  'messages from customers sit unanswered for days in an inbox nobody checks',
  'it has almost no reviews, so people choose the place with hundreds',
  'the price list online is a blurry photo nobody can read on a phone',
  'customers can’t pay or order online, so they order from the shop next door that lets them',
  'one delivery app brings all the customers and takes most of the money from every order',
  'the website still shows last year’s prices and a phone number that no longer works',
  'people find the business, but nothing tells them why it is better, so they keep scrolling',
]
// everyday moments people laugh at and share
export const MOMENTS = [
  'a customer who wants a full online shop built for the price of a sandwich',
  'the family group chat when an uncle forwards a fake message and swears it is real',
  'teaching a parent to use a new smartphone over a video call',
  'a boss who discovered AI yesterday and now wants it to do everything',
  'a client who asks for the logo to be bigger, then bigger again',
  'asking for the Wi-Fi password at a family party',
  'a video meeting where someone thinks they are on mute',
  'forgetting a password for the tenth time and the reset email never arriving',
  'a friend who says "you do computers, can you fix my fridge?"',
  'the website going down five minutes into a big launch',
  'a "quick favour" for a cousin that turns into building a whole website for free',
  'an online order that arrives looking nothing like the picture',
  'a grandmother who becomes better at online shopping than the whole family',
  'two flatmates fighting over the slow internet',
]
export const RIDDLES = [
  'messages they never sent start appearing in their sent folder',
  'their shop gets a hundred five-star reviews overnight, from people who have never been in',
  'someone logs into their account from a city they have never visited',
  'small amounts of money keep vanishing from their account every Friday',
  'customers say they spoke to them on the phone, but they never made those calls',
  'their website shows a different price to every visitor',
  'a stranger knows exactly where they were last weekend',
  'their old phone, sold months ago, starts sending them messages',
]

const clean = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n)
const words = (s) => (String(s || '').match(/[A-Za-z0-9'’]+/g) || []).length
const YEAR = /\b(19|20)\d\d\b/
const OURS = /\bolex(web)?\b|https?:|www\.|\.com\b|subscribe|link in (the )?bio|click the link/i
const SHORT_SHOTS = ['wide', 'two', 'close', 'phone']                         // a laptop screen is too wide for a phone
const WPS = 2.55

// ---------- the plan: what this one is about (code, before any AI) ----------
export async function storylineFor(format) {
  const n = (await one("select count(*)::int as n from yt_scripts where kind = 'story' and script->>'mode' = 'tale' and script->>'format' = $1", [format])).n
  const all = (await one("select count(*)::int as n from yt_scripts where kind = 'story' and script->>'mode' = 'tale'")).n
  const country = all % 2 ? 'US' : 'GB', city = CITIES[country][Math.floor(all / 2) % CITIES[country].length]
  const base = { format, country, city }
  if (format === 'turnaround') { const b = BUSINESSES[(n * 7) % BUSINESSES.length]; return { ...base, business: b.noun, problem: PROBLEMS[n % PROBLEMS.length] } }
  if (format === 'relatable') return { ...base, moment: MOMENTS[n % MOMENTS.length] }
  if (format === 'mystery') return { ...base, riddle: RIDDLES[n % RIDDLES.length] }
  return base
}
// a scam story stands on a real, checked safety alert (the newest one no story has used yet)
async function alertSource() {
  const r = await one(`select id, slug, name, content from dir_entries where kind = 'alert' and status = 'live' and tale_id is null and published_at > now() - interval '45 days' order by published_at desc limit 1`).catch(() => null)
  if (!r || !r.content) return null
  const c = r.content
  return { id: r.id, slug: r.slug, title: clean(c.title || r.name, 120), text: clean([c.title, c.summary, ...(c.points || []), c.whyItMatters, ...(c.whatToDo || [])].filter(Boolean).join('. '), 3000) }
}

// ---------- the brief ----------
const SYSTEM = `You write animated story Shorts (a hand-drawn sketch style, like a moving comic) that people watch to the very end and then watch again. Gripping, emotional or funny, always original. You write in plain, natural spoken English; every line is short because it is performed out loud by the characters.`
const SCHEMA = { type: 'object', properties: {
  titles: { type: 'array', items: { type: 'string' } }, hook: { type: 'string' }, logline: { type: 'string' }, ask: { type: 'string' }, jump: { type: 'string' },
  cast: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, role: { type: 'string' }, sex: { type: 'string' }, age: { type: 'string' }, hair: { type: 'string' }, skin: { type: 'string' }, top: { type: 'string' } } } },
  cold: { type: 'array', items: { type: 'object' } }, beats: { type: 'array', items: { type: 'object' } } },
  required: ['titles', 'hook', 'logline', 'ask', 'jump', 'cast', 'cold', 'beats'] }
const BEAT = `Each beat: {"place": one of ${PLACES.join('/')}, "shot": one of ${SHORT_SHOTS.join('/')} ("wide" = the place with everyone in it, "two" = two people face to face, "close" = one face fills the screen, "phone" = a phone screen fills it), "who": the cast ids in the picture (1 to 3), "speaker": a cast id or "narrator", "emotion": one of ${TALE_EMOTIONS.join('/')} (the speaker's feeling), "line": what is said (2 to 18 words), and when the shot is "phone": "phone": {"from": who or what is on the screen (16 characters max), "text": what it says (80 characters max)}. Mark the turning point with "twist": true.`
function premise(p, alert) {
  if (p.format === 'turnaround') return `THE COMEBACK. A ${p.business} that has been open for years is dying: empty, bills piling up, the owner about to give up. The owner blames everything else (the economy, young people, the weather). Someone close to them (a child, a friend, a customer) finds the REAL reason, which is this: ${p.problem}. That is the twist. They fix it (in words anyone understands: a proper website, being findable when people search, booking or ordering online, answering fast, reviews), and the payoff is the shop busy again. Grounded and believable: no millions, no fake statistics. The fix is never named after a real company or app, and nobody sells anything.`
  if (p.format === 'scam') return `THE SCAM. An ordinary person gets targeted by this real scam and comes within seconds of losing their money or account. The pressure builds fast. A twist. They (or someone close) spot the warning sign just in time. The scam must work EXACTLY like this real, checked alert (invent nothing about how it works):\n${alert ? alert.text : ''}`
  if (p.format === 'relatable') return `CAN YOU RELATE? A funny, true-to-life moment: ${p.moment}. It escalates in three steps, each funnier than the last, and ends on a punchline that makes people tag a friend. Warm humour, nobody humiliated, clean enough for a family.`
  return `THE MYSTERY. Something strange happens: ${p.riddle}. The main character investigates in quick steps: a clue, a wrong suspect, then the real answer, which is logical, surprising and fair (the clues were there).`
}
function brief(p, alert, avoid) {
  return `Write ONE original animated story Short (50 to 70 seconds). Set it in ${p.city}, ${p.country === 'GB' ? 'England' : 'USA'}: ${p.country === 'GB' ? 'British' : 'American'} names and the way people talk there, ${p.country === 'GB' ? '£' : '$'} for money.
${premise(p, alert)}
Rules that make people watch to the end and watch again:
- "cold": 1 beat (2 at most): the most dramatic or funniest moment of the whole story, shown FIRST, before we know why. Its line grabs attention in the first 2 seconds.
- "jump": the flashback label, 2 words, e.g. "2 WEEKS EARLIER" counts as 3 and is fine; "THAT MORNING" also works.
- "beats": 9 to 14 beats that tell the story from the start up to and past that moment. Mostly the characters talking to each other (the narrator at most 3 lines). Feelings change often. Every beat is something you can SEE.
- Use at least 3 different places as the story moves on, and change the shot often (never the same shot three times in a row). Use a "phone" shot for any message, search or screen that matters.
- The twist comes after the middle ("twist": true on that beat).
- The LAST line echoes the cold open's line (same words, new meaning) so the video loops back into its own start.
- ${BEAT}
- Total spoken words (cold + beats): 120 to 175.
- "cast": 2 to 4 characters, ids "a", "b", "c", "d" ("a" is the main character). Each: name, role, sex (f or m), age (young, adult or older), hair (${LOOK.hair.join('/')}), skin (${LOOK.skin.join('/')}), top colour (${LOOK.top.join('/')}). A mix of people.
- Fiction only: never a real person, company, bank, shop, app or brand (make names up). Never a year. Never mention Olexweb, websites by address, or "subscribe".
- "hook": 2 to 4 BIG words shown on screen during the cold open (e.g. "SHE ALMOST QUIT", "DON'T OPEN IT").
- "titles": 3 YouTube Shorts titles under 60 characters: curiosity and stakes, honest about the story, no hashtags, no year.
- "logline": one sentence about the story. "ask": a question for the comments (6 to 14 words, ends with "?").
${avoid.length ? `- It must be clearly different from these stories already made:\n${avoid.map((x) => '  - ' + x).join('\n')}\n` : ''}Answer as JSON only.`
}

// ---------- checking it (plain code) ----------
export function shapeShort(d, p) {
  const cast = (Array.isArray(d.cast) ? d.cast : []).slice(0, 4).map(LOOKS), ids = cast.map((c) => c.id)
  const fix = (b) => { const x = toBeat({ ...b, shot: SHORT_SHOTS.includes(b.shot) ? b.shot : b.shot === 'screen' ? 'phone' : 'wide', ...(b.shot === 'screen' && !b.phone ? { phone: { from: 'Screen', text: (Array.isArray(b.screen) ? b.screen : []).join(' · ') } } : {}) }, ids, 0); delete x.ch; return x }
  const cold = (Array.isArray(d.cold) ? d.cold : []).slice(0, 2).map((b) => ({ ...fix(b), scene: 'cold' }))
  const beats = (Array.isArray(d.beats) ? d.beats : []).slice(0, 18).map(fix)
  const jump = clean(d.jump, 20).toUpperCase().replace(YEAR, '').trim() || '2 WEEKS EARLIER'
  return { format: p.format, country: p.country, city: p.city, cast, cold, beats, jump, hook: clean(d.hook, 28).toUpperCase() || 'WAIT FOR IT',
    titles: (Array.isArray(d.titles) ? d.titles : []).map((t) => clean(t, 90).replace(/#\S+/g, '').trim()).filter((t) => t && !YEAR.test(t) && !BRANDS.test(t) && !OURS.test(t)).slice(0, 3),
    logline: clean(d.logline, 300), ask: /\?$/.test(clean(d.ask, 120)) ? clean(d.ask, 120) : 'Would you have seen it coming?' }
}
export function assembleShort(T) {
  const j = T.jump.split(/\s+/), label = j.length > 2 ? [j.slice(0, -1).join(' '), j[j.length - 1]] : j.length === 2 ? j : [T.jump]
  return [...T.cold, { scene: 'timejump', emotion: 'calm', text: '', props: { label, secs: 1.1 } }, ...T.beats]
}
export const shortSeconds = (beats) => Math.round(beats.reduce((a, b) => a + (b.text ? words(b.text) / WPS + 0.3 : Number((b.props || {}).secs) || 1.1), 0))
const content = (s) => new Set((String(s || '').toLowerCase().match(/[a-z']{4,}/g) || []))
export function checkShort(T) {
  const lines = [...T.cold, ...T.beats], all = lines.map((b) => b.text).join(' '), total = words(all), secs = shortSeconds(assembleShort(T))
  const long = lines.filter((b) => words(b.text) > 20 || words(b.text) < 1)
  const narr = lines.filter((b) => b.speaker === 'narrator').length / Math.max(1, lines.length)
  const places = new Set(lines.map((b) => b.place)).size
  const brand = [all, ...lines.map((b) => [b.props.phone && b.props.phone.from, b.props.phone && b.props.phone.text].join(' ')), ...T.titles].find((x) => BRANDS.test(x || '') || OURS.test(x || ''))
  let same = 0; for (let k = 2; k < T.beats.length; k++) if (T.beats[k].shot === T.beats[k - 1].shot && T.beats[k].shot === T.beats[k - 2].shot && T.beats[k].place === T.beats[k - 2].place) same++
  const first = content(T.cold[0] && T.cold[0].text), last = content(T.beats.length ? T.beats[T.beats.length - 1].text : ''), echo = [...first].filter((w) => last.has(w)).length
  const checks = [
    { key: 'cast', ok: T.cast.length >= 2, note: `${T.cast.length} characters (2 to 4)` },
    { key: 'hook', ok: T.cold.length >= 1 && words(T.cold[0].text) >= 2, note: 'it opens on the most dramatic moment, then flashes back' },
    { key: 'beats', ok: T.beats.length >= 8 && T.beats.length <= 16, note: `${T.beats.length} beats after the flashback (8 to 16)` },
    { key: 'length', ok: secs >= 40 && secs <= 80 && total >= 100 && total <= 210, note: `about ${secs} seconds (${total} words); 40 to 80 seconds` },
    { key: 'lines', ok: !long.length, note: long.length ? `${long.length} line(s) too long or empty (20 words max)` : 'every line is one breath' },
    { key: 'dialogue', ok: narr <= 0.4, note: `${Math.round(narr * 100)}% narration (40% at most: the characters tell it)` },
    { key: 'places', ok: places >= 3, note: `${places} different places (3 at least: the scene keeps changing)` },
    { key: 'shots', ok: same === 0, note: same ? 'the same shot three times in a row' : 'the shot changes all the time' },
    { key: 'twist', ok: T.beats.some((b) => b.twist), note: 'a twist after the middle' },
    { key: 'loop', ok: echo >= 2, note: echo >= 2 ? 'the last line leads back into the first (it loops)' : 'the last line doesn’t echo the first' },
    { key: 'fiction', ok: !brand && !YEAR.test(all), note: brand ? 'names a real brand, Olexweb or a web address: ' + clean(brand, 60) : 'no real companies, no years, no adverts' },
    { key: 'titles', ok: T.titles.length >= 1, note: `${T.titles.length} title(s)` },
  ]
  return { ok: checks.every((c) => c.ok), checks, seconds: secs, words: total }
}
const CRITICAL = ['cast', 'hook', 'beats', 'length', 'lines', 'places', 'fiction', 'titles']

// ---------- the description: where the viewers go next ----------
function describe(T, alert) {
  const tail = T.format === 'turnaround' ? 'Is your business easy to find, book and order from online? Olexweb builds websites that bring customers in: https://olexweb.com/services/best-business-website'
    : T.format === 'scam' && alert ? `This scam is real. How to spot it: https://olexweb.com/alerts/${alert.slug}`
    : 'New tools, tech stories and scam alerts every day: https://olexweb.com/tools'
  return `${T.logline}\n\n${tail}\n\nA fictional story, animated. Names, people and companies are made up.\n\n${T.ask}\n\n#shorts #story #animation #${SERIES[T.format].tag}`.trim()
}

// ---------- writing it ----------
export async function writeShortTale({ format = 'turnaround' } = {}) {
  if (!SERIES[format]) format = 'turnaround'
  const alert = format === 'scam' ? await alertSource() : null
  if (format === 'scam' && !alert) format = 'mystery'                           // no fresh real alert: a mystery instead (never an invented scam)
  const p = await storylineFor(format)
  const avoid = (await q("select script->>'logline' as l from yt_scripts where kind = 'story' and script->>'mode' = 'tale' and script->>'logline' is not null order by id desc limit 25")).rows.map((r) => clean(r.l, 160)).filter(Boolean)
  let T = null, res = null, by = null
  for (let attempt = 0; attempt < 3; attempt++) {
    const extra = attempt && res ? `\n\nYOUR LAST STORY failed these checks; write it again and fix every one:\n${res.checks.filter((c) => !c.ok).map((c) => '- ' + c.key + ': ' + c.note).join('\n')}` : ''
    let d = null
    try { d = await askJSON({ system: SYSTEM, prompt: brief(p, alert, avoid) + extra, schema: SCHEMA, temperature: attempt ? 0.75 : 0.95, maxTokens: 5000, kind: 'write' }) } catch { d = null }
    if (!d) continue
    const t2 = shapeShort(d, p), r2 = checkShort(t2)
    if (!res || r2.checks.filter((c) => c.ok).length > res.checks.filter((c) => c.ok).length) { T = t2; res = r2; by = writtenBy(d) }
    if (res.ok) break
  }
  if (!T || res.checks.some((c) => !c.ok && CRITICAL.includes(c.key))) throw new Error(`The ${SERIES[format].name.toLowerCase()} story didn’t pass its checks (${res ? res.checks.filter((c) => !c.ok).map((c) => c.key).join(', ') : 'no answer'}). It is written again shortly.`)
  const beats = assembleShort(T), mode = ((await one('select yt_mode from yt_settings where id = 1')) || {}).yt_mode
  const status = mode === 'autopilot' ? (res.ok ? 'approved' : 'needs_review') : res.ok ? 'draft' : 'needs_review'
  const title = (T.titles[0] || T.logline || 'A story').slice(0, 95)
  const pk = { title, titles: T.titles.length ? T.titles : [title], description: describe(T, alert), hashtags: ['shorts', 'story', 'animation', SERIES[format].tag, 'storytime'], category: '24', hook: T.hook }
  const named = (b) => { const who = b.speaker === 'narrator' ? 'Narrator' : (T.cast.find((c) => c.id === b.speaker) || {}).name; return who && b.text ? who + ': ' + b.text : b.text }
  const script = { mode: 'tale', short: true, format, series: SERIES[format].name, genre: format, country: T.country, city: T.city, cast: T.cast, hook: T.hook, logline: T.logline, music: SERIES[format].music,
    plan: p, alert: alert ? { id: alert.id, slug: alert.slug, title: alert.title } : null, story: { beats, ask: T.ask },
    scenes: linesOf(beats).map((x, i) => (beats[i].text ? { ...x, text: named(beats[i]) } : x)) }
  const row = await one(`insert into yt_scripts (idea_id, kind, status, script, package, claims, checks, seconds, writer, mention, approved_at)
      values (null, 'story', $1, $2, $3, '[]', $4, $5, $6, false, case when $1 = 'approved' then now() end) returning id, status`,
    [status, JSON.stringify(script), JSON.stringify(pk), JSON.stringify(res.checks), res.seconds, by])
  if (alert) await q('update dir_entries set tale_id = $2 where id = $1', [alert.id, row.id]).catch(() => {})
  await notify('ideas', status === 'approved' ? `A story Short is written: “${title}” (${SERIES[format].name}). It's made and posted by itself.` : `A story Short waits for you: “${title}” (${SERIES[format].name}).`, '/admin/automation/plan').catch(() => {})
  return { id: row.id, status: row.status, format, title, seconds: res.seconds }
}
// what the factory gets for it (lib/site/factory.js jobFor)
export function taleShortJob(s, PIECE, withFb) {
  const sc = s.script, beats = sc.story.beats, last = [...beats].reverse().find((b) => b.place) || {}
  const ask = withFb ? { fb: { ask: { scene: 'line', place: last.place || 'home', shot: 'wide', who: (last.who || []).slice(0, 2), speaker: 'narrator', emotion: 'curious', text: sc.story.ask || 'Would you have seen it coming?', props: {} } } } : {}
  return { id: s.id, kind: 'story', mode: 'tale', genre: sc.genre, country: sc.country, music: sc.music, cast: sc.cast, hook: sc.hook, story: { beats }, ...ask, title: s.package.title, piece: PIECE }
}
