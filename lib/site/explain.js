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
  // more, so the same business doesn't come round again for a month (each uses a drawing the factory already has)
  { key: 'salon', noun: 'hair salon', item: 'scissors', order: 'booking', thing: 'hair appointments' },
  { key: 'pizzeria', noun: 'pizza shop', item: 'plate', order: 'order', thing: 'pizzas' },
  { key: 'repairs', noun: 'repair shop', item: 'wrench', order: 'booking', thing: 'repairs' },
  { key: 'yoga', noun: 'yoga studio', item: 'dumbbell', order: 'booking', thing: 'classes' },
  { key: 'vet', noun: 'vet clinic', item: 'paw', order: 'booking', thing: 'appointments' },
  { key: 'bookshop', noun: 'bookshop', item: 'book', order: 'order', thing: 'books' },
  { key: 'carwash', noun: 'car wash', item: 'car', order: 'booking', thing: 'washes' },
  { key: 'tailor', noun: 'tailoring shop', item: 'scissors', order: 'order', thing: 'outfits' },
  { key: 'icecream', noun: 'ice cream shop', item: 'cake', order: 'order', thing: 'ice creams' },
  { key: 'wedding', noun: 'wedding studio', item: 'camera', order: 'booking', thing: 'wedding shoots' },
  { key: 'juice', noun: 'juice bar', item: 'coffee', order: 'order', thing: 'juices' },
  { key: 'garden', noun: 'garden centre', item: 'flower', order: 'order', thing: 'plants' },
  { key: 'laundry', noun: 'laundry service', item: 'spray', order: 'booking', thing: 'pick-ups' },
  { key: 'driving', noun: 'driving school', item: 'car', order: 'booking', thing: 'lessons' },
  { key: 'physio', noun: 'physio clinic', item: 'dumbbell', order: 'booking', thing: 'sessions' },
  { key: 'language', noun: 'language school', item: 'book', order: 'booking', thing: 'classes' },
  { key: 'petshop', noun: 'pet shop', item: 'paw', order: 'order', thing: 'pet supplies' },
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
// Install 33: the 3D "You build it" worlds. The factory (worker/build3d/worlds) has the same keys, titles and lines; the
// picture lives there, the words are listed here so the Scripts tab and the plan show exactly what will be said.
export const WORLDS = [
  { key: "datacentre", title: "How You Build the Place Where the Internet Lives", lines: [
    "This is how you build the place where the internet actually lives.",
    "You start with an empty field, far from the city, where land is cheap.",
    "You pour a giant concrete floor, strong enough to hold thousands of tonnes of computers.",
    "Then you put up the walls of a huge box with no windows.",
    "Inside, you roll in rows and rows of server racks.",
    "Every rack is packed with computers, and every website you visit lives on one of them.",
    "But all these computers need as much power as a small town.",
    "So you build your own power station next door, with generators in case the power ever fails.",
    "But thousands of computers get hot. Really hot.",
    "So you put giant fans on the roof that pull the heat out, day and night.",
    "Now you bring in the internet: thick fibre cables, buried under the ground.",
    "Light flashes down the glass, carrying every search, every video and every message.",
    "You tap a link on your phone, and a server in here answers in a blink.",
    "Congratulations! You just built a data centre.",
    "Follow to build the next one.",
  ] },
  { key: "cable", title: "How You Build the Internet Cable That Crosses an Ocean", lines: [
    "This is how the internet crosses an entire ocean.",
    "You load a ship with thousands of kilometres of cable, and sail out to sea.",
    "The cable unrolls off the back and sinks all the way to the sea floor.",
    "But near the coast, one fishing anchor could snap it in seconds.",
    "So you bury it under the sand with an underwater plough.",
    "Out in the deep, sharks love to bite it.",
    "So you wrap it in plastic, copper and steel armour.",
    "Right in the middle are strands of glass thinner than a hair, carrying light.",
    "But light fades after travelling thousands of kilometres.",
    "So every few dozen kilometres, you add a repeater that makes it bright again.",
    "On the other side, the cable comes up the beach into a landing station.",
    "From there, it runs to a data centre full of servers.",
    "Then to a phone mast near your house.",
    "You tap a link, and the page loads in under a second.",
    "Congratulations! You just built a cable across an entire ocean.",
    "Follow to build the next one.",
  ] },
  { key: "ai", title: "How You Build the Supercomputer Behind AI", lines: [
    "This is how you build the computer that powers AI.",
    "It starts with one chip, smaller than your hand, with billions of tiny switches inside.",
    "You put eight of them on one board, side by side.",
    "Then you slide the board into a server.",
    "One server is nowhere near enough, so you stack them into racks.",
    "Then you fill a whole hall with thousands of them.",
    "You wire every one to every other one, so they work as one giant brain.",
    "But these chips run so hot that fans are not enough.",
    "So you pump cold water right over every chip.",
    "All of it needs as much power as a whole city.",
    "Now you feed it a huge part of the internet: books, websites and code.",
    "For weeks, it practises guessing the next word, billions of times.",
    "Then you type a question, and it answers in seconds.",
    "Congratulations! You just built an AI supercomputer.",
    "Follow to build the next one.",
  ] },
  { key: "mast", title: "How You Build the Tower That Puts the Internet in Your Pocket", lines: [
    "This is how you build the tower that puts the internet in your pocket.",
    "You pick a high spot, where nothing blocks the signal.",
    "You dig deep and pour a concrete base, so the wind can never knock it over.",
    "Then you bolt a steel tower together, piece by piece, thirty metres high.",
    "At the top, you fix antennas pointing three ways, to cover every direction.",
    "But the antennas need the internet first.",
    "So you run a fibre cable underground, all the way from the street.",
    "Next to the tower, you put a cabinet full of radios and batteries.",
    "You switch it on, and invisible radio waves spread out in every direction.",
    "Your phone catches the waves and turns them back into videos and messages.",
    "But thousands of phones in one place slow everything down.",
    "So you build more, smaller masts, closer together.",
    "Now you can stream a video from almost anywhere.",
    "Congratulations! You just built a 5G mast.",
    "Follow to build the next one.",
  ] },
  { key: "fibre", title: "How You Build Fibre Broadband to Your House", lines: [
    "This is how fast internet gets all the way into your house.",
    "It starts at a big exchange building, where the internet arrives on thick cables.",
    "You dig a narrow trench along the street, right under the pavement.",
    "Into it, you lay plastic tubes called ducts.",
    "Then you blow glass fibre through the tubes with compressed air.",
    "At the corner, you put a green cabinet that splits one fibre into many.",
    "From there, a thin cable runs to every house.",
    "You drill one small hole in the wall and bring the fibre inside.",
    "It plugs into a little box that turns light into internet.",
    "Then into your router, which shares it around your home.",
    "Light races down the glass at two hundred thousand kilometres a second.",
    "So a whole film downloads in seconds.",
    "Congratulations! You just built fibre broadband.",
    "Follow to build the next one.",
  ] },
  { key: "satellite", title: "How You Build Internet From Space", lines: [
    "This is how you get internet in the middle of nowhere, from space.",
    "You build a satellite the size of a table, with solar panels for wings.",
    "You stack dozens of them inside the nose of a rocket.",
    "Three, two, one. The rocket blasts them into space.",
    "High above the Earth, the nose opens and the satellites float out.",
    "Each one races around the planet every ninety minutes.",
    "You launch thousands more, until they cover the whole planet.",
    "Down on the ground, you put a small dish on your roof.",
    "The dish talks to whichever satellite is flying over.",
    "The satellite beams your message down to a station connected to the internet.",
    "And the answer comes back the same way, in a fraction of a second.",
    "Now a farm in the middle of nowhere can video call the world.",
    "Congratulations! You just built internet from space.",
    "Follow to build the next one.",
  ] },
  { key: "phone", title: "How You Build the Phone in Your Hand", lines: [
    "This is how you build the phone in your hand.",
    "You start with a frame cut from one solid block of aluminium.",
    "Into it goes the main board, packed with tiny chips.",
    "The brain is one chip with billions of switches, smaller than your fingernail.",
    "Next to it, memory chips that keep your photos and apps.",
    "Then the battery, the biggest part of all.",
    "You add tiny cameras, each with its own stack of lenses.",
    "Then speakers, a microphone, and antennas so it can talk to phone masts.",
    "Now you glue on a screen made of millions of tiny lights.",
    "On top goes a sheet of toughened glass.",
    "You press the button, and it all wakes up.",
    "Congratulations! You just built a smartphone.",
    "Follow to build the next one.",
  ] },
  { key: "chip", title: "How You Turn Sand Into a Computer Chip", lines: [
    "This is how you turn sand into the chip inside your phone.",
    "You start with ordinary sand, full of a material called silicon.",
    "You melt it, and clean it until it is almost perfectly pure.",
    "Then you slowly pull out one giant crystal, as tall as a person.",
    "You slice it into round wafers, thinner than a fingernail.",
    "Now the clever part: you shine light through a pattern to print tiny switches.",
    "Each switch is thousands of times thinner than a human hair.",
    "You stack dozens of layers, wiring billions of switches together.",
    "Then you cut the wafer into hundreds of separate chips.",
    "You test every single one, and keep only the ones that work.",
    "Each good chip goes into a tough case with tiny gold contacts.",
    "Then into your phone, where it thinks billions of times a second.",
    "Congratulations! You just turned sand into a computer chip.",
    "Follow to build the next one.",
  ] },
  { key: "wifi", title: "How Wi-Fi Gets Internet to Every Room", lines: [
    "This is how Wi-Fi gets the internet into every corner of your home.",
    "The internet comes into your house on one single cable.",
    "It plugs into your router, which is really a tiny radio station.",
    "The router turns the data into invisible radio waves.",
    "The waves fill the room, and even pass through walls.",
    "Your phone, your laptop and your TV all listen at the same time.",
    "Each one only picks up the messages addressed to it.",
    "But thick walls and floors make the signal weaker upstairs.",
    "So you add a second little router on the landing.",
    "The two talk to each other, and now the whole house is covered.",
    "You can stream a film in bed while someone games downstairs.",
    "Congratulations! You just built your home Wi-Fi.",
    "Follow to build the next one.",
  ] },
  { key: "website", title: "What Really Happens When You Tap a Link", lines: [
    "This is what really happens in the second after you tap a link.",
    "Your phone asks: where does this website actually live?",
    "A giant address book for the internet answers with a number, like a phone number for websites.",
    "Your request leaves as tiny packets of data.",
    "They hop from router to router, across cities and under oceans.",
    "Each router sends them down the fastest road, like a satnav.",
    "They reach a server in a data centre, where the website lives.",
    "The server grabs the page: the words, the pictures and the code.",
    "It sends them back, chopped into packets again.",
    "Your phone puts every piece back in the right order.",
    "And builds the page you see, block by block.",
    "All of that, in less than one second.",
    "Congratulations! Now you know how a website reaches your screen.",
    "Follow to build the next one.",
  ] },
]

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
// the world built the fewest times (and longest ago) comes next; `avoid` is never chosen when there's another
export async function leastUsedWorld(avoid = []) {
  const uses = Object.fromEntries((await q("select script->>'world' as w, count(*)::int as n, max(created_at) as last from yt_scripts where kind = 'story' and script->>'format' = 'build' group by 1")).rows.map((r) => [r.w, r]))
  const pool = WORLDS.filter((w) => !avoid.includes(w.key)), list = pool.length ? pool : WORLDS
  return [...list].sort((a, b) => ((uses[a.key] || {}).n || 0) - ((uses[b.key] || {}).n || 0) || +new Date((uses[a.key] || {}).last || 0) - +new Date((uses[b.key] || {}).last || 0) || WORLDS.indexOf(a) - WORLDS.indexOf(b))[0]
}
const LINKS = { website: 'Olexweb builds websites that load in a blink, anywhere in the world: https://olexweb.com/services', datacentre: 'Your website lives in a place like this. Olexweb builds fast ones: https://olexweb.com/services' }
export async function writeExplain({ format, world: worldKey } = {}) {
  const used = (await q("select script->>'world' as w, script->>'biz' as b from yt_scripts where kind = 'story' and script->>'mode' = 'explain'")).rows
  const world = WORLDS.find((w) => w.key === worldKey) || await leastUsedWorld()
  const fmt = format || 'build'                                          // Install 33: Poor vs Rich only when asked by name
  const mode = (await one('select yt_mode as mode from yt_settings where id = 1').catch(() => null))?.mode || 'approval'
  const status = mode === 'autopilot' ? 'approved' : 'draft'
  let script, pkg, label
  if (fmt === 'build') {
    const w = world || WORLDS[0]
    script = { mode: 'explain', format: 'build', world: w.key, three: true, voice: 'am_michael', speed: 1.12, scenes: w.lines.map((t, k) => ({ id: 's' + (k + 1), type: 'explain-build', pose: 'calm', text: t })) }   // the 3D world lives in the factory
    pkg = { title: w.title, titleLines: null, description: `${w.title}, step by step, in 3D.\n\n${LINKS[w.key] || 'New tech explained every day, and the newest tools: https://olexweb.com/tools'}\n\n#shorts #howitworks #tech #internet #3d`, hashtags: ['howitworks', 'tech', 'internet', 'explained', '3d', 'shorts'] }
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
  if (sc.format === 'chain') return sc.scene ? { ...base, scene: sc.scene } : { ...base, chain: sc.chain }   // Install 36: the realistic 3D scene
  return { ...base, titleLines: sc.titleLines, biz: sc.business, beats: sc.beats }
}
