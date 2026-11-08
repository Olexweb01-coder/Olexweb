// The Olexweb Directory: every useful website the research engine finds becomes a page at olexweb.com/tools/<slug>,
// written under the editorial rulebook, checked in code (every fact quoted from the site), published, and announced
// to search engines at once (IndexNow + sitemap). Runs by itself from the autopilot; managed from Admin → Directory.
// Install 16: a daily goldmine. Four kinds (tools here; tech updates, how-tos and safety alerts in dirnews.js), about 5 a
// day, each going live at its own time (dir_settings.slots, Lagos) from posts prepared ahead ('ready'); Google is told
// the same day (IndexNow + Search Console sitemap); the day's best post is shared on the Facebook Page.
import 'server-only'
import { createHash } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { q, one } from '@/lib/admin/db'
import { safeFetch, pageText } from '@/lib/assistant/net'
import { askJSON } from '@/lib/assistant/llm'
import { RULEBOOK, checkEntry } from './editorial'
import { writePost, gatherFinds, nextFind, KINDS, KIND_PATH, KIND_NAME } from './dirnews'
import { submitSitemap } from './gsc'
import { sharePostLink } from './meta'

export const SITE = 'https://olexweb.com'
export class DirError extends Error {}
const refresh = (slug, kind = 'tool') => { try { revalidatePath('/tools'); revalidatePath('/feed.xml'); revalidatePath('/' + (KIND_PATH[kind] || 'tools')); if (slug) revalidatePath('/' + (KIND_PATH[kind] || 'tools') + '/' + slug) } catch {} }
export const pathOf = (e) => '/' + (KIND_PATH[e.kind] || 'tools') + '/' + e.slug
export const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'tool'
export const indexNowKey = () => createHash('sha256').update('indexnow:' + (process.env.AUTH_SECRET || 'olexweb')).digest('hex').slice(0, 32)

const SCHEMA = { type: 'object', properties: {
  title: { type: 'string' }, metaDescription: { type: 'string' }, oneLiner: { type: 'string' }, summary: { type: 'string' },
  facts: { type: 'array', items: { type: 'object', properties: { claim: { type: 'string' }, quote: { type: 'string' } }, required: ['claim', 'quote'] } },
  pricing: { type: 'object', properties: { status: { type: 'string' }, claim: { type: 'string' }, quote: { type: 'string' } }, required: ['status'] },
  whoFor: { type: 'array', items: { type: 'string' } }, howToStart: { type: 'array', items: { type: 'string' } }, ourTake: { type: 'string' },
  goodFor: { type: 'array', items: { type: 'string' } }, watchOut: { type: 'array', items: { type: 'string' } },
  faq: { type: 'array', items: { type: 'object', properties: { q: { type: 'string' }, a: { type: 'string' } }, required: ['q', 'a'] } },
  tags: { type: 'array', items: { type: 'string' } }, thin: { type: 'boolean' }, unsafe: { type: 'boolean' } },
  required: ['title', 'metaDescription', 'oneLiner', 'summary', 'facts', 'pricing', 'whoFor', 'howToStart', 'ourTake', 'goodFor', 'watchOut', 'faq', 'tags', 'thin', 'unsafe'] }

function brief(idea, text) {
  return `Write the Olexweb Directory page for this website.
Name: ${idea.name}
Address: ${idea.url}
Category (from our research): ${idea.category || 'unknown'}
What our research noted (may help you understand it; facts must still come from the site's text): ${[idea.what, idea.why, idea.risks].filter(Boolean).join(' | ').slice(0, 800)}

Return JSON with:
- title: "<Name>: <what it does in plain words>" (max 65 characters)
- metaDescription: 120–155 characters for Google: what it is, who it's for, free or not (only if quoted)
- oneLiner: one sentence (max 120 characters)
- summary: 2–4 sentences: what it does, the main job it helps with, and who benefits
- facts: 3–7 items {claim, quote}: each quote copied EXACTLY from the site's text below
- pricing: {status: "free" | "freemium" | "paid" | "unknown", claim, quote} (quote exact text proving it, or status "unknown")
- whoFor: 2–4 short items (e.g. "Students who need quick diagrams")
- howToStart: 3–5 short numbered steps someone can follow today
- ourTake: 2–3 sentences of honest verdict: when it's worth using, when not
- goodFor: 2–4 short items; watchOut: 1–3 honest limits or cautions
- faq: 3 questions people search (e.g. "Is ${idea.name} free?", "How do I use ${idea.name}?"), answers 1–2 sentences using only the facts
- tags: 3–6 lowercase topic tags
- thin: true if the text is too thin to explain it; unsafe: true if it's piracy, adult, gambling, hacking or illegal

THE SITE'S OWN TEXT:
"""${text.slice(0, 12000)}"""`
}

// one page: read the site, write, check; publish if it passes and auto-publish is on
export async function writeEntry(ideaId, { publish, schedule = false } = {}) {
  const idea = await one('select * from yt_ideas where id = $1', [Number(ideaId)]); if (!idea) throw new DirError('Unknown idea.')
  if (idea.status === 'passed' || idea.status === 'skipped') throw new DirError('That site was turned down by the research checks.')
  let html
  try { const r = await safeFetch(idea.url, { timeoutMs: 10000 }); if (r.status >= 400 || !/html/i.test(r.type)) throw new Error('status ' + r.status); html = r.text }
  catch (e) { await saveDraft(idea, null, { ok: false, score: 0, problems: ['The site couldn’t be read (' + e.message + '). It will be tried again later.'] }); return { ok: false, why: 'unreachable' } }
  const pt = pageText(html), meta = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i) || [])[1] || ''
  const text = [pt.title, meta, pt.text].filter(Boolean).join('\n').slice(0, 14000)   // the page's title, its own description and its readable text
  if (text.length < 400) { await saveDraft(idea, null, { ok: false, score: 0, problems: ['The site has too little readable text to write an honest page.'] }); return { ok: false, why: 'thin' } }
  let e = await askJSON({ kind: 'write', temperature: 0.5, maxTokens: 3000, schema: SCHEMA, system: RULEBOOK, prompt: brief(idea, text) })
  let check = checkEntry(e, text)
  if (!check.ok && !e.unsafe && !e.thin) {                // one repair pass, told exactly what failed
    const e2 = await askJSON({ kind: 'write', temperature: 0.3, maxTokens: 3000, schema: SCHEMA, system: RULEBOOK,
      prompt: brief(idea, text) + `\n\nYOUR PREVIOUS DRAFT FAILED THESE CHECKS. Fix every one (quotes must be copied exactly from the text):\n- ${check.problems.join('\n- ')}\n\nPREVIOUS DRAFT:\n${JSON.stringify(e).slice(0, 6000)}` })
    const c2 = checkEntry(e2, text); if (c2.ok || c2.problems.length < check.problems.length) { e = e2; check = c2 }
  }
  const st = await one('select auto_publish from dir_settings where id = 1')
  const live = check.ok && !schedule && (publish ?? (st ? st.auto_publish : true))
  const slug = await saveDraft(idea, e, check, live ? 'live' : check.ok && schedule ? 'ready' : (e.unsafe ? 'blocked' : 'draft'))   // scheduled: goes live at its time
  if (live) await announce([SITE + '/tools/' + slug])
  return { ok: check.ok, slug, live, kind: 'tool', status: live ? 'live' : check.ok && schedule ? 'ready' : 'draft', problems: check.problems }
}
async function saveDraft(idea, e, quality, status = 'draft') {
  const ex = await one('select id, slug from dir_entries where idea_id = $1', [idea.id])
  let slug = ex ? ex.slug : slugify(idea.name)
  if (!ex) for (let i = 2; await one('select 1 from dir_entries where slug = $1', [slug]); i++) slug = slugify(idea.name) + '-' + i
  const content = e ? { ...e, facts: (e.facts || []).map((f) => ({ claim: f.claim, quote: f.quote })) } : {}
  await q(`insert into dir_entries (slug, idea_id, name, url, category, status, content, quality, published_at) values ($1, $2, $3, $4, $5, $6, $7, $8, case when $6 = 'live' then now() end)
    on conflict (idea_id) do update set name = $3, url = $4, category = $5, status = case when dir_entries.status = 'live' and $6 <> 'live' and $7::jsonb = '{}'::jsonb then dir_entries.status else $6 end,
      content = case when $7::jsonb = '{}'::jsonb then dir_entries.content else $7 end, quality = $8, updated_at = now(),
      published_at = case when $6 = 'live' then coalesce(dir_entries.published_at, now()) else dir_entries.published_at end`,
    [slug, idea.id, idea.name, idea.url, idea.category || null, status, JSON.stringify(content), JSON.stringify(quality)])
  refresh(slug); return slug
}

// IndexNow: tells Bing (and engines that share its index) about new pages at once. The key is served at /api/indexnow.
export async function announce(urls) {
  if (!urls.length || process.env.INDEXNOW_DISABLED === '1') return null
  try {
    const r = await fetch(process.env.INDEXNOW_ENDPOINT || 'https://api.indexnow.org/indexnow', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: 'olexweb.com', key: indexNowKey(), keyLocation: SITE + '/api/indexnow', urlList: urls.slice(0, 1000) }), signal: AbortSignal.timeout(8000) })
    const out = { at: new Date().toISOString(), status: r.status, urls: urls.length }; await q('update dir_settings set last_ping = $1 where id = 1', [JSON.stringify(out)]); return out
  } catch (e) { return { error: e.message } }
}

// the autopilot: a few pages per run, up to the daily limit, best ideas first; also retries unreachable drafts after a day
export async function directoryRun({ max = 2, deadlineMs = 45000 } = {}) {
  const t0 = Date.now(), st = await one('select per_day from dir_settings where id = 1'), done = (await one("select count(*)::int n from dir_entries where created_at > now() - interval '1 day'")).n
  if (done >= (st ? st.per_day : 12)) return { skipped: 'daily limit reached' }
  const ideas = (await q(`select i.id from yt_ideas i left join dir_entries d on d.idea_id = i.id
    where i.status in ('new', 'picked', 'made') and i.score >= 55 and (d.id is null or (d.status = 'draft' and d.content = '{}'::jsonb and d.updated_at < now() - interval '1 day'))
    order by (exists (select 1 from yt_scripts s where s.idea_id = i.id and s.status in ('approved', 'rendering', 'rendered')) or exists (select 1 from yt_long_items li join yt_scripts s on s.id = li.script_id where li.idea_id = i.id and s.status in ('approved', 'rendering', 'rendered'))) desc,
      (i.status = 'made') desc, i.score desc, i.id desc limit $1`, [max])).rows
  const out = []
  for (const i of ideas) { if (Date.now() - t0 > deadlineMs) break; try { out.push(await writeEntry(i.id)) } catch (e) { out.push({ ok: false, why: e.message }) } }
  return { wrote: out.length, live: out.filter((x) => x.live).length, results: out }
}

// ---------- public side ----------
export async function liveEntries(kind = null) { return (await q("select slug, kind, name, category, content->>'oneLiner' as one, content->'pricing'->>'status' as price, content->'tags' as tags, source_name as source, published_at from dir_entries where status = 'live' and ($1::text is null or kind = $1) order by published_at desc limit 2000", [kind])).rows.map((r) => ({ ...r, published_at: r.published_at && r.published_at.toISOString() })) }
export async function entryBySlug(slug, kind = 'tool') {
  const e = await one("select d.*, s.yt_video_id, s.upload, v.privacy from dir_entries d left join yt_scripts s on s.idea_id = d.idea_id and s.status = 'uploaded' left join yt_videos v on v.video_id = s.yt_video_id where d.slug = $1 and d.status = 'live' and d.kind = $2", [String(slug), kind])
  if (!e) return null
  const isPublic = String((e.upload && e.upload.privacy) || e.privacy || '').startsWith('public')
  const related = (await q("select slug, kind, name, content->>'oneLiner' as one, content->'pricing'->>'status' as price from dir_entries where status = 'live' and id <> $1 and kind = $3 and (category = $2 or $2 is null) order by published_at desc limit 6", [e.id, e.category, e.kind])).rows
  const offer = await currentOffer()
  return { kind: e.kind, source: e.source_name, slug: e.slug, name: e.name, url: e.url, category: e.category, content: e.content, published_at: e.published_at && e.published_at.toISOString(), updated_at: e.updated_at.toISOString(), video: isPublic ? e.yt_video_id : null, related, offer }
}
export async function currentOffer() {                    // the one next step every page leads to: the newest live page, else the course
  const p = await one("select slug, type, content->>'title' as title, content->>'tagline' as tagline from pages where status = 'live' and accepting order by published_at desc limit 1").catch(() => null)
  if (p) return { href: '/' + p.slug, title: p.title, line: p.tagline, kind: p.type }
  const a = await one('select accepting from aoc_settings where id = 1').catch(() => null)
  return a && a.accepting ? { href: '/aoc', title: 'Anatomy of Creation', line: 'A free audio in 4 short parts: why some people create while others only watch.', kind: 'audio' } : { href: '/me', title: 'Join Olaitan on WhatsApp', line: 'New free resources and tools, first.', kind: 'link' }
}
export async function countView(slug, lead = false) {
  const col = lead ? 'leads' : 'views'
  const r = await one(`update dir_entries set ${col} = ${col} + 1 where slug = $1 and status = 'live' returning slug`, [String(slug).slice(0, 80)]); if (!r) return
  await q(`insert into dir_daily (slug, day, ${col}) values ($1, (now() at time zone 'Africa/Lagos')::date, 1) on conflict (slug, day) do update set ${col} = dir_daily.${col} + 1`, [r.slug])
}

// ---------- admin ----------
export async function adminList() {
  const rows = (await q("select id, slug, kind, name, url, category, status, quality, views, leads, created_at, published_at from dir_entries order by coalesce(published_at, created_at) desc limit 1000")).rows
  const st = await one('select per_day, auto_publish, last_ping, slots, kinds, fb_share, google from dir_settings where id = 1')
  const waiting = (await one("select count(*)::int n from yt_ideas i left join dir_entries d on d.idea_id = i.id where i.status in ('new','picked','made') and i.score >= 55 and d.id is null")).n
  const week = (await q("select day, sum(views)::int as views, sum(leads)::int as leads from dir_daily where day > (now() at time zone 'Africa/Lagos')::date - 14 group by day order by day")).rows
  const older = await olderShorts()
  return { older, entries: rows.map((r) => ({ ...r, created_at: r.created_at.toISOString(), published_at: r.published_at && r.published_at.toISOString() })), settings: st, waiting, week: week.map((w) => ({ ...w, day: w.day.toISOString().slice(0, 10) })) }
}
export async function olderShorts() {                    // Shorts already on YouTube whose guide is now live, not yet linked
  return (await q(`select d.id, d.name, d.slug, s.yt_video_id from dir_entries d join yt_scripts s on s.idea_id = d.idea_id and s.status = 'uploaded' and s.yt_video_id is not null
    where d.status = 'live' and d.yt_linked_at is null order by s.uploaded_at desc limit 50`)).rows
}
export async function markLinked(id) { await q('update dir_entries set yt_linked_at = now() where id = $1', [Number(id)]); return { ok: true } }
export async function setStatus(id, status) {
  const e = await one('select slug, kind, quality, content from dir_entries where id = $1', [Number(id)]); if (!e) throw new DirError('Unknown page.')
  if (status === 'live' && !(e.quality && e.quality.ok)) throw new DirError('This page didn’t pass the quality checks. Rewrite it first.')
  await q("update dir_entries set status = $2, published_at = case when $2 = 'live' then coalesce(published_at, now()) else published_at end, updated_at = now() where id = $1", [Number(id), status])
  refresh(e.slug, e.kind); if (status === 'live') await announce([SITE + pathOf(e)]); return { ok: true }
}
export async function rewrite(id) {
  const e = await one('select idea_id, find_id from dir_entries where id = $1', [Number(id)]); if (!e || !(e.idea_id || e.find_id)) throw new DirError('Unknown page.')
  return e.find_id ? writePost(e.find_id) : writeEntry(e.idea_id)
}
export async function removeEntry(id) { const e = await one('delete from dir_entries where id = $1 returning slug, kind', [Number(id)]); if (e) refresh(e.slug, e.kind); return { ok: true } }
export async function saveSettings({ perDay, autoPublish }) {
  await q('update dir_settings set per_day = $1, auto_publish = $2 where id = 1', [Math.max(0, Math.min(50, Number(perDay) || 0)), autoPublish !== false]); return { ok: true }
}

// ---------- Install 16: about 5 a day, each at its own time ----------
const LAGOS = 3600e3
const lagosDay = (t = Date.now()) => new Date(t + LAGOS).toISOString().slice(0, 10)
const slotMs = (day, hm) => Date.parse(day + 'T' + hm + ':00Z') - LAGOS
// the kind each time of the day prefers (a safety alert worth it takes the next time whatever it is)
const PLAN = ['update', 'tool', 'guide', 'tool', 'update', 'guide', 'tool']
export async function dirSettings() {
  const st = (await one('select per_day, auto_publish, slots, kinds, fb_share, fb_last::text as fb_last, gathered_at, google from dir_settings where id = 1')) || {}
  const all = String(st.slots || '08:00,11:00,14:00,17:00,20:00').split(',').filter((t) => /^\d\d:\d\d$/.test(t)).sort()
  const n = Math.max(0, Math.min(all.length, Number(st.per_day ?? 5))), times = n >= all.length ? all : Array.from({ length: n }, (_, i) => all[Math.round(i * (all.length - 1) / Math.max(1, n - 1))])
  const kinds = String(st.kinds || KINDS.join(',')).split(',').filter((k) => KINDS.includes(k))
  return { ...st, times: n === 1 ? [all[Math.floor(all.length / 2)]] : [...new Set(times)], kinds }
}
const planFor = (i, kinds) => { for (let k = 0; k < PLAN.length; k++) { const want = PLAN[(i + k) % PLAN.length]; if (kinds.includes(want) || (want === 'guide' && kinds.includes('alert'))) return want } return kinds[0] || 'tool' }

// publish the post for a time that has come (at most 3 hours late: a missed time is let go, not doubled up)
export async function publishDue(now = Date.now()) {
  const st = await dirSettings(); if (!st.auto_publish || !st.times.length) return null
  const day = lagosDay(now), i = st.times.findIndex((t, k) => now >= slotMs(day, t) && now < slotMs(day, t) + 3 * 3600e3 && (k === st.times.length - 1 || now < slotMs(day, st.times[k + 1])))
  if (i < 0) return null
  const slot = day + ' ' + st.times[i]
  if (await one('select 1 from dir_entries where slot = $1', [slot])) return null
  const want = planFor(i, st.kinds)
  const pick = await one(`select id, slug, kind, name from dir_entries where status = 'ready' and kind = any($1::text[])
      order by (kind = 'alert' and coalesce(score, 0) >= 80) desc, (kind = $2 or ($2 = 'guide' and kind = 'alert')) desc, created_at limit 1`, [st.kinds, want])
  if (!pick) return null
  const r = await one("update dir_entries set status = 'live', slot = $2, published_at = now(), updated_at = now() where id = $1 and status = 'ready' returning id", [pick.id, slot])
  if (!r) return null
  refresh(pick.slug, pick.kind)
  const url = SITE + pathOf(pick)
  await announce([url, SITE + '/' + (KIND_PATH[pick.kind] || 'tools'), SITE + '/tools'])
  let google = null
  const last = st.google && st.google.at ? Date.parse(st.google.at) : 0
  if (Date.now() - last > 50 * 60e3) {                                  // Search Console: at most about once an hour
    google = await submitSitemap().catch((e) => ({ ok: false, why: e.message }))
    await q('update dir_settings set google = $1 where id = 1', [JSON.stringify({ ...google, at: new Date().toISOString() })])
  }
  return { slot, kind: pick.kind, slug: pick.slug, name: pick.name, url, google }
}

// the day's best live post, shared once on the Facebook Page (after the second time of the day, so there's a choice)
export async function shareBest(now = Date.now()) {
  const st = await dirSettings(); if (!st.fb_share) return null
  const day = lagosDay(now)
  if (st.fb_last === day) return null
  if (st.times.length > 1 && now < slotMs(day, st.times[1]) + 30 * 60e3) return null
  const best = await one(`select id, slug, kind, name, content->>'oneLiner' as one, content->>'title' as title from dir_entries
      where status = 'live' and slot like $1 order by (kind = 'alert') desc, coalesce(score, (quality->>'score')::int, 0) desc, published_at limit 1`, [day + '%'])
  if (!best) return null
  // claim the day first, so two runs never share twice
  const claim = await one("update dir_settings set fb_last = $1 where id = 1 and (fb_last is null or fb_last <> $1::date) returning 1", [day])
  if (!claim) return null
  try {
    const id = await sharePostLink({ link: SITE + pathOf(best), message: `${KIND_NAME[best.kind]}: ${best.title || best.name}\n\n${best.one || ''}` })
    return id ? { shared: best.slug, id } : null
  } catch (e) { return { error: e.message } }
}

// Keep the next day's posts ready, one at a time: what the day's plan still needs, by kind. Also reads the news sources
// every 3 hours. Posts nobody published while fresh (updates older than 3 days) are put aside.
export async function prepareNext({ deadlineMs = 30000 } = {}) {
  const t0 = Date.now(), st = await dirSettings()
  if (!st.times.length) return null
  await q("update dir_entries set status = 'draft', quality = quality || '{\"stale\": true}'::jsonb where status = 'ready' and kind = 'update' and created_at < now() - interval '3 days'")
  const newsKinds = st.kinds.filter((k) => k !== 'tool')
  if (newsKinds.length && (!st.gathered_at || Date.now() - new Date(st.gathered_at).getTime() > 3 * 3600e3)) {
    const g = await gatherFinds().catch((e) => ({ error: e.message })); return { gathered: g }
  }
  // a safety net: when many posts fail their checks in a day, it stops writing until tomorrow (and the screen shows why)
  const failed = (await one("select count(*)::int n from dir_entries where created_at > now() - interval '1 day' and status in ('draft', 'blocked')")).n
  if (failed >= st.times.length * 2 + 2) return { skipped: 'many posts failed their checks today' }
  const ready = Object.fromEntries((await q("select kind, count(*)::int n from dir_entries where status = 'ready' group by kind")).rows.map((r) => [r.kind, r.n]))
  const need = {}; st.times.forEach((_, i) => { const k = planFor(i, st.kinds); need[k] = (need[k] || 0) + 1 })
  // a strong safety alert is written as soon as it's found
  const order = [...(st.kinds.includes('alert') ? ['alert'] : []), ...Object.keys(need).filter((k) => (ready[k] || 0) < need[k])]
  for (const k of order) {
    if (Date.now() - t0 > deadlineMs) break
    if (k === 'alert') { const f = await one("select id from dir_finds where status = 'new' and kind = 'alert' and score >= 80 and (published_at is null or published_at > now() - interval '7 days') order by score desc limit 1"); if (f && (ready.alert || 0) < 1) return { wrote: await writePost(f.id) } ; continue }
    if (k === 'tool') {
      const i = await one(`select i.id from yt_ideas i left join dir_entries d on d.idea_id = i.id where i.status in ('new', 'picked', 'made') and i.score >= 55 and d.id is null
        order by exists (select 1 from yt_scripts s where s.idea_id = i.id and s.status in ('approved', 'rendering', 'rendered', 'uploaded')) desc, (i.status = 'made') desc, i.score desc, i.id desc limit 1`)
      if (i) return { wrote: await writeEntry(i.id, { schedule: true }) }
      continue
    }
    const f = (await nextFind(k)) || (k === 'guide' && st.kinds.includes('alert') ? await nextFind('alert') : null)
    if (f) return { wrote: await writePost(f.id) }
  }
  return null
}

// The frequent run (every 10 minutes): publish what's due and share the day's best always; write only when it's idle.
export async function directoryTick({ idle = true, deadlineMs = 30000 } = {}) {
  const out = {}
  try { const p = await publishDue(); if (p) out.published = p } catch (e) { out.error = 'publish: ' + e.message }
  try { const s = await shareBest(); if (s) out.shared = s } catch (e) { out.error = 'share: ' + e.message }
  if (idle) { try { const w = await prepareNext({ deadlineMs }); if (w) Object.assign(out, w) } catch (e) { out.error = 'write: ' + e.message } }
  return Object.keys(out).length ? out : null
}

// For the screens: today's times with what went (or goes) out, what's ready, and the week's visitors.
export async function directoryToday(now = Date.now()) {
  const st = await dirSettings(), day = lagosDay(now)
  const live = (await q("select slot, kind, slug, name, views from dir_entries where slot like $1", [day + '%'])).rows
  const ready = (await q("select kind, count(*)::int n from dir_entries where status = 'ready' group by kind")).rows
  const times = st.times.map((t, i) => { const e = live.find((x) => x.slot === day + ' ' + t), past = now >= slotMs(day, t) + 3 * 3600e3
    return { time: t, plan: planFor(i, st.kinds), state: e ? 'live' : past ? 'missed' : 'next', ...(e ? { kind: e.kind, slug: e.slug, name: e.name, path: pathOf(e), views: e.views } : {}) } })
  const week = await one(`select coalesce(sum(views), 0)::int as views, coalesce(sum(leads), 0)::int as leads from dir_daily where day > (now() at time zone 'Africa/Lagos')::date - 7`)
  const top = (await q(`select d.slug, d.kind, d.name, sum(x.views)::int as views from dir_daily x join dir_entries d on d.slug = x.slug where x.day > (now() at time zone 'Africa/Lagos')::date - 7 group by d.slug, d.kind, d.name order by views desc limit 3`)).rows
    .map((r) => ({ ...r, path: pathOf(r) }))
  const counts = Object.fromEntries((await q("select kind, count(*)::int n from dir_entries where status = 'live' group by kind")).rows.map((r) => [r.kind, r.n]))
  return { times, ready: Object.fromEntries(ready.map((r) => [r.kind, r.n])), week, top, counts, settings: { perDay: st.times.length, autoPublish: st.auto_publish, kinds: st.kinds, fbShare: st.fb_share, google: st.google || null, slots: st.times } }
}
export async function saveSimpleSettings({ perDay, kinds, fbShare, autoPublish }) {
  if (perDay != null) await q('update dir_settings set per_day = $1 where id = 1', [Math.max(0, Math.min(7, Number(perDay) || 0))])
  if (Array.isArray(kinds)) { const k = kinds.filter((x) => KINDS.includes(x)); if (!k.length) throw new DirError('Keep at least one kind on.'); await q('update dir_settings set kinds = $1 where id = 1', [k.join(',')]) }
  if (typeof fbShare === 'boolean') await q('update dir_settings set fb_share = $1 where id = 1', [fbShare])
  if (typeof autoPublish === 'boolean') await q('update dir_settings set auto_publish = $1 where id = 1', [autoPublish])
  return { ok: true }
}
// "Publish one now" (the simple screen): the oldest ready post goes live at once, outside the day's times.
export async function publishNow(now = Date.now()) {
  const pick = await one("select id, slug, kind, name from dir_entries where status = 'ready' order by (kind = 'alert') desc, created_at limit 1"); if (!pick) return null
  const slot = lagosDay(now) + ' now ' + new Date(now + LAGOS).toISOString().slice(11, 16)
  const r = await one("update dir_entries set status = 'live', slot = $2, published_at = now(), updated_at = now() where id = $1 and status = 'ready' returning id", [pick.id, slot]); if (!r) return null
  refresh(pick.slug, pick.kind); await announce([SITE + pathOf(pick)])
  return { slug: pick.slug, kind: pick.kind, name: pick.name, path: pathOf(pick) }
}
