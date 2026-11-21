// Install 42: LinkedIn, written for LinkedIn. One post each weekday morning on your own profile, from that day's best
// material (the newest "You build it" video, or the newest article), rewritten the way LinkedIn rewards: a two-line hook
// that earns "see more", short lines, one clear lesson for business owners, a question that invites comments, 3 hashtags,
// the picture, and NO link in the post (links cut reach): the link goes in the first comment, posted by itself.
// Needs LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET (an app with "Sign In with LinkedIn using OpenID Connect" and
// "Share on LinkedIn"). LinkedIn's sign-in lasts about 60 days: you're reminded a week before, and it pauses itself when it ends.
import 'server-only'
import { q, one } from '@/lib/admin/db'
import { encrypt, decrypt, token as randomToken, sha256 } from '@/lib/admin/crypto'
import { askJSON } from '@/lib/assistant/llm'
import { lessonsFor } from '@/lib/assistant/memory'
import { notify } from '@/lib/assistant/notify'
import { cardKey, slidesToPdf } from './licard'
import { specialDay } from './lidays'
export const LI_REDIRECT = '/admin/api/linkedin/callback'
export const liReady = () => !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET)
const AUTH = () => process.env.LI_AUTH_BASE || 'https://www.linkedin.com/oauth/v2', API = () => process.env.LI_API_BASE || 'https://api.linkedin.com'
const SITE = () => (process.env.YT_SITE_ORIGIN || 'https://olexweb.com').replace(/\/$/, '')
// LinkedIn's API is versioned by month and each version lives about a year: use the one from two months ago
const version = (back = 2) => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - back); return d.getUTCFullYear() + String(d.getUTCMonth() + 1).padStart(2, '0') }
class LiError extends Error { constructor(m, status) { super(m); this.status = status } }
async function li(path, { method = 'GET', body, token, raw } = {}) {
  for (let back = 2; back <= 4; back++) {
    const r = await fetch(API() + path, { method, headers: { Authorization: 'Bearer ' + token, 'LinkedIn-Version': version(back), 'X-Restli-Protocol-Version': '2.0.0', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) })
    if (r.ok) return raw ? r : (r.status === 201 || r.status === 204 ? { id: r.headers.get('x-restli-id') || r.headers.get('x-linkedin-id') } : r.json())
    const t = await r.text().catch(() => '')
    if (r.status === 426 || /version/i.test(t) && r.status === 400) continue   // that month's version is gone: try an older one
    throw new LiError('LinkedIn answered ' + r.status + ': ' + t.slice(0, 200), r.status)
  }
  throw new LiError('LinkedIn refused every API version.', 426)
}

// ---------- connecting (owner only) ----------
export async function liConnectUrl(origin, userId) {
  if (!liReady()) throw new LiError('Add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in Vercel first.')
  const state = randomToken(24)
  await q("delete from li_oauth_states where created_at < now() - interval '1 day'")
  await q('insert into li_oauth_states (state_hash, user_id) values ($1, $2)', [sha256(state), String(userId)])
  const p = new URLSearchParams({ response_type: 'code', client_id: process.env.LINKEDIN_CLIENT_ID, redirect_uri: origin + LI_REDIRECT, state, scope: 'openid profile w_member_social' })
  return { url: AUTH() + '/authorization?' + p.toString(), state }
}
export async function liFinishConnect(origin, code, state) {
  const s = await one("delete from li_oauth_states where state_hash = $1 and created_at > now() - interval '15 minutes' returning user_id", [sha256(String(state || ''))])
  if (!s) return { ok: false, why: 'expired' }
  if (!(await one("select 1 from admin_users where id::text = $1 and role = 'owner'", [s.user_id]))) return { ok: false, why: 'expired' }
  const r = await fetch(AUTH() + '/accessToken', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code: String(code || ''), redirect_uri: origin + LI_REDIRECT, client_id: process.env.LINKEDIN_CLIENT_ID, client_secret: process.env.LINKEDIN_CLIENT_SECRET }), signal: AbortSignal.timeout(20000) })
  const t = await r.json().catch(() => ({})); if (!r.ok || !t.access_token) return { ok: false, why: 'failed' }
  const me = await fetch(API() + '/v2/userinfo', { headers: { Authorization: 'Bearer ' + t.access_token }, signal: AbortSignal.timeout(20000) }).then((x) => x.json()).catch(() => ({}))
  if (!me.sub) return { ok: false, why: 'failed' }
  await q(`update li_settings set token_enc = $1, expires_at = now() + make_interval(secs => $2), person_urn = $3, name = $4, connected_at = now(), paused_reason = null, warned_at = null, enabled = true where id = 1`,
    [encrypt(t.access_token), Number(t.expires_in) || 5184000, 'urn:li:person:' + me.sub, String(me.name || 'You').slice(0, 120)])
  return { ok: true }
}
export async function liDisconnect() { await q('update li_settings set token_enc = null, expires_at = null, person_urn = null, connected_at = null, enabled = false where id = 1'); return { ok: true } }
export async function liSetEnabled(on) { await q('update li_settings set enabled = $1, paused_reason = case when $1 then null else paused_reason end where id = 1', [on === true]); return { ok: true } }

// ---------- what to post: the newest video or article not yet on LinkedIn (videos and articles take turns) ----------
async function nextMaterial() {
  const video = await one(`select s.yt_video_id as ref, coalesce(s.package->>'title', '') as title, s.script->>'topic' as topic, s.script->>'answer' as answer,
      (select string_agg(x->>'line', ' ') from jsonb_array_elements(coalesce(s.script->'scene'->'steps', '[]'::jsonb)) x) as lines
    from yt_scripts s where s.status = 'uploaded' and s.yt_video_id is not null and s.uploaded_at > now() - interval '10 days'
      and not exists (select 1 from li_posts p where p.ref = s.yt_video_id) order by s.uploaded_at desc limit 1`).catch(() => null)
  const article = await one(`select p.slug as ref, p.title, p.summary, (select left(string_agg(b->>'text', ' '), 3500) from jsonb_array_elements(case when jsonb_typeof(p.body) = 'array' then p.body else '[]'::jsonb end) b) as body
    from posts p where p.status = 'live' and p.published_on > current_date - 21 and not exists (select 1 from li_posts l where l.ref = p.slug)
    order by p.published_on desc, p.id desc limit 1`).catch(() => null)
  const last = await one("select kind from li_posts where status = 'posted' order by posted_at desc limit 1").catch(() => null)
  const order = last && last.kind === 'video' ? [article && { kind: 'article', ...article }, video && { kind: 'video', ...video }] : [video && { kind: 'video', ...video }, article && { kind: 'article', ...article }]
  return order.find(Boolean) || null
}
// Install 43: it writes as YOU. Your own past posts (pasted on the LinkedIn page) are the voice; your notes (real things that
// happened: a client, a bug, a win, a lesson) are the stories, and it never invents a client, a number or an event you
// didn't give it. Every post is a different kind from the last ones, part of your 100-day series, and aimed at one job:
// connect, show what you do, or bring a lead, naturally. The first post (you're back, and the series starts) waits for your OK.
export const FORMATS = [   // Install 46: you, as a creator, thinker and builder (websites and automation go to the Olexweb page)
  ['story', 'A real moment from the note: what happened, what you thought, what you did, what it taught you. Needs a note.', true],
  ['creator', 'Being a creator, not just a user: what it costs, what it gives, and how someone starts, in any field.', false],
  ['ideas', 'Managing ideas: catching them, testing them, killing the weak ones, finishing the right one.', false],
  ['thinking', 'One of the four ways of thinking (creative, critical, logical, intuitive), or how they work together, with a real situation where it mattered.', false],
  ['solitude', 'Solitude and stillness: time alone to think, boredom, silence, and what comes out of it.', false],
  ['learning', 'Learning deeply instead of fast: understanding why, not just how, and how deep understanding pays over years.', false],
  ['reading', 'Reading: a way of borrowing other people’s years of thinking; what reading does to how you build and decide.', false],
  ['philosophy', 'A philosophy of creation: why people make things, what a creation says about its maker, ownership versus dependence.', false],
  ['growth', 'Personal growth and discipline: becoming the kind of person who builds, habits, patience, doubt.', false],
  ['journey', 'The real journey of building: a stretch of the road from idea to product, honest, not a success story. You may mention your building and development work.', false],
  ['lesson', 'A hard lesson from building and creating, and what you do differently now. You may mention your building and development work.', false],
]
const CAROUSEL = new Set(['thinking', 'ideas', 'learning', 'journey', 'creator'])
const CARD = `Also write "card": the words on the post's picture: {"title": the one line people should remember, max 70 characters, about THEIR life or the moment, never "I build…"; "kicker": 1 to 3 words, like CREATOR NOTES, ON IDEAS, THINKING, SOLITUDE, DEEP LEARNING, THE JOURNEY; "points": 0 to 5 short lines, max 60 characters each (for a list, the items; for a contrast, [the common belief, the truth]; for a journey, the stages in order; otherwise [the one-line takeaway])}.`
const PHOTOS = (list) => `You may use ONE of Olaitan's own photos with this post if one truly fits it (otherwise the post gets a designed picture). His photos:\n${list.map((p) => `${p.id}: ${p.mood}. ${p.what}`).join('\n')}\nAlso answer "tone": serious, thoughtful or light (the feeling of your post), and "photo": the number of a photo that fits that feeling, or 0. Never a smiling or laughing photo for a serious post.`
const SLIDES = `This post is a CAROUSEL (people swipe through it). Also write "slides": 5 to 7 slides [{"title": max 55 characters, "body": max 150 characters}]: slide 1 is the hook that makes people swipe; each slide one idea in everyday words; the last slide sums it up in one line. Write them so people want the next one.`
const VOICE = (v) => v && v.trim().length > 80 ? `\n\nHOW OLAITAN WRITES (his own past posts; match his voice, rhythm, words and warmth, not the topics):\n"""\n${v.slice(0, 6000)}\n"""` : ''
const SYSTEM = `You are Olaitan Adebayo, writing your own LinkedIn post. You are a creative ideator, builder and developer from Nigeria, founder of Olexweb ("Creating digital possibilities"). You've built websites, apps, automation and AI systems for businesses, and your own products, like your own meeting platform. Creating digital things is your part of creation, but your message is about creation in every field.

WHAT YOU BELIEVE (your worldview; every post comes from here):
- Coming into the world as a user and leaving the same way is the quiet loss most people never notice. Being only a user doesn't pay: not personally, not in business, not for a nation.
- Users are at the mercy of creators. Big tech companies feed on people's behaviour; that data has become so valuable it's used to predict what people will do, and what can be predicted can be steered. When you only use, you're part of someone else's product.
- Africa has the resources and the talent, yet so much value leaves because we mostly use instead of create: raw materials go out, finished products come back at a price. Talent without creation can still end in failure.
- Creation in any field (a tailor designing her own patterns, a cook making her own dish, a teacher building his own way of explaining, a farmer, a writer, a founder) comes from the same roots: managing ideas, deep thinking (creative, critical, logical, intuitive), reasoning things through, reading, personal growth, and solitude. Many great inventors withdrew to think before they could create properly.
- Learning deeply pays; learning only enough to use something keeps you a user.
Your goal isn't content. It's helping people see what they're missing as users, and take one step towards creating.

HOW YOU WRITE (sound like a real man talking, not a writer or a brand):
- Start with a real moment, a small story or an honest thought, then widen it to everyday life and other fields, then to the bigger picture when it fits (business, Africa, the world).
- Plain words, contractions (I'm, don't, it's), short and long sentences mixed, paragraphs of 1 to 4 sentences. Some honest doubt. Your own opinion, owned.
- Your own building (websites, apps, your meeting platform, Olexweb) comes in now and then as proof, never as an advert.
- 900 to 1600 characters: long enough to enjoy reading, never padded.
- End with one real question people can answer from their own life, or a quiet last line.
NEVER WRITE LIKE AI: no em dashes, no "It's not X, it's Y" lines, no "Here's the thing", "The truth is", "Let that sink in", "In a world where", "game-changer", "unlock", "level up", "hustle", no lists of three adjectives, no motivational-poster lines, no emojis, no stacked questions at the end, no summary at the end.
FACTS: share ordinary experiences honestly. Never invent a named person or company you dealt with, a specific number or result, or a dramatic event (specifics only come from a note). Facts about history, inventors, companies or Africa must be well known and correct; if unsure, leave the detail out.
This is your personal page: no website tips, marketing tips, social media tips or tech how-tos.

YOUR TONE (approved by you; tone only, never reuse these words or ideas):
"For years I thought that made me creative. Lots of ideas, always thinking, always starting something. It felt like progress. It wasn't. Most of those ideas never left my notes. Some I started and dropped halfway, usually right when it got boring or hard, which turns out to be the exact moment it starts to matter."
"The difference between a user and a creator isn't talent. It's what you do with the annoyance. One person complains and adjusts. The other person asks, what would this look like if I made it?"

FACTS ABOUT YOU: Olaitan Adebayo (also Adebayo Olaitan), Nigerian, creative ideator, builder and developer, founder and owner of Olexweb (olexweb.com), tagline "Creating digital possibilities".`
function brief({ kind, day, series, format, note, carousel, said = [], photos = [], styles = [], special = null }) {
  const f = FORMATS.find((x) => x[0] === format) || FORMATS[1]
  const SAID = said.length ? `\nALREADY SAID (never repeat these ideas, titles or angles; find something new):\n- ${said.join('\n- ')}\n` : ''
  if (kind === 'intro') return `Write your FIRST LinkedIn post after being away for a while. You're back: say it simply and honestly (don't invent why you were away: keep it general, like "heads down building"). Say simply that you've been heads down building (websites for businesses, systems that run while their owners sleep, even your own meeting platform because you got tired of depending on someone else's). Share the thought that kept coming back: most of life we use what others made, in every field, and there's a moment when you think "I could make this better"; most people let it pass. Give two or three everyday examples from other fields (a tailor, a teacher, a cook). Be honest that you don't have it all figured out. Announce the series: 100 days of "${series}": every weekday, honest thoughts on creating, ideas, thinking deeply, learning, solitude and the real journey of building. Invite people to follow along, and ask one question that makes them comment (what they want you to cover). ${note ? `Use this real note if it fits: "${note}".` : ''}
Rules: lines 1 and 2 are the hook (under 200 characters together). Short paragraphs, an empty line between them. 800 to 1400 characters. 3 hashtags on the last line, one of them #100DaysOfBuilding. No links (the link goes in the first comment).
Also write "comment": the first comment, one short line inviting people to see your work, ending with exactly {LINK}.
${CARD}
Answer as JSON: {"text","comment","card"}`
  const DAY = special ? `\nA SPECIAL DAY: ${special.when} is ${special.name}. Make this post about it, celebrating or marking it in a way only you would: honest, warm, never a generic greeting card, and tied naturally to what you believe (creating, not only using). Mention the day clearly in the first lines.` : ''
  return `Write Day ${day} of your 100-day LinkedIn series "${series}". ${special ? '' : `Today's angle (a starting point, not a cage): ${f[1]}`}${DAY}${SAID}
STYLE: choose any form a great writer would choose for this idea, the one that makes it land hardest: a full story with real scenes and dialogue, a letter, a conversation, the story behind an invention told like a story, a diary entry written in the moment, a confession, a thought experiment, then and now, a set of reflections, a big-picture essay, a parable, an open question with your own answer, or any other form. Don't use the same form as your recent posts${styles.length ? ` (recent: ${styles.join(', ')})` : ''}, and vary how you end.
${note ? `A REAL NOTE from you (the true story to build on; keep its facts exactly): "${note}"` : 'No note today: you can use an ordinary builder experience in general terms (no names, no numbers).'}
How to write it:
- Put "Day ${day}/100" naturally in line 1 or as the last line before the hashtags.
- Lines 1 and 2 are the hook (under 200 characters together): a surprising truth, a bold line, or the first moment of the story. Never start with "I'm excited", "In today's", or a question.
- 1300 to 2800 characters: long enough to be enjoyed and felt, never padded. Paragraphs of 1 to 4 sentences, empty lines between.
- One idea only, in everyday words. Make anyone who wants to create something (in any field) stop and think.
- End in a way that fits the form: a real question, a quiet line, a challenge, or an open thought.
- 3 hashtags on the last line, one of them #100DaysOfBuilding.
- No links or URLs in the post.
Also write "comment": the first comment, one short human line that adds something and invites a click, ending with exactly {LINK}.
Also write "style": the form you chose, in 1 to 3 words.
${CARD}
${carousel ? SLIDES : ''}${photos.length ? '\n' + PHOTOS(photos) : ''}
Answer as JSON: {"text","comment","card"${carousel ? ',"slides"' : ''}${photos.length ? ',"tone","photo"' : ''}}`
}
const words2 = (t) => new Set(String(t || '').toLowerCase().match(/[a-z']{4,}/g) || [])
export function tooClose(a, b) { const A = words2(a), B = words2(b); if (!A.size || !B.size) return false; let n = 0; for (const w of A) if (B.has(w)) n++; return n / Math.min(A.size, B.size) > 0.55 }
export function checkPost(t, c) {
  const lines = String(t || '').split('\n').filter((x) => x.trim()), hook = lines.slice(0, 2).join(' ')
  const tags = (String(t).match(/#[A-Za-z]\w+/g) || []).length, emojis = (String(t).match(/\p{Extended_Pictographic}/gu) || []).length
  const out = []
  if (t.length < 1100 || t.length > 2950) out.push(`length ${t.length} (1300 to 2800)`)
  if (hook.length > 220) out.push('the hook (lines 1 and 2) is over 200 characters')
  if (/https?:\/\/|www\.|\.com\b/i.test(t)) out.push('a link is in the post (it goes in the comment)')
  if (tags < 2 || tags > 5) out.push(`${tags} hashtags (3)`)
  if (emojis > 2) out.push('too many emojis')
  if (/game[- ]changer|fast-paced world|let's dive|unlock the|as an ai|here's the thing/i.test(t)) out.push('a cliché')
  if (!/\{LINK\}/.test(c || '')) out.push('the comment has no {LINK}')
  // Install 47: what makes a post sound like a machine
  if (/—/.test(t)) out.push('em dashes (—): write it like you talk, with full stops or commas')
  if (/\b(here'?s the thing|let that sink in|the truth is|in a world where|level up|hustle|unlock(ing)?|game[- ]changer)\b/i.test(t)) out.push('an AI-sounding phrase')
  if ((t.match(/\b(it'?s|this is|that'?s) not (just )?[^.?!\n]{1,40}[,.;]\s*(it'?s|this is|that'?s)\b/gi) || []).length) out.push('an "it’s not X, it’s Y" line')
  const paras = String(t).split(/\n\s*\n/).filter((x) => x.trim()), single = paras.filter((x) => (x.match(/[.?!](\s|$)/g) || []).length <= 1).length
  if (paras.length >= 6 && single / paras.length > 0.75) out.push('every paragraph is one short line: mix in some longer ones, like real speech')
  if (!/\b(I'm|I've|I'd|I'll|don't|can't|it's|that's|didn't|wasn't|won't|isn't)\b/i.test(t)) out.push('no contractions (say I’m, don’t, it’s, like you talk)')
  return out
}
async function writePost(o, voice) {
  const learned = await lessonsFor('LinkedIn post hook creator thinking').catch(() => '')
  // Install 46: never the same thing twice: what was already said goes into the brief, and drafts too close to it are refused
  const said = (await q("select coalesce(card->>'title', '') as t, split_part(text, E'\n', 1) as h, text from li_posts where status in ('posted', 'ready', 'waiting') order by id desc limit 60").catch(() => ({ rows: [] }))).rows
  o.said = said.map((r) => r.t || r.h).filter(Boolean).slice(0, 40)
  let best = null
  for (let a = 0; a < 3; a++) {
    const d = await askJSON({ system: SYSTEM + VOICE(voice) + (learned || ''), prompt: brief(o) + (best ? `\n\nYOUR LAST ONE broke these rules; fix them: ${best.bad.join('; ')}` : ''), schema: { type: 'object', properties: { text: { type: 'string' }, comment: { type: 'string' }, card: { type: 'object' }, slides: { type: 'array', items: { type: 'object' } }, tone: { type: 'string' }, photo: { type: 'number' }, style: { type: 'string' } }, required: ['text', 'comment', 'card'] }, temperature: 0.95, kind: 'write' }).catch(() => null)
    if (!d) continue
    const text = String(d.text || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 2900), comment = String(d.comment || '').trim().slice(0, 600), card = cleanCard(d.card), bad = checkPost(text, comment)
    if (o.carousel) { card.slides = (Array.isArray(d.slides) ? d.slides : []).map((x) => ({ title: naira((x && x.title) || '').replace(/https?:\/\/\S+/g, '').trim().slice(0, 70), body: naira((x && x.body) || '').replace(/https?:\/\/\S+/g, '').trim().slice(0, 180) })).filter((x) => x.title).slice(0, 8); if (card.slides.length < 4) bad.push('the carousel needs 5 to 7 slides') }
    if (/\b(server|deploy|api|framework|data cent(re|er)|backend|frontend|database|codebase)\b/i.test(text)) bad.push('tech talk (write it in everyday words)')
    if (said.some((r) => tooClose(r.text, text) || (card.title && r.t && tooClose(r.t, card.title)))) bad.push('too close to something you already posted: find a new idea')
    if (!card.title) bad.push('the picture has no title')
    const ph = (o.photos || []).find((x) => x.id === Number(d.photo)), serious = /serious|thoughtful/i.test(String(d.tone || ''))
    card.photo = ph && !(serious && /smil|laugh/i.test(ph.mood || '')) ? ph.id : null   // Install 48: never a smiling photo on a serious post
    card.style = String(d.style || '').toLowerCase().slice(0, 30)
    if (!best || bad.length < best.bad.length) best = { text, comment, card, bad }
    if (!bad.length) break
  }
  if (!best || best.bad.some((b) => /link is in|length|hook|picture|carousel|too close/.test(b))) throw new Error('The LinkedIn post didn’t pass its checks' + (best ? ' (' + best.bad.join(', ') + ')' : '') + '. It tries again later.')
  return best
}
const naira = (t) => String(t || '').replace(/₦\s?/g, 'N')   // the picture's font has no ₦ sign
const cleanCard = (c) => ({ title: naira((c && c.title) || '').replace(/https?:\/\/\S+/g, '').trim().slice(0, 110), kicker: String((c && c.kicker) || '').slice(0, 28), points: (Array.isArray(c && c.points) ? c.points : []).map((x) => naira(x).replace(/https?:\/\/\S+/g, '').trim().slice(0, 80)).filter(Boolean).slice(0, 5) })
// the next weekday 08:10 (Lagos) from now
function nextSlot(s, from = Date.now()) {
  const days = String(s.days || '1,2,3,4,5').split(','), [hh, mm] = String(s.post_time || '08:10').split(':').map(Number)
  for (let k = 0; k < 8; k++) { const d = new Date(from + k * 864e5 + 3600e3); d.setUTCHours(hh, mm, 0, 0); const t = d.getTime() - 3600e3; if (t > from + 5 * 60e3 && days.includes(String(new Date(t + 3600e3).getUTCDay()))) return new Date(t) }
  return new Date(from + 864e5)
}
// write the next post as a draft you can read and change before it goes out
export async function liDraftNext() {
  const s = await one('select * from li_settings where id = 1')
  if (await one("select 1 from li_posts where status in ('waiting', 'ready')")) return null
  const kind = s.intro_done ? 'day' : 'intro'
  const day = kind === 'intro' ? 0 : ((await one("select count(*)::int n from li_posts where status = 'posted' and kind in ('day', 'video', 'article')")).n + 1)
  if (kind === 'day' && day > 100) return null
  const note = await one('select id, text from li_notes where used_at is null order by created_at limit 1')
  const recent = (await q("select format from li_posts where format is not null order by id desc limit 5")).rows.map((r) => r.format)
  const can = FORMATS.filter(([k, , needsNote]) => (!needsNote || note) && !recent.includes(k))
  // every 5th day is the soft invitation; a note always gets told
  const format = kind === 'intro' ? 'intro' : day % 5 === 0 ? 'offer' : note && can.some((x) => x[0] === 'story') ? 'story' : (can[(day * 7) % Math.max(1, can.length)] || FORMATS[1])[0]
  const carousel = kind === 'day' && CAROUSEL.has(format) && day % 2 === 0   // about twice a week: a carousel people swipe through
  const lastPhoto = await one("select 1 from li_posts where photo_id is not null and coalesce(due_at, posted_at) > now() - interval '3 days'").catch(() => null)
  const photos = !carousel && kind === 'day' && !lastPhoto && day % 2 === 1 ? (await q("select id, coalesce(mood, 'neutral') as mood, coalesce(what, '') as what from li_photos where last_used is null or last_used < now() - interval '10 days' order by used, id limit 10").catch(() => ({ rows: [] }))).rows : []
  const due0 = nextSlot(s), special = kind === 'day' ? specialDay(due0) : null
  const styles = (await q("select distinct card->>'style' as st from (select card from li_posts where card ? 'style' order by id desc limit 6) x").catch(() => ({ rows: [] }))).rows.map((r) => r.st).filter(Boolean)
  const p = await writePost({ kind, day, series: s.series, format, note: note && note.text, carousel: carousel && !special, photos, styles, special }, s.voice)
  const link = format === 'offer' ? `${SITE()}/start` : `${SITE()}/about`
  const due = nextSlot(s)
  await q("insert into li_posts (kind, ref, text, comment, link, format, day, status, due_at, card, photo_id) values ($1, $2, $3, $4, $5, $6, $7, 'ready', $8, $9, $10)",
    [kind, 'day-' + day + '-' + Date.now(), p.text, p.comment, link, format, day, due, JSON.stringify(p.card), p.card.photo || null])
  if (p.card.photo) await q('update li_photos set used = used + 1, last_used = now() where id = $1', [p.card.photo])
  if (note) await q('update li_notes set used_at = now() where id = $1', [note.id])
  await notify('window', kind === 'intro' ? `Your comeback LinkedIn post is written for ${due.toLocaleString('en-GB', { timeZone: 'Africa/Lagos', weekday: 'short', hour: '2-digit', minute: '2-digit' })}. Change it or skip it if you like.` : `LinkedIn Day ${day} is written for ${due.toLocaleString('en-GB', { timeZone: 'Africa/Lagos', weekday: 'short', hour: '2-digit', minute: '2-digit' })}. Change it or skip it if you like.`, '/admin/linkedin').catch(() => {})
  return { drafted: kind, day, format }
}
// ---------- posting ----------
async function uploadCarousel(token, owner, id, n) {
  try {
    const pngs = []
    for (let k = 1; k <= n; k++) { const r = await fetch(`${SITE()}/api/li-card/${id}?k=${cardKey(id)}&s=${k}`, { signal: AbortSignal.timeout(30000) }); if (!r.ok) return null; pngs.push(Buffer.from(await r.arrayBuffer())) }
    const pdf = await slidesToPdf(pngs)
    const init = await li('/rest/documents?action=initializeUpload', { method: 'POST', token, body: { initializeUploadRequest: { owner } } })
    const v = init.value || {}; if (!v.uploadUrl || !v.document) return null
    const put = await fetch(v.uploadUrl, { method: 'PUT', headers: { Authorization: 'Bearer ' + token }, body: pdf, signal: AbortSignal.timeout(90000) })
    return put.ok ? v.document : null
  } catch { return null }
}
async function uploadImage(token, owner, url, given = null) {
  try {
    let bytes = given
    if (!bytes) { const img = await fetch(url, { signal: AbortSignal.timeout(20000) }); if (!img.ok) return null; bytes = Buffer.from(await img.arrayBuffer()) }
    if (bytes.length < 2000) return null
    const init = await li('/rest/images?action=initializeUpload', { method: 'POST', token, body: { initializeUploadRequest: { owner } } })
    const v = init.value || {}; if (!v.uploadUrl || !v.image) return null
    const put = await fetch(v.uploadUrl, { method: 'PUT', headers: { Authorization: 'Bearer ' + token }, body: bytes, signal: AbortSignal.timeout(60000) })
    return put.ok ? v.image : null
  } catch { return null }
}
export async function liPostNow({ force = false, id = null } = {}) {
  const s = await one('select * from li_settings where id = 1')
  if (!liReady() || !s || !s.token_enc) return { skipped: 'LinkedIn isn’t connected' }
  if (!force && (!s.enabled || s.paused_reason)) return { skipped: 'LinkedIn posting is off' }
  if (s.expires_at && new Date(s.expires_at) < Date.now()) { await q("update li_settings set paused_reason = 'LinkedIn’s sign-in ended (it lasts about 60 days). Connect again.' where id = 1"); await notify('window', 'LinkedIn’s sign-in ended, so posting paused. Tap Connect LinkedIn to carry on (one click).', '/admin/linkedin').catch(() => {}); return { paused: true } }
  const d = id ? await one("select * from li_posts where id = $1 and status in ('waiting', 'ready')", [Number(id)]) : await one("select * from li_posts where status = 'ready' order by due_at limit 1")
  if (!d) return { skipped: 'no post is ready (write one first)' }
  const token = decrypt(s.token_enc)
  try {
    const slides = d.card && Array.isArray(d.card.slides) && d.card.slides.length >= 4 ? d.card.slides.length + 2 : 0   // Install 45: a carousel: cover, the slides, and you
    const doc = !d.photo && !d.photo_id && slides ? await uploadCarousel(token, s.person_urn, d.id, slides) : null
    const lib = !d.photo && d.photo_id ? await one('select bytes from li_photos where id = $1', [d.photo_id]).catch(() => null) : null
    const image = d.photo ? await uploadImage(token, s.person_urn, null, d.photo) : lib ? await uploadImage(token, s.person_urn, null, lib.bytes) : !doc && d.card ? await uploadImage(token, s.person_urn, `${SITE()}/api/li-card/${d.id}?k=${cardKey(d.id)}`) : null   // Install 44: its own designed picture
    const body = { author: s.person_urn, commentary: d.text, visibility: 'PUBLIC', distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] }, lifecycleState: 'PUBLISHED', isReshareDisabledByAuthor: false }
    if (doc) body.content = { media: { id: doc, title: String((d.card && d.card.title) || 'Olaitan Adebayo').slice(0, 200) } }
    else if (image) body.content = { media: { id: image, altText: String((d.card && d.card.title) || 'Olaitan Adebayo, Olexweb').slice(0, 300) } }
    const made = await li('/rest/posts', { method: 'POST', token, body }), urn = made.id
    if (urn && d.comment) await li(`/rest/socialActions/${encodeURIComponent(urn)}/comments`, { method: 'POST', token, body: { actor: s.person_urn, object: urn, message: { text: d.comment.replace('{LINK}', d.link || SITE()) } } }).catch(() => null)
    await q("update li_posts set status = 'posted', urn = $2, posted_at = now(), error = null where id = $1", [d.id, urn])
    if (d.kind === 'intro') await q('update li_settings set intro_done = true where id = 1')
    await notify('window', `On LinkedIn${d.day ? ' (Day ' + d.day + '/100)' : ''}: “${d.text.split('\n')[0].slice(0, 90)}”`, '/admin/linkedin').catch(() => {})
    return { posted: urn, day: d.day }
  } catch (e) {
    if (e.status === 401 || e.status === 403) { await q('update li_settings set paused_reason = $1 where id = 1', ['LinkedIn refused the post (' + e.status + '). Connect again.']); await notify('window', 'LinkedIn refused a post, so posting paused. Tap Connect LinkedIn again.', '/admin/linkedin').catch(() => {}) }
    await q('update li_posts set error = $2, due_at = now() + interval \'45 minutes\' where id = $1', [d.id, String(e.message).slice(0, 300)])
    throw e
  }
}
// called by the frequent run: a draft is always written ahead (you see it on the LinkedIn page); a ready one goes out at
// its time; your first post waits for your OK. And the reminder a week before LinkedIn's sign-in ends.
export async function liTick() {
  const s = await one('select * from li_settings where id = 1').catch(() => null)
  if (!liReady() || !s || !s.token_enc || !s.enabled || s.paused_reason) return null
  if (s.expires_at && new Date(s.expires_at) - Date.now() < 7 * 864e5 && !s.warned_at) { await q('update li_settings set warned_at = now() where id = 1'); await notify('window', 'LinkedIn’s sign-in ends within a week. Tap Connect LinkedIn once to keep posting.', '/admin/linkedin').catch(() => {}) }
  if (await one("select 1 from li_posts where status = 'ready' and due_at <= now()")) return liPostNow()
  if (!(await one("select 1 from li_posts where status in ('waiting', 'ready')")) && !(await one("select 1 from li_posts where error is not null and posted_at > now() - interval '30 minutes' and status <> 'posted'"))) return liDraftNext()
  return null
}
// what you can do on the LinkedIn page
export async function liSaveDraft(id, text, comment) {
  const bad = checkPost(String(text || ''), String(comment || '{LINK}')).filter((b) => /link is in/.test(b))
  if (bad.length) throw new Error('Take the link out of the post: it goes in the first comment ({LINK}).')
  await q("update li_posts set text = $2, comment = $3 where id = $1 and status in ('waiting', 'ready')", [Number(id), String(text).slice(0, 2900), String(comment || '').slice(0, 600)])
}
export async function liApprove(id) { await q("update li_posts set status = 'ready', due_at = least(coalesce(due_at, now()), now() + interval '1 day') where id = $1 and status = 'waiting'", [Number(id)]) }
export async function liSkip(id) { await q("update li_posts set status = 'skipped' where id = $1 and status in ('waiting', 'ready')", [Number(id)]) }
// Install 46: your own photo for a special post: you give the idea, it writes the post around it, the photo goes out as it is
export async function liPhotoPost(idea, bytes, type) {
  const x = String(idea || '').trim()
  if (x.length < 15) throw new Error('Write the idea in a sentence or two.')
  if (!bytes || bytes.length < 2000 || bytes.length > 8e6 || !/^image\/(jpeg|png|webp)$/.test(type || '')) throw new Error('Choose a JPG, PNG or WebP photo under 8 MB.')
  const s = await one('select * from li_settings where id = 1')
  const day = (await one("select count(*)::int n from li_posts where status = 'posted' and kind in ('day', 'video', 'article')")).n + 1
  const p = await writePost({ kind: 'day', day, series: s.series, format: 'story', note: x + ' (Olaitan’s own photo goes with this post: write so the words and the photo work together; don’t describe the photo in detail)' }, s.voice)
  await q("update li_posts set status = 'skipped' where status = 'ready' and photo is null")   // your photo post takes the next slot; the next daily one is written after it
  const r = await one("insert into li_posts (kind, ref, text, comment, link, format, day, status, due_at, card, photo, photo_type) values ('day', $1, $2, $3, $4, 'photo', $5, 'waiting', $6, $7, $8, $9) returning id",
    ['photo-' + Date.now(), p.text, p.comment, `${SITE()}/about`, day, nextSlot(s), JSON.stringify(p.card), bytes, type])
  return { id: r.id }
}
// Install 48: your photo library (up to 10), each read once for its mood
export async function liAddLibraryPhoto(bytes, type) {
  if (!bytes || bytes.length < 2000 || bytes.length > 8e6 || !/^image\/(jpeg|png|webp)$/.test(type || '')) throw new Error('Choose JPG, PNG or WebP photos under 8 MB each.')
  if ((await one('select count(*)::int n from li_photos')).n >= 10) throw new Error('You have 10 photos already. Remove one first.')
  let mood = 'neutral', what = ''
  try { const { readImage } = await import('@/lib/assistant/vision'); const r = await readImage(`data:${type};base64,${bytes.toString('base64')}`, 'photo'); mood = (/MOOD:\s*(\w+)/i.exec(r.text) || [])[1] || 'neutral'; what = ((/WHAT:\s*(.+)/i.exec(r.text) || [])[1] || '').slice(0, 200) } catch {}
  await q('insert into li_photos (bytes, type, mood, what) values ($1, $2, $3, $4)', [bytes, type, mood.toLowerCase(), what])
}
export async function liRemovePhoto(id) { await q('delete from li_photos where id = $1', [Number(id)]) }
export async function liPhotoBytes(id) { return one('select bytes, type from li_photos where id = $1', [Number(id)]) }
// start the series again: drafts cleared, earlier posts kept as history, back to Day 0 (the comeback post)
export async function liReset() {
  await q("delete from li_posts where status in ('waiting', 'ready', 'skipped')")
  await q("update li_posts set kind = 'old' where kind in ('day', 'video', 'article', 'intro')")
  await q("update li_settings set intro_done = false where id = 1")
}
export async function liSetVoice(v) { await q('update li_settings set voice = $1 where id = 1', [String(v || '').slice(0, 12000)]) }
export async function liAddNote(t) { const x = String(t || '').trim(); if (x.length < 15) throw new Error('Write a little more: what happened, and what you learned.'); await q('insert into li_notes (text) values ($1)', [x.slice(0, 2000)]) }
export async function liStatus() {
  const s = await one('select enabled, expires_at, name, connected_at, paused_reason, post_time, days, token_enc is not null as connected from li_settings where id = 1').catch(() => null)
  const posts = (await q("select id, kind, format, day, link, text, comment, status, error, posted_at, due_at, photo is not null as has_photo from li_posts where status in ('posted', 'waiting', 'ready') order by (status = 'posted'), coalesce(due_at, posted_at) desc limit 15").catch(() => ({ rows: [] }))).rows
  const photos = (await q('select id, mood, what from li_photos order by id').catch(() => ({ rows: [] }))).rows
  const extra = await one("select voice, series, intro_done, (select count(*)::int from li_notes where used_at is null) as notes, (select count(*)::int from li_posts where status = 'posted' and kind in ('day', 'video', 'article')) as days from li_settings where id = 1").catch(() => ({}))
  return { ready: liReady(), ...(s || {}), ...(extra || {}), posts, photos }
}
