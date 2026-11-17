// Install 29: the daily Facebook story. One story a day in words and pictures (a swipe of 4–6 picture slides with the story
// in the post), rotating three series:
//   - "Tayo’s World": one character (Tayo, the guy with the big round green glasses from the videos) living everyday
//     Nigerian life with tech in it, in episodes that remember what happened before.
//   - "True tech story": a real moment from the Olexweb Directory (space, AI, phones, history), told as a story. Facts only
//     from the Directory post.
//   - "The turnaround": a business owner’s struggle and the change that turned it round (a story, a different business
//     each time).
// Written from what works on Facebook now: the first line carries the story (only ~2 lines show before "See more"); short
// paragraphs; a real question at the end for comments (no "like if you agree" bait, which Facebook punishes); the link goes
// in the first comment, never in the post (posts with links reach fewer people). They post by themselves after the
// checks; you can see them ahead in Automation → Plan → Facebook, write a different one, or stop one.
import 'server-only'
import { createHmac } from 'node:crypto'
import { q, one } from '@/lib/admin/db'
import { askJSON } from '@/lib/assistant/llm'
import { findRepeat } from './samey'
import { SITE_ORIGIN } from './youtube'

export const SERIES = {
  tayo: { name: 'Tayo’s World', badge: 'TAYO’S WORLD' },
  true: { name: 'True tech story', badge: 'TRUE TECH STORY' },
  turnaround: { name: 'The turnaround', badge: 'THE TURNAROUND' },
}
// Mon … Sun (Lagos): a mix of the three, Tayo most often (a character people follow is what brings them back)
const WEEK = ['tayo', 'tayo', 'true', 'turnaround', 'tayo', 'true', 'turnaround']   // index = getUTCDay() (0 = Sunday)
export const DAYS_AHEAD = 3
const LATE = 3 * 3600e3
const lagosDay = (ms = Date.now()) => new Date(ms + 3600e3).toISOString().slice(0, 10)
const addDays = (day, n) => lagosDay(Date.parse(day + 'T12:00:00Z') - 3600e3 + n * 86400e3)
const slotMs = (day, hhmm) => Date.parse(`${day}T${hhmm}:00Z`) - 3600e3
const p2 = (n) => String(n).padStart(2, '0')
const dayStr = (d) => (d instanceof Date ? `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}` : String(d).slice(0, 10))
const clean = (s, n) => String(s == null ? '' : s).replace(/[ \t]+/g, ' ').trim().slice(0, n)
export const seriesFor = (day) => WEEK[new Date(day + 'T12:00:00Z').getUTCDay()]
export const imageKey = (id, n) => createHmac('sha256', process.env.AUTH_SECRET || 'olexweb').update(`fbstory:${id}:${n}`).digest('hex').slice(0, 20)
export const imageUrl = (id, n, origin = SITE_ORIGIN()) => `${origin}/api/fbstory/${id}/${n}?k=${imageKey(id, n)}`

export async function storySettings() { return (await one('select story_on, story_time, enabled, paused_reason from meta_settings where id = 1').catch(() => null)) || { story_on: false } }

// ---------- how to write them ----------
const CRAFT = `HOW THESE STORIES WORK (follow every point):
- Line 1 is everything: only about two lines show before "See more". Start in the middle of the moment, with a person, a problem and a detail you can see (a time, a place, an amount in naira, what someone said). It must make people need the next line. Never start with "Once upon a time", a question to the reader, or an emoji.
- Short paragraphs: one to three sentences, a blank line between them. Easy to read on a phone with one thumb.
- Show, don't tell: what people do and say (a little dialogue), not adjectives. Real Nigerian life (danfo, NEPA light, data running out, the landlord, the family WhatsApp group, owambe), told with warmth, never mocking anyone.
- One person wants something, something is in the way, something changes, and there is a payoff that feels earned. A small surprise near the end.
- The ending lands on one clear line, then one honest question people will want to answer from their own life (e.g. "What's the one app you'd never pay for again?"). Never "like if you agree", "share if", "type amen", "tag someone".
- No links, no "link in bio", no hashtags in the story (at most two at the very end), no selling. The story is the gift.
- Length of the post: 150 to 280 words.
- The slides retell the story in 4 to 6 pictures for people who swipe instead of reading: slide 1 is the hook (the same moment as line 1, 6 to 16 words), the middle slides are the turns (10 to 26 words each, each one a line from the story), the last slide is the ending line. They must make sense on their own.`
const SHAPE = { type: 'object', properties: {
  title: { type: 'string' }, post: { type: 'string' }, slides: { type: 'array', items: { type: 'string' } }, comment: { type: 'string' }, summary: { type: 'string' } },
  required: ['title', 'post', 'slides', 'comment', 'summary'] }

async function pastStories() { return (await q("select id, series, episode, title, summary, day from fb_stories where status in ('ready', 'posted') order by day desc limit 40")).rows }
async function toolFor() {
  // a live Directory tool no story has used yet (Tayo's rescue), newest first
  return one(`select slug, name, url, content->>'oneLiner' as one, content->>'summary' as what from dir_entries where kind = 'tool' and status = 'live'
      and slug not in (select source_slug from fb_stories where source_slug is not null) order by published_at desc nulls last limit 1`)
}
async function trueFor() {
  return one(`select slug, kind, name, content from dir_entries where kind in ('story', 'update') and status = 'live' and published_at > now() - interval '14 days'
      and slug not in (select source_slug from fb_stories where source_slug is not null) order by (kind = 'story') desc, score desc nulls last, published_at desc limit 1`)
}
const KP = { tool: 'tools', update: 'updates', guide: 'guides', alert: 'alerts', story: 'stories' }

async function brief(series, past) {
  if (series === 'tayo') {
    const eps = past.filter((s) => s.series === 'tayo').sort((a, b) => b.episode - a.episode), ep = (eps[0] ? eps[0].episode : 0) + 1, tool = await toolFor()
    const prompt = `Write EPISODE ${ep} of "Tayo’s World", a daily Facebook story series.
TAYO: 27, a freelance graphic designer in Yaba, Lagos. Big round green glasses. Hustler, funny, kind, a little dramatic. Mum calls at the worst times. Best friend Chidinma runs a small food business. Cousin Segun brags about everything. Landlord: "Baba Landlord".
${eps.length ? 'THE STORY SO FAR (latest first; keep it consistent, refer back when it helps):\n' + eps.slice(0, 5).map((e) => `- Episode ${e.episode}: ${e.summary}`).join('\n') : 'This is the very first episode: introduce Tayo through what he does, not a description.'}
${tool ? `This episode, part of the way out is a real free website: ${tool.name} (${tool.url}): ${tool.one || tool.what || ''}. Use it only for what it really does. It is a small part of the story, not an advert.` : 'No website in this one: a pure Tayo moment.'}
Each episode is complete on its own, and ends with a small hook about tomorrow.`
    return { prompt, episode: ep, source: tool ? { slug: tool.slug, link: `${SITE_ORIGIN()}/tools/${tool.slug}`, comment: `The site Tayo used: ${tool.name}, explained (free): ` } : { link: `${SITE_ORIGIN()}/tools`, comment: 'More free tools like the ones Tayo finds: ' } }
  }
  if (series === 'true') {
    const e = await trueFor(); if (!e) return null
    const c = e.content || {}, facts = [c.title || e.name, c.summary, ...(c.points || []), ...(c.whatToDo || [])].filter(Boolean).join('\n')
    return { prompt: `Tell this REAL tech moment as a gripping "True tech story". Use ONLY these facts (no invented quotes, numbers, names or details; tell it vividly through order and pace, not by adding facts):\n${facts.slice(0, 3500)}`,
      facts, source: { slug: e.slug, link: `${SITE_ORIGIN()}/${KP[e.kind] || 'stories'}/${e.slug}`, comment: 'The full story, checked against its source: ' } }
  }
  const used = past.filter((s) => s.series === 'turnaround').map((s) => s.title).slice(0, 15)
  return { prompt: `Write "The turnaround": a story (clearly a story, not a real client) about a small Nigerian business owner. A DIFFERENT kind of business from these past ones: ${used.join('; ') || 'none yet'}.
The owner is losing customers or money for a reason they can't see; a small honest change to how they show up online (a clear website, being on Google Maps, prices people can see, WhatsApp one tap away, real photos) turns it round. Name the person and the business type; let the change come from someone in the story, not a company. No company names, no Olexweb in the story.`,
    source: { link: `${SITE_ORIGIN()}/services/small-business-website-nigeria`, comment: 'If your business needs its turnaround, this is how a website helps: ' } }
}

// ---------- the checks (code, not AI: they can't be talked round) ----------
const BAIT = /\b(like if|share if|type amen|tag (a|someone|your)|comment (yes|amen|done)|smash (that|the) like|follow for more)\b/i
export function checkStory(s, { facts = '', past = [] } = {}) {
  const problems = [], post = String(s.post || ''), first = post.split('\n').find((l) => l.trim()) || '', words = post.split(/\s+/).filter(Boolean).length
  if (first.length > 140) problems.push('The first line is too long to show before “See more”.')
  if (/^(once upon|have you ever|did you know|\p{Extended_Pictographic})/iu.test(first.trim())) problems.push('The first line opens weakly (start in the middle of the moment).')
  if (words < 130 || words > 320) problems.push(`The post is ${words} words (130 to 320).`)
  if (/https?:\/\/|www\.|\.com\b/i.test(post)) problems.push('A link is in the post (it goes in the first comment).')
  if (BAIT.test(post)) problems.push('It asks for likes, shares or tags (Facebook punishes that).')
  if ((post.match(/#\w+/g) || []).length > 2) problems.push('Too many hashtags.')
  if (!/\?/.test(post.slice(-260))) problems.push('It doesn’t end with a question for people to answer.')
  const slides = s.slides || []
  if (slides.length < 4 || slides.length > 6) problems.push('It needs 4 to 6 slides.')
  if (slides.some((t) => !String(t).trim() || String(t).length > 170)) problems.push('A slide is empty or too long.')
  if (facts) {                                                               // a true story: every number must be in the facts
    const nums = [...post.matchAll(/\b\d[\d,.]*\b/g)].map((m) => m[0].replace(/[.,]$/, '')).filter((n) => n.length > 1)
    const bad = nums.filter((n) => !facts.includes(n) && !facts.includes(n.replace(/,/g, '')))
    if (bad.length) problems.push('Numbers not in the source: ' + bad.slice(0, 3).join(', '))
  }
  const rep = findRepeat(s.title, past.map((p) => ({ title: p.title })))
  if (rep) problems.push('Too close to an earlier story: “' + rep.title + '”.')
  return problems
}

// ---------- writing ----------
export async function writeStory(day, { replaceId = null } = {}) {
  const series = seriesFor(day), past = await pastStories()
  let b = await brief(series, past), used = series
  if (!b) { used = 'tayo'; b = await brief('tayo', past) }                   // no fresh true story this week: Tayo instead
  const sys = 'You are a brilliant storyteller writing daily Facebook stories for Olexweb, a Nigerian web and tech studio. British English with natural Nigerian voice in dialogue. Warm, funny, specific, never preachy.'
  let s = null, problems = []
  for (let attempt = 0; attempt < 2; attempt++) {
    s = await askJSON({ kind: 'quick', temperature: 0.9, maxTokens: 2200, system: sys, schema: SHAPE,
      prompt: `${b.prompt}\n\n${CRAFT}\n${problems.length ? '\nYOUR LAST TRY WAS REJECTED FOR: ' + problems.join(' ') + ' Fix all of it.\n' : ''}\nReturn: "title" (a short internal title, 3–8 words), "post" (the full Facebook post), "slides" (4–6 slide texts), "comment" (one short line to sit before the link in the first comment), "summary" (2 sentences: what happened, for the next episode's memory).` })
    s.slides = (s.slides || []).map((t) => clean(t, 200)).filter(Boolean)
    problems = checkStory(s, { facts: b.facts || '', past })
    if (!problems.length) break
  }
  const ok = !problems.length
  const row = { series: used, episode: b.episode || null, day, title: clean(s.title, 120), post: String(s.post || '').trim().slice(0, 4000), slides: s.slides.slice(0, 6),
    comment: clean((b.source.comment || clean(s.comment, 160)) + b.source.link, 400), summary: clean(s.summary, 500), source_slug: b.source.slug || null, status: ok ? 'ready' : 'skipped', note: ok ? null : 'Not posted: ' + problems.join(' ') }
  if (replaceId) {
    await q(`update fb_stories set series=$2, episode=$3, title=$4, post=$5, slides=$6, comment=$7, summary=$8, source_slug=$9, status=$10, note=$11, updated_at=now() where id=$1`,
      [replaceId, row.series, row.episode, row.title, row.post, JSON.stringify(row.slides), row.comment, row.summary, row.source_slug, row.status, row.note])
    return { id: replaceId, ...row }
  }
  const r = await one(`insert into fb_stories (series, episode, day, title, post, slides, comment, summary, source_slug, status, note) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      on conflict (day) do nothing returning id`, [row.series, row.episode, day, row.title, row.post, JSON.stringify(row.slides), row.comment, row.summary, row.source_slug, row.status, row.note])
  return r ? { id: r.id, ...row } : null
}

// ---------- the daily run ----------
export async function storyRun(report, now = Date.now()) {
  const st = await storySettings(); if (!st.story_on) return report
  const page = await one('select 1 from meta_pages where selected').catch(() => null); if (!page) return report
  const time = /^\d\d:\d\d$/.test(st.story_time || '') ? st.story_time : '20:00', today = lagosDay(now)
  // 1. due now → post; missed by 3 hours → say so
  const due = await one("select * from fb_stories where status = 'ready' order by day limit 1")
  if (due) {
    const at = slotMs(dayStr(due.day), time)
    if (now > at + LATE) await q("update fb_stories set status = 'missed', note = $2 where id = $1", [due.id, st.enabled ? 'Missed its time: Facebook didn’t take it in time.' : 'Missed: Facebook posting was off.'])
    else if (now >= at) {
      try {
        const { postStory } = await import('./meta')
        const r = await postStory(due)
        if (r.posted) { await q("update fb_stories set status = 'posted', post_id = $2, posted_at = now(), note = null where id = $1", [due.id, r.post_id]); report.story = { posted: due.id } }
        else { await q('update fb_stories set note = $2 where id = $1', [due.id, 'Facebook: ' + (r.skipped || r.error)]); report.story = { waiting: r.skipped || r.error } }
      } catch (e) { report.errors.push('story: ' + e.message) }
      return report
    }
  }
  // 2. the next 3 days each get their story, one per run, in day order (Tayo's episodes follow each other)
  for (let d = 0; d < DAYS_AHEAD; d++) {
    const day = addDays(today, d)
    if (d === 0 && slotMs(day, time) < now + 15 * 60e3) continue
    if (await one('select 1 from fb_stories where day = $1', [day])) continue
    if (report.ideas || report.script) break                                 // not in the same run as other long work
    try { const w = await writeStory(day); report.storyWrote = w ? { id: w.id, day, series: w.series, status: w.status } : null } catch (e) { report.errors.push('story: ' + e.message) }
    break
  }
  return report
}

// ---------- the screen ----------
export async function storiesData() {
  const st = await storySettings(), today = lagosDay()
  const rows = (await q(`select id, series, episode, day, title, post, slides, comment, status, note, post_id, posted_at from fb_stories where day between $1::date - 2 and $1::date + ${DAYS_AHEAD} order by day`, [today])).rows
  return { on: !!st.story_on, time: st.story_time || '20:00', fbOn: !!st.enabled, today,
    stories: rows.map((r) => ({ ...r, day: dayStr(r.day), seriesName: (SERIES[r.series] || {}).name, images: (r.slides || []).map((_, n) => `/api/fbstory/${r.id}/${n}?k=${imageKey(r.id, n)}`) })) }
}
export async function rewriteStory(id) {
  const s = await one("select id, day from fb_stories where id = $1 and status in ('ready', 'skipped', 'missed')", [Number(id)]); if (!s) throw new Error('Only a story that hasn’t gone out can be rewritten.')
  const r = await writeStory(dayStr(s.day), { replaceId: s.id }); return { ok: true, status: r.status, note: r.note }
}
export async function stopStory(id) {
  const r = await one("update fb_stories set status = 'skipped', note = 'Stopped by you' where id = $1 and status = 'ready' returning id", [Number(id)]); if (!r) throw new Error('That story isn’t waiting to go out.')
  return { ok: true }
}
export async function setStories({ on, time }) {
  if (on != null) await q('update meta_settings set story_on = $1 where id = 1', [!!on])
  if (time != null) { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Give a time like 20:00.'); await q('update meta_settings set story_time = $1 where id = 1', [time]) }
  return { ok: true }
}
export async function storyForImage(id, n, k) {
  if (k !== imageKey(id, n)) return null
  const s = await one('select id, series, episode, slides, status from fb_stories where id = $1', [Number(id)]); if (!s || !(s.slides || [])[n]) return null
  return { series: s.series, episode: s.episode, text: s.slides[n], n, of: s.slides.length }
}
