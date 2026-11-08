// The long video as a real story (Install 22, long_style 'tale'). No more "a website saves each chapter": one continuous
// story with a cast, places, a cold open, chapters that end on cliffhangers, a twist, and an ending that pays off.
// Genres take turns: a scam thriller, a hustle/comeback story, a mystery. Settings take turns: the UK and the US.
// A scam story is built on one of our real, checked safety alerts: its warning signs (the lesson at the end) are copied
// from that alert by code, never invented. Everything else is clearly fiction: no real people, no real companies.
// It is saved as kind 'saga' (the same factory, upload and chapters path), with script.mode = 'tale'.
import 'server-only'
import { q, one } from '@/lib/admin/db'
import { askJSON, writtenBy } from '@/lib/assistant/llm'
import { notify } from '@/lib/assistant/notify'
import { linesOf } from './story'

export const GENRES = {
  scam: { name: 'Scam thriller', music: 'tense', brief: 'An ordinary person is targeted by a convincing scam or hack and comes close to losing everything. The pressure builds; they almost fall for it; a twist; then they (or someone close to them) spot the signs just in time, or learn the hard way and fight back. The scam works exactly like the real alert below.' },
  hustle: { name: 'Hustle and comeback', music: 'hope', brief: 'A young person starts with almost nothing and builds something online (a small business, a side hustle, a skill people pay for). Doubters, a setback, a betrayal or big loss in the middle, then a smart comeback and a real, believable win. Grounded: no get-rich-quick promises, no fake numbers presented as fact.' },
  mystery: { name: 'Mystery', music: 'mystery', brief: 'Something strange happens with technology (a login from somewhere they have never been, money moving, messages they never sent, a stranger who knows too much). They investigate step by step: clues, a wrong suspect, then the real answer, which is logical and satisfying.' },
}
export const GENRE_ORDER = ['scam', 'hustle', 'mystery']
export const CITIES = { GB: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Bristol'], US: ['New York', 'Chicago', 'Atlanta', 'Houston', 'Los Angeles', 'Philadelphia'] }
export const PLACES = ['home', 'kitchen', 'bedroom', 'office', 'cafe', 'street', 'bus', 'car', 'shop', 'bank', 'park']
export const SHOTS = ['wide', 'two', 'close', 'phone', 'screen']
export const TALE_EMOTIONS = ['calm', 'happy', 'excited', 'curious', 'focus', 'smug', 'worried', 'scared', 'shock', 'panic', 'angry', 'sad', 'cry']
const LOOK = { sex: ['f', 'm'], age: ['young', 'adult', 'older'], hair: ['short', 'long', 'curly', 'bun', 'bald', 'afro'], skin: ['light', 'tan', 'brown', 'dark'], top: ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'grey', 'black'] }
// real companies and banks are never in a story (it's fiction, and a scam story must never point at a real brand)
const BRANDS = /\b(amazon|paypal|google|apple|iphone|facebook|meta|whatsapp|instagram|tiktok|snapchat|twitter|microsoft|netflix|uber|ebay|barclays|hsbc|lloyds|natwest|santander|monzo|revolut|halifax|nationwide|chase|wells fargo|bank of america|citibank|capital one|venmo|zelle|cash ?app|coinbase|binance|royal mail|usps|fedex|dhl|ups|hmrc|irs|nhs|walmart|tesco|target)\b/i
const YEAR = /\b(19|20)\d\d\b/
const clean = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n)
const words = (s) => (String(s || '').match(/[A-Za-z0-9'’]+/g) || []).length
const WPS = 2.5

// ---------- whose turn ----------
async function settings() { return one('select long_days, long_style, tale_cursor, yt_mode from yt_settings where id = 1') }
export function turnOf(cursor) { const i = Math.max(0, Number(cursor) || 0); return { genre: GENRE_ORDER[i % GENRE_ORDER.length], country: i % 2 ? 'US' : 'GB', city: CITIES[i % 2 ? 'US' : 'GB'][Math.floor(i / 2) % 6] } }
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'], lagosDay = (t = Date.now()) => DAYS[new Date(t + 3600e3).getUTCDay()]
export async function taleDue() {
  const st = await settings(); if (!st || st.long_style !== 'tale') return false
  if (!String(st.long_days || '').split(',').includes(lagosDay())) return false
  if (await one("select 1 from yt_scripts where kind = 'saga' and created_at > now() - interval '20 hours'")) return false
  if (await one("select 1 from audit_log where action = 'yt_tale_skipped' and at > now() - interval '3 hours'")) return false
  return true
}
// a scam story stands on a real, checked safety alert (the newest one not used yet)
async function alertSource() {
  const r = await one(`select id, slug, name, content from dir_entries where kind = 'alert' and status = 'live' and tale_id is null and published_at > now() - interval '45 days' order by published_at desc limit 1`).catch(() => null)
  if (!r || !r.content) return null
  const c = r.content, tips = [...(c.whatToDo || []), ...(c.points || [])].map((x) => clean(x, 200)).filter(Boolean)
  return { id: r.id, slug: r.slug, title: clean(c.title || r.name, 120), text: clean([c.title, c.summary, ...(c.points || []), c.whyItMatters, ...(c.whatToDo || [])].filter(Boolean).join('. '), 4000), tips }
}

// ---------- the brief ----------
const SYSTEM = `You are a story writer for a YouTube channel of animated stories (a hand-drawn sketch style, like a moving comic). You write gripping, original fiction that people watch to the end: a strong hook, rising tension, characters people care about, cliffhangers, a twist, and a payoff. You write in plain, natural spoken English; lines are short because they are performed out loud.`
const SCHEMA = { type: 'object', properties: {
  titles: { type: 'array', items: { type: 'string' } }, thumb: { type: 'object', properties: { text: { type: 'string' }, who: { type: 'string' }, emotion: { type: 'string' } } },
  logline: { type: 'string' }, hook: { type: 'string' }, outro: { type: 'string' }, ask: { type: 'string' },
  cast: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, role: { type: 'string' }, sex: { type: 'string' }, age: { type: 'string' }, hair: { type: 'string' }, skin: { type: 'string' }, top: { type: 'string' } } } },
  cold: { type: 'array', items: { type: 'object' } }, jump: { type: 'string' },
  chapters: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, beats: { type: 'array', items: { type: 'object' } } } } },
  lesson: { type: 'object', properties: { line: { type: 'string' }, tips: { type: 'array', items: { type: 'string' } } } } },
  required: ['titles', 'thumb', 'hook', 'outro', 'cast', 'cold', 'chapters'] }
const BEAT = `Each beat: {"place": one of ${PLACES.join('/')}, "shot": one of ${SHOTS.join('/')} ("wide" = the place with everyone in it, "two" = two people face to face, "close" = one face fills the screen, "phone" = a phone screen fills it, "screen" = a laptop screen fills it), "who": the cast ids in the picture (1 to 3), "speaker": a cast id or "narrator", "emotion": one of ${TALE_EMOTIONS.join('/')} (the speaker's feeling), "line": what is said (1 to 22 words), and when the shot is "phone": "phone": {"from": the sender (16 characters max), "text": the message (90 characters max)}; when it is "screen": "screen": [up to 3 short lines on the screen]. Mark the turning point of the story with "twist": true on its beat.`
function brief(turn, alert) {
  const g = GENRES[turn.genre], where = turn.country === 'GB' ? `${turn.city}, England (or the UK)` : `${turn.city}, USA`
  return `Write ONE original ${g.name.toLowerCase()} for a 6 to 8 minute animated YouTube video. Set it in ${where}: ${turn.country === 'GB' ? 'British' : 'American'} names, places, money (${turn.country === 'GB' ? '£' : '$'}) and the way people talk there.
The story: ${g.brief}
${alert ? `THE REAL SCAM IT IS BASED ON (our checked safety alert; the scam in your story works exactly like this, and nothing about it is invented):\n${alert.text}\n` : ''}
Rules that make people watch to the end:
- "cold": the opening, 1 to 3 beats: the most dramatic moment of the whole story, BEFORE we know why (we flash back after it). The very first line grabs attention in under 5 seconds.
- "jump": the flashback label, e.g. "3 DAYS EARLIER" (2 to 3 words).
- "hook": the narrator's line right after the flashback card: 10 to 22 words that make the viewer need to know how it happened. No "welcome to my channel".
- "chapters": 4 to 6 chapters, 10 to 18 beats each, each with a "title" (2 to 5 words, no spoilers). Every chapter except the last ends on a cliffhanger (a shock, a question, a threat). Somewhere past the middle there is a twist ("twist": true). The last chapter pays everything off.
- Mostly dialogue between the characters (the narrator only to move time on or say what someone is thinking; at most a third of the lines). People react; emotions change often.
- Use different places as the story moves (at least 4 of them) and different shots; use "phone" shots for messages and calls that matter.
- ${BEAT}
- Total spoken words: 850 to 1200.
- "cast": 2 to 4 characters, ids "a", "b", "c", "d" ("a" is the main character). Each: name, role (e.g. "the victim's sister"), sex (f or m), age (young, adult or older), hair (${LOOK.hair.join('/')}), skin (${LOOK.skin.join('/')}), top colour (${LOOK.top.join('/')}). A mix of people.
- Fiction only: never a real person, and never a real company, bank, app or brand name (make up names like "Northgate Bank" or "QuickParcel"). Never mention a year.
${alert ? '- "lesson": the narrator\'s closing lesson: "line" (10 to 22 words, how not to fall for this) and "tips": copy 3 warning signs or steps WORD FOR WORD from the real alert above (60 characters max each, shorten by cutting words, never by changing them).\n' : '- "lesson": optional: one line (10 to 22 words) on what the story teaches, and 2 or 3 short tips.\n'}- "outro": the narrator's last line (10 to 22 words): a question for the comments about the story, and to subscribe for the next story.
- "ask": the comment question alone (6 to 14 words, ends with "?").
- "titles": 3 YouTube titles under 70 characters: curiosity and stakes (who, what was at risk), honest about the story, no year, no clickbait lies. One of them may start "She got a text..." style; another may be a question.
- "thumb": the thumbnail: "text" (1 to 3 big words, 16 characters max, e.g. "DON'T REPLY"), "who" (the cast id whose face is on it), "emotion" (shock, scared, panic or angry).
- "logline": one sentence about the story (for the description).
Answer as JSON only.`
}

// ---------- checking it (plain code) ----------
const pick = (v, list, d) => (list.includes(v) ? v : d)
function toBeat(b, ids, ch) {
  const shot = pick(String(b.shot || ''), SHOTS, 'wide'), speaker = b.speaker === 'narrator' || ids.includes(b.speaker) ? b.speaker : 'narrator'
  let who = (Array.isArray(b.who) ? b.who : []).filter((x) => ids.includes(x)).slice(0, 3)
  if (speaker !== 'narrator' && !who.includes(speaker)) who = [speaker, ...who].slice(0, 3)
  if (!who.length) who = [ids[0]]
  const props = {}
  if (shot === 'phone') props.phone = { from: clean(b.phone && b.phone.from, 16) || 'Unknown', text: clean(b.phone && b.phone.text, 90) }
  if (shot === 'screen') props.screen = (Array.isArray(b.screen) ? b.screen : []).slice(0, 3).map((x) => clean(x, 34)).filter(Boolean)
  return { scene: 'line', place: pick(String(b.place || ''), PLACES, 'home'), shot, who, speaker, emotion: pick(String(b.emotion || ''), TALE_EMOTIONS, 'calm'), text: clean(b.line || b.text, 200), props, ...(b.twist ? { twist: true } : {}), ch }
}
const LOOKS = (c, i) => ({ id: ['a', 'b', 'c', 'd'][i], name: clean(c.name, 24) || ['Sam', 'Alex', 'Jo', 'Max'][i], role: clean(c.role, 60), sex: pick(c.sex, LOOK.sex, i % 2 ? 'm' : 'f'), age: pick(c.age, LOOK.age, 'adult'),
  hair: pick(c.hair, LOOK.hair, 'short'), skin: pick(c.skin, LOOK.skin, ['brown', 'light', 'dark', 'tan'][i]), top: pick(c.top, LOOK.top, ['red', 'blue', 'green', 'yellow'][i]) })
export function shape(d, turn, alert) {
  const cast = (Array.isArray(d.cast) ? d.cast : []).slice(0, 4).map(LOOKS), ids = cast.map((c) => c.id)
  const cold = (Array.isArray(d.cold) ? d.cold : []).slice(0, 3).map((b) => ({ ...toBeat(b, ids, -1), scene: 'cold' }))
  const chapters = (Array.isArray(d.chapters) ? d.chapters : []).slice(0, 6).map((c, k) => ({ n: k + 1, title: clean(c.title, 32).replace(YEAR, '').trim() || `Part ${k + 1}`, beats: (Array.isArray(c.beats) ? c.beats : []).slice(0, 22).map((b) => toBeat(b, ids, k)) }))
  // the lesson's tips: for a scam, only words from the real alert (code, not the AI)
  let tips = (d.lesson && Array.isArray(d.lesson.tips) ? d.lesson.tips : []).map((x) => clean(x, 60)).filter(Boolean).slice(0, 3)
  if (alert) {
    const src = alert.text.toLowerCase()
    tips = tips.filter((x) => src.includes(x.toLowerCase().replace(/[.…]+$/, '')))
    for (const t of alert.tips) { if (tips.length >= 3) break; const s = t.length > 60 ? t.slice(0, t.lastIndexOf(' ', 58)).trim() : t; if (!tips.includes(s)) tips.push(s) }
  }
  const lesson = d.lesson && words(d.lesson.line) >= 6 ? { line: clean(d.lesson.line, 200), tips } : tips.length ? { line: 'Here is how to make sure this never happens to you.', tips } : null
  const th = d.thumb || {}
  return { genre: turn.genre, country: turn.country, city: turn.city, cast, cold, jump: clean(d.jump, 24).toUpperCase() || '3 DAYS EARLIER', hook: clean(d.hook, 220), chapters, lesson,
    outro: clean(d.outro, 220) || 'Would you have seen it coming? Tell me in the comments, and subscribe for the next story.', ask: clean(d.ask, 120) || 'Would you have seen it coming?',
    titles: (Array.isArray(d.titles) ? d.titles : []).map((t) => clean(t, 90)).filter((t) => t && !YEAR.test(t) && !BRANDS.test(t)).slice(0, 3),
    thumb: { text: clean(th.text, 16).toUpperCase() || 'WAIT…', who: ids.includes(th.who) ? th.who : ids[0] || 'a', emotion: pick(th.emotion, ['shock', 'scared', 'panic', 'angry'], 'shock') }, logline: clean(d.logline, 300), alert: alert ? { id: alert.id, slug: alert.slug, title: alert.title } : null }
}
export function assemble(T) {
  const beats = [...T.cold, { scene: 'timejump', emotion: 'calm', text: '', props: { label: T.jump.split(' ').length > 2 ? [T.jump.split(' ').slice(0, -1).join(' '), T.jump.split(' ').slice(-1)[0]] : T.jump.split(' '), secs: 1.4 }, ch: -1 },
    { scene: 'intro', speaker: 'narrator', emotion: 'curious', text: T.hook, props: {}, ch: -1 }]
  T.chapters.forEach((c, k) => { beats.push({ scene: 'chapter', emotion: 'calm', text: '', props: { secs: 2.2 }, ch: k }); beats.push(...c.beats) })
  if (T.lesson) beats.push({ scene: 'lesson', speaker: 'narrator', emotion: 'calm', text: T.lesson.line, props: { tips: T.lesson.tips }, ch: T.chapters.length })
  beats.push({ scene: 'outro', speaker: 'narrator', emotion: 'happy', text: T.outro, props: {}, ch: T.chapters.length })
  return beats
}
export const taleSeconds = (beats) => Math.round(beats.reduce((a, b) => a + (b.text ? words(b.text) / WPS + 0.35 : Number((b.props || {}).secs) || 1.2), 0))
export function checkTale(T) {
  const lines = [...T.cold, ...T.chapters.flatMap((c) => c.beats)], all = lines.map((b) => b.text).join(' ')
  const total = words(all) + words(T.hook) + words(T.outro) + (T.lesson ? words(T.lesson.line) : 0), secs = taleSeconds(assemble(T))
  const long = lines.filter((b) => words(b.text) > 24 || words(b.text) < 1)
  const narr = lines.filter((b) => b.speaker === 'narrator').length / Math.max(1, lines.length)
  const places = new Set(lines.map((b) => b.place)).size
  const cliffs = T.chapters.slice(0, -1).filter((c) => { const l = c.beats[c.beats.length - 1]; return l && (/[?!…]|\.\.\.$/.test(l.text) || ['shock', 'scared', 'panic', 'angry', 'worried'].includes(l.emotion)) }).length
  const brand = [all, ...lines.map((b) => [b.props.phone && b.props.phone.from, b.props.phone && b.props.phone.text, ...(b.props.screen || [])].join(' ')), T.hook, T.outro, ...T.titles].find((x) => BRANDS.test(x || ''))
  const checks = [
    { key: 'cast', ok: T.cast.length >= 2, note: `${T.cast.length} characters (2 to 4)` },
    { key: 'hook', ok: T.cold.length >= 1 && words(T.cold[0].text) >= 2 && words(T.hook) >= 8, note: 'it opens on the most dramatic moment, then flashes back' },
    { key: 'chapters', ok: T.chapters.length >= 4 && T.chapters.every((c) => c.beats.length >= 8), note: `${T.chapters.length} chapters (4 to 6, 8+ beats each)` },
    { key: 'cliffhangers', ok: cliffs >= Math.max(1, T.chapters.length - 2), note: `${cliffs} of ${Math.max(0, T.chapters.length - 1)} chapters end on a cliffhanger` },
    { key: 'twist', ok: lines.some((b) => b.twist), note: 'a twist past the middle' },
    { key: 'length', ok: secs >= 300 && secs <= 600 && total >= 700, note: `about ${Math.round(secs / 6) / 10} minutes (${total} words); 5 to 10` },
    { key: 'lines', ok: !long.length, note: long.length ? `${long.length} line(s) too long or empty (22 words max)` : 'every line is one breath' },
    { key: 'dialogue', ok: narr <= 0.45, note: `${Math.round(narr * 100)}% narration (45% at most: mostly the characters talking)` },
    { key: 'places', ok: places >= 3, note: `${places} different places` },
    { key: 'fiction', ok: !brand && !YEAR.test(all), note: brand ? 'a real company or brand is named: ' + (brand.match(BRANDS) || [''])[0] : 'no real companies, no years' },
    { key: 'titles', ok: T.titles.length >= 1, note: `${T.titles.length} title(s)` },
    ...(T.genre === 'scam' ? [{ key: 'lesson', ok: !!(T.lesson && T.lesson.tips.length >= 2), note: 'the warning signs are copied from our real safety alert' }] : []),
  ]
  return { ok: checks.every((c) => c.ok), checks, seconds: secs, words: total }
}
const CRITICAL = ['cast', 'chapters', 'fiction', 'lines', 'length']

// ---------- writing it ----------
export async function writeTale() {
  const st = await settings(), autopilot = st.yt_mode === 'autopilot', turn = turnOf(st.tale_cursor)
  const alert = turn.genre === 'scam' ? await alertSource() : null
  if (turn.genre === 'scam' && !alert) turn.genre = 'mystery'                    // no fresh alert to build on: a mystery instead (never an invented scam)
  let d = null, T = null, res = null, by = null
  for (let attempt = 0; attempt < 2; attempt++) {
    const extra = attempt && res ? `\n\nYOUR LAST STORY failed these checks; write it again and fix every one:\n${res.checks.filter((c) => !c.ok).map((c) => '- ' + c.key + ': ' + c.note).join('\n')}` : ''
    try { d = await askJSON({ system: SYSTEM, prompt: brief(turn, alert) + extra, schema: SCHEMA, temperature: attempt ? 0.7 : 0.9, maxTokens: 12000, kind: 'write' }) } catch { d = null }
    if (!d) continue
    const t2 = shape(d, turn, alert), r2 = checkTale(t2)
    if (!res || r2.checks.filter((c) => c.ok).length > res.checks.filter((c) => c.ok).length) { T = t2; res = r2; by = writtenBy(d) }
    if (res.ok) break
  }
  if (!T || res.checks.some((c) => !c.ok && CRITICAL.includes(c.key))) {
    await q("insert into audit_log (action, detail) values ('yt_tale_skipped', $1)", [JSON.stringify({ genre: turn.genre, failed: res ? res.checks.filter((c) => !c.ok).map((c) => c.key) : ['no answer'] })])
    await notify('ideas', 'Today’s long story didn’t come together (it failed its checks). It tries again in a few hours.', '/admin/youtube?view=scripts')
    throw new Error('The story didn’t pass its checks this time. It will try again later today.')
  }
  const beats = assemble(T), secs = res.seconds
  const status = res.ok ? (autopilot ? 'approved' : 'draft') : autopilot ? 'approved' : 'needs_review'
  const title = (T.titles[0] || T.logline || 'A story').slice(0, 100)
  const desc = `${T.logline || ''}\n\nA fictional story, animated. Names, people and companies are made up.${T.alert ? `\n\nBased on a real scam. How to spot it: https://olexweb.com/alerts/${T.alert.slug}` : ''}\n\n${T.ask}`.trim()
  const pk = { title, titles: T.titles.length ? T.titles : [title], description: desc, hashtags: ['#story', '#animation', T.genre === 'scam' ? '#scam' : T.genre === 'mystery' ? '#mystery' : '#motivation'], thumb: T.thumb }
  const script = { mode: 'tale', genre: T.genre, country: T.country, city: T.city, cast: T.cast, thumb: T.thumb, voice: 'story-B', music: GENRES[T.genre].music,
    chapters: T.chapters.map((c) => ({ n: c.n, title: c.title })), lesson: T.lesson, alert: T.alert, story: { beats },
    scenes: linesOf(beats).map((x, i) => { const b = beats[i], who = b.speaker === 'narrator' ? 'Narrator' : (T.cast.find((c) => c.id === b.speaker) || {}).name; return who && b.text ? { ...x, text: who + ': ' + b.text } : x }) }
  const row = await one(`insert into yt_scripts (idea_id, kind, status, script, package, claims, checks, seconds, page, writer, items, approved_at)
      values (null, 'saga', $1, $2, $3, '[]', $4, $5, $6, $7, '[]', case when $1 = 'approved' then now() end) returning id, status`,
    [status, JSON.stringify(script), JSON.stringify(pk), JSON.stringify(res.checks), secs, T.alert ? T.alert.title : null, by])
  if (T.alert) await q('update dir_entries set tale_id = $2 where id = $1', [T.alert.id, row.id])
  await q('update yt_settings set tale_cursor = tale_cursor + 1 where id = 1')
  await notify('ideas', status === 'needs_review' ? `Today’s long story needs your eye: “${title}” (${GENRES[T.genre].name}, about ${Math.round(secs / 60)} minutes).`
    : `Today’s long story is written: “${title}” (${GENRES[T.genre].name}, ${T.chapters.length} chapters, about ${Math.round(secs / 60)} minutes).`, '/admin/youtube?view=scripts')
  return { ...row, genre: T.genre, chapters: T.chapters.length, seconds: secs, title }
}
