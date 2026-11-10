// Explainer Shorts (Install 23): the shape of the Shorts that get watched to the end, for YouTube and Facebook alike.
//   versus: "How Poor vs Rich People Run the Same <business>". The poor owner does it the old way (flyers, a free slow
//           website) and closes; the rich one has a numbered plan (First… Second… Third… Fourth…) built on a good
//           website, and ends up with three shops. "Same <business>. Different website." Teaches what a website does
//           for a business, without an advert. A new business each day (BUSINESSES), words by the AI, checked by code.
//   build:  "You build it": the viewer builds something step by step, every step a problem ("But…") and its fix ("So…"),
//           ending on it working. Each topic is a drawn world in the factory (worker/formats/build.mjs); WORLDS lists
//           the ones that exist. One goes out on Wednesdays while there's a world not used yet.
// One a day, written by Autopilot; saved like any story Short (kind 'story', script.mode 'explain'), so the factory,
// the daily YouTube upload and the Facebook Reel all carry them with no other change. The long story pauses meanwhile.
import 'server-only'
import { q, one } from '@/lib/admin/db'
import { askJSON } from '@/lib/assistant/llm'
import { notify } from '@/lib/assistant/notify'

// the businesses take turns; item = what the factory draws on the counter, order = "New order £24" or "New booking 9:30"
export const BUSINESSES = [
  { key: 'bakery', noun: 'bakery', item: 'cake', order: 'order', thing: 'cakes' },
  { key: 'barber', noun: 'barbershop', item: 'scissors', order: 'booking', thing: 'haircuts' },
  { key: 'dentist', noun: 'dental clinic', item: 'tooth', order: 'booking', thing: 'check-ups' },
  { key: 'plumber', noun: 'plumbing business', item: 'wrench', order: 'booking', thing: 'repairs' },
  { key: 'gym', noun: 'gym', item: 'dumbbell', order: 'booking', thing: 'memberships' },
  { key: 'restaurant', noun: 'restaurant', item: 'plate', order: 'booking', thing: 'tables' },
  { key: 'florist', noun: 'flower shop', item: 'flower', order: 'order', thing: 'bouquets' },
  { key: 'photographer', noun: 'photo studio', item: 'camera', order: 'booking', thing: 'photo shoots' },
  { key: 'cafe', noun: 'coffee shop', item: 'coffee', order: 'order', thing: 'coffees' },
  { key: 'groomer', noun: 'dog groomer', item: 'paw', order: 'booking', thing: 'grooming visits' },
  { key: 'garage', noun: 'car garage', item: 'car', order: 'booking', thing: 'car services' },
  { key: 'tutor', noun: 'tutoring centre', item: 'book', order: 'booking', thing: 'lessons' },
  { key: 'cleaner', noun: 'cleaning company', item: 'spray', order: 'booking', thing: 'cleans' },
]
// what the rich owner does: each is a picture the factory can draw
const MOVES = {
  fast: 'a fast website that opens in about a second on any phone',
  sleep: `customers ${'order or book'} online at night while he sleeps`,
  email: 'every customer joins his email list and gets a reason to come back each week',
  reviews: 'he asks happy customers for reviews, so Google shows him first',
  chat: 'his website answers questions at any hour and turns them into bookings',
}
const POOR = ['flyers', 'bin', 'nephew', 'slow', 'leave', 'broke']
export const WORLDS = [{ key: 'cable', title: 'How Your Phone Loads a Website From Across the Ocean', lines: [     // the words, for the Scripts tab (the factory has them too)
  'You fill a ship with thousands of kilometres of internet cable, and sail it out to sea.', 'The cable unrolls behind you and sinks to the sea floor.',
  'But near the coast, a fishing anchor would snap it in seconds.', 'So you bury it under the sand with an underwater plough.', 'Out in the deep, sharks like to bite it.',
  'So you wrap it in plastic, then copper, then steel armour.', 'In the middle are strands of glass thinner than a hair, carrying light.', 'But light fades as it travels thousands of kilometres.',
  'So every few dozen kilometres, you add a repeater that makes it bright again.', 'On the other side, the cable comes up the beach into a landing station.',
  'From there it runs to a data centre, full of servers.', 'That is where websites actually live.', 'Then the signal goes to a phone tower near your house.',
  'You tap a link, and the page loads in under a second.', 'Congratulations! You just used a cable that crosses an entire ocean.', 'Follow for more.'] }]

const wordsOf = (s) => String(s || '').trim().split(/\s+/).filter(Boolean)
const ORD = ['First', 'Second', 'Third', 'Fourth']
const NEVER = /\b(guarantee|guaranteed|million|millionaire|scam|olexweb|click the link|link in|subscribe|buy now|discount)\b|https?:|www\./i

// a dependable script with no AI at all (also the shape the AI fills in)
export function plainVersus(b, moves) {
  const n = b.noun, o = b.order === 'booking'
  const said = {
    fast: 'First, a fast website that opens in one second on any phone.',
    sleep: o ? 'people book online at midnight, while he sleeps.' : `people order ${b.thing} online at midnight, while he sleeps.`,
    email: `every customer joins his email list, and every Friday he sends them something new.`,
    reviews: 'he asks happy customers for reviews, so Google shows him first.',
    chat: 'his website answers questions at two in the morning, and books them in.',
  }
  const rich = moves.map((m, k) => ({ text: k === 0 && m === 'fast' ? said.fast : `${ORD[k]}, ${said[m].replace(/^First, /, '')}`, scene: m, n: k + 1, sfx: 'pop' }))
  return [
    { text: `How poor and rich people run the exact same ${n}.`, scene: 'split' },
    { text: `A poor guy opens a ${n} and prints five hundred flyers.`, scene: 'flyers' },
    { text: 'He hands them out all day. Most end up in the bin.', scene: 'bin' },
    { text: 'Then his nephew builds him a website for free.', scene: 'nephew' },
    { text: 'It takes eight seconds to load, and on a phone the buttons are tiny.', scene: 'slow' },
    { text: o ? 'Customers can’t book, can’t find the price, and leave.' : 'Customers can’t order, can’t find the price, and leave.', scene: 'leave', sfx: 'bad' },
    { text: `So he decides the internet doesn’t work for his ${n}.`, scene: 'broke' },
    { text: `The rich guy opens the same ${n}, but he has a different plan.`, scene: 'rich' },
    ...rich,
    { text: `Now he has three of them, all making money.`, scene: 'three', sfx: 'win' },
    { text: `Same ${n}. Different website.`, scene: 'split' },
    { text: 'Follow for more.', scene: 'end' },
  ]
}
// the code's checks on the AI's lines (the pictures are fixed; only the words change)
export function checkVersus(beats, b, moves) {
  const p = [], shape = ['split', ...POOR, 'rich', ...moves, 'three', 'split', 'end']
  if (!Array.isArray(beats) || beats.length !== shape.length) return [`exactly ${shape.length} lines, one per picture`]
  beats.forEach((x, k) => {
    const t = String((x && x.text) || ''), w = wordsOf(t).length
    if (!t) p.push(`line ${k + 1} is empty`)
    if (w > 17) p.push(`line ${k + 1} has ${w} words (17 at most: it must be said in about 4 seconds)`)
    if (NEVER.test(t)) p.push(`line ${k + 1} says something it shouldn't (no links, no "guaranteed", no millionaires, no brand names)`)
  })
  moves.forEach((m, k) => { const t = String((beats[8 + k] || {}).text || ''); if (!new RegExp('^' + ORD[k] + '\\b', 'i').test(t)) p.push(`line ${9 + k} must start with "${ORD[k]},"`) })
  if (!new RegExp(b.noun.split(' ')[0], 'i').test(String((beats[0] || {}).text))) p.push(`the first line must name the ${b.noun}`)
  return p
}
export async function writeVersus(b, moves) {
  const plain = plainVersus(b, moves)
  const prompt = `Business: a ${b.noun} (they sell ${b.thing}; customers ${b.order === 'booking' ? 'book' : 'order'}).\nRewrite these ${plain.length} lines for this business so they sound natural, punchy and specific to it. Keep each line's meaning and its picture; keep it simple English; British money (£).\nThe 4 numbered lines must start with First, Second, Third, Fourth. The last two lines stay exactly: "Same ${b.noun}. Different website." and "Follow for more."\n\nLines:\n${plain.map((x, k) => `${k + 1}. [${x.scene}] ${x.text}`).join('\n')}\n\nAnswer JSON: {"lines": ["…", …]}`
  let problems = []
  for (let i = 0; i < 3; i++) {
    const j = await askJSON({ system: 'You write short, punchy narration for a YouTube Short comparing how a poor and a rich owner run the same small business. Each line is said in about 3 seconds over its own picture. No hype words, no brand names, no links.', prompt: i ? prompt + `\n\nYour last answer had problems: ${problems.join('; ')}. Fix them.` : prompt, kind: 'quick', temperature: 0.7 }).catch(() => null)
    const lines = j && Array.isArray(j.lines) ? j.lines.map((s) => String(s || '').trim()) : null
    if (!lines) { problems = ['no answer came back']; continue }
    const beats = plain.map((x, k) => ({ ...x, text: lines[k] || '' }))
    beats[beats.length - 2].text = `Same ${b.noun}. Different website.`; beats[beats.length - 1].text = 'Follow for more.'
    problems = checkVersus(beats, b, moves)
    if (!problems.length) return { beats, by: 'ai' }
  }
  return { beats: plain, by: 'plain', problems }
}
const cap = (s) => s.replace(/\b\w/g, (m) => m.toUpperCase())
function versusPackage(b) {
  const title = `How Poor vs Rich People Run the Same ${cap(b.noun)}`
  return {
    title,
    titleLines: ['How Poor vs Rich People', `Run the Same ${cap(b.noun)}`],
    description: `Same ${b.noun}. Different website.\n\nThe poor owner hands out flyers and gets a free website that takes eight seconds to load. The rich owner gets a fast website people can ${b.order === 'booking' ? 'book' : 'order'} from at midnight, an email list and reviews that put him first on Google.\n\nWant a website that works like the rich guy's? olexweb.com\n\n#shorts #smallbusiness #website #poorvsrich`,
    hashtags: ['poorvsrich', 'smallbusiness', 'website', b.noun.replace(/\s+/g, ''), 'businesstips', 'shorts'],
  }
}

// ---------- when, and which ----------
const lagos = () => new Date(Date.now() + 3600e3)                       // Lagos is UTC+1 all year
export async function explainOn() { const s = await one('select explain_style from yt_settings where id = 1').catch(() => null); return !!(s && s.explain_style !== false) }
export async function explainDue() {
  if (!await explainOn()) return false
  if (await one("select 1 from yt_scripts where kind = 'story' and script->>'mode' = 'explain' and created_at > now() - interval '20 hours'")) return false
  const waiting = await one("select count(*)::int as n from yt_scripts where kind = 'story' and status in ('draft', 'needs_review', 'approved', 'rendering', 'rendered') and (status <> 'rendered' or queue_pos is not null or yt_video_id is null)")
  return waiting.n < 3                                                   // never more than a few days ahead
}
export async function writeExplain({ format } = {}) {
  const used = (await q("select script->>'world' as w, script->>'biz' as b from yt_scripts where kind = 'story' and script->>'mode' = 'explain'")).rows
  const world = WORLDS.find((w) => !used.some((u) => u.w === w.key))
  const wednesday = lagos().getUTCDay() === 3
  const fmt = format || (world && wednesday ? 'build' : 'versus')
  const mode = (await one('select yt_mode as mode from yt_settings where id = 1').catch(() => null))?.mode || 'approval'
  const status = mode === 'autopilot' ? 'approved' : 'draft'
  let script, pkg, label
  if (fmt === 'build') {
    const w = world || WORLDS[0]
    script = { mode: 'explain', format: 'build', world: w.key, voice: 'am_michael', speed: 1.16, scenes: w.lines.map((t, k) => ({ id: 's' + (k + 1), type: 'explain-build', pose: 'calm', text: t })) }   // the drawing lives in the factory
    pkg = { title: w.title, titleLines: null, description: `${w.title}. Step by step: every problem, and how it's solved.\n\nOlexweb builds websites that load fast, wherever your customers are. olexweb.com\n\n#shorts #howitworks #internet #website`, hashtags: ['howitworks', 'internet', 'website', 'explained', 'shorts'] }
    label = w.title
  } else {
    const n = used.filter((u) => u.b).length, b = BUSINESSES[n % BUSINESSES.length]
    const all = Object.keys(MOVES), moves = ['fast', ...all.filter((m) => m !== 'fast').sort(() => Math.random() - 0.5).slice(0, 3)]
    const { beats, by } = await writeVersus(b, moves)
    pkg = versusPackage(b)
    script = { mode: 'explain', format: 'versus', biz: b.key, business: b, voice: 'am_adam', speed: 1.15, titleLines: pkg.titleLines, beats, by, scenes: beats.map((x, k) => ({ id: 's' + (k + 1), type: 'explain-' + x.scene, pose: 'calm', text: x.text })) }
    label = pkg.titleLines.join(' ')
  }
  const row = await one(`insert into yt_scripts (idea_id, kind, status, script, package, claims, checks, seconds, writer, mention, approved_at)
      values (null, 'story', $1, $2, $3, '[]', '[]', $4, $5, false, case when $1 = 'approved' then now() end) returning id, status`,
    [status, JSON.stringify(script), JSON.stringify(pkg), fmt === 'build' ? 50 : 45, fmt === 'build' ? 'template' : script.by === 'ai' ? 'ai' : 'template'])
  await notify('ideas', status === 'approved' ? `Today's Short is written: ${label}. It renders and goes up by itself.` : `Today's Short is ready for review: ${label}.`, '/admin/youtube?view=scripts')
  return { id: row.id, format: fmt, status: row.status, title: pkg.title }
}
// what the factory gets for it (lib/site/factory.js jobFor)
export function explainJob(s, PIECE) {
  const sc = s.script, base = { id: s.id, kind: 'story', mode: 'explain', format: sc.format, voice: sc.voice, speed: sc.speed, title: s.package.title, piece: PIECE }
  if (sc.format === 'build') return { ...base, world: sc.world }
  return { ...base, titleLines: sc.titleLines, biz: sc.business, beats: sc.beats }
}
