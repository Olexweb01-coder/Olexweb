// The Olexweb Directory: every useful website the research engine finds becomes a page at olexweb.com/tools/<slug>,
// written under the editorial rulebook, checked in code (every fact quoted from the site), published, and announced
// to search engines at once (IndexNow + sitemap). Runs by itself from the autopilot; managed from Admin → Directory.
import 'server-only'
import { createHash } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { q, one } from '@/lib/admin/db'
import { safeFetch, pageText } from '@/lib/assistant/net'
import { askJSON } from '@/lib/assistant/llm'
import { RULEBOOK, checkEntry } from './editorial'

export const SITE = 'https://olexweb.com'
export class DirError extends Error {}
const refresh = (slug) => { try { revalidatePath('/tools'); if (slug) revalidatePath('/tools/' + slug) } catch {} }
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
export async function writeEntry(ideaId, { publish } = {}) {
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
  const live = check.ok && (publish ?? (st ? st.auto_publish : true))
  const slug = await saveDraft(idea, e, check, live ? 'live' : (e.unsafe ? 'blocked' : 'draft'))
  if (live) await announce([SITE + '/tools/' + slug])
  return { ok: check.ok, slug, live, problems: check.problems }
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
    order by (i.status = 'made') desc, i.score desc, i.id desc limit $1`, [max])).rows
  const out = []
  for (const i of ideas) { if (Date.now() - t0 > deadlineMs) break; try { out.push(await writeEntry(i.id)) } catch (e) { out.push({ ok: false, why: e.message }) } }
  return { wrote: out.length, live: out.filter((x) => x.live).length, results: out }
}

// ---------- public side ----------
export async function liveEntries() { return (await q("select slug, name, category, content->>'oneLiner' as one, content->'pricing'->>'status' as price, content->'tags' as tags, published_at from dir_entries where status = 'live' order by published_at desc limit 2000")).rows.map((r) => ({ ...r, published_at: r.published_at && r.published_at.toISOString() })) }
export async function entryBySlug(slug) {
  const e = await one("select d.*, s.yt_video_id, s.upload, v.privacy from dir_entries d left join yt_scripts s on s.idea_id = d.idea_id and s.status = 'uploaded' left join yt_videos v on v.video_id = s.yt_video_id where d.slug = $1 and d.status = 'live'", [String(slug)])
  if (!e) return null
  const isPublic = String((e.upload && e.upload.privacy) || e.privacy || '').startsWith('public')
  const related = (await q("select slug, name, content->>'oneLiner' as one, content->'pricing'->>'status' as price from dir_entries where status = 'live' and id <> $1 and (category = $2 or $2 is null) order by published_at desc limit 6", [e.id, e.category])).rows
  const offer = await currentOffer()
  return { slug: e.slug, name: e.name, url: e.url, category: e.category, content: e.content, published_at: e.published_at && e.published_at.toISOString(), updated_at: e.updated_at.toISOString(), video: isPublic ? e.yt_video_id : null, related, offer }
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
  const rows = (await q("select id, slug, name, url, category, status, quality, views, leads, created_at, published_at from dir_entries order by coalesce(published_at, created_at) desc limit 1000")).rows
  const st = await one('select per_day, auto_publish, last_ping from dir_settings where id = 1')
  const waiting = (await one("select count(*)::int n from yt_ideas i left join dir_entries d on d.idea_id = i.id where i.status in ('new','picked','made') and i.score >= 55 and d.id is null")).n
  const week = (await q("select day, sum(views)::int as views, sum(leads)::int as leads from dir_daily where day > (now() at time zone 'Africa/Lagos')::date - 14 group by day order by day")).rows
  return { entries: rows.map((r) => ({ ...r, created_at: r.created_at.toISOString(), published_at: r.published_at && r.published_at.toISOString() })), settings: st, waiting, week: week.map((w) => ({ ...w, day: w.day.toISOString().slice(0, 10) })) }
}
export async function setStatus(id, status) {
  const e = await one('select slug, quality, content from dir_entries where id = $1', [Number(id)]); if (!e) throw new DirError('Unknown page.')
  if (status === 'live' && !(e.quality && e.quality.ok)) throw new DirError('This page didn’t pass the quality checks. Rewrite it first.')
  await q("update dir_entries set status = $2, published_at = case when $2 = 'live' then coalesce(published_at, now()) else published_at end, updated_at = now() where id = $1", [Number(id), status])
  refresh(e.slug); if (status === 'live') await announce([SITE + '/tools/' + e.slug]); return { ok: true }
}
export async function rewrite(id) { const e = await one('select idea_id from dir_entries where id = $1', [Number(id)]); if (!e || !e.idea_id) throw new DirError('Unknown page.'); return writeEntry(e.idea_id) }
export async function removeEntry(id) { const e = await one('delete from dir_entries where id = $1 returning slug', [Number(id)]); if (e) refresh(e.slug); return { ok: true } }
export async function saveSettings({ perDay, autoPublish }) {
  await q('update dir_settings set per_day = $1, auto_publish = $2 where id = 1', [Math.max(0, Math.min(50, Number(perDay) || 0)), autoPublish !== false]); return { ok: true }
}
