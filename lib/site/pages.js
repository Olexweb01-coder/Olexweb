// Pages & links: pages built from templates (webinar, event, audio course) at olexweb.com/<slug>, with name-only sign-up,
// the same slot stages as Anatomy of Creation, and short links (to WhatsApp or any website). All managed from the admin.
import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { q, one } from '@/lib/admin/db'
import { askJSON } from '@/lib/assistant/llm'

export class PageError extends Error {}
export const TYPES = ['webinar', 'event', 'audio']
// Addresses that already belong to the site (routes, files, the admin). A page or link can never take these.
export const RESERVED = new Set(('about admin aoc api apple-icon cookies favicon fonts insights me media not-found olex-runner portfolio privacy review robots sitemap start ' +
  'terms ventures work-with-me contact events lab olexweb studio teaching thinking vision work llms og olex site v2 blog login logout feed rss _next static public ' +
  'go p pages links help support home index www mail tools dir directory indexnow news guides').split(' '))
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/
const refresh = (slug) => { try { revalidatePath('/' + slug) } catch {} }
export const fewFrom = (goal) => Math.max(1, Math.round(goal * 0.6))
export const stageOf = (n, goal, accepting) => (!accepting ? 'closed' : n >= goal ? 'bonus' : n >= fewFrom(goal) ? 'few' : 'open')

export async function slugFree(slug, { pageId = null } = {}) {
  slug = String(slug || '').trim().toLowerCase()
  if (!SLUG.test(slug)) return { ok: false, why: 'Use lowercase letters, numbers and hyphens (2–50 characters).' }
  if (RESERVED.has(slug)) return { ok: false, why: 'That address is already part of your website.' }
  const p = await one('select id from pages where slug = $1', [slug]); if (p && p.id !== pageId) return { ok: false, why: 'Another page already uses that address.' }
  const l = await one('select slug from site_links where slug = $1', [slug]); if (l) return { ok: false, why: 'A short link already uses that address.' }
  return { ok: true, slug }
}

// ---------- the admin ----------
const clean = (v, n = 4000) => String(v == null ? '' : v).replace(/\u0000/g, '').slice(0, n)
const cleanPerson = (p) => ({ name: clean(p && p.name, 80), role: clean(p && p.role, 80), bio: clean(p && p.bio, 400), photo: clean(p && p.photo, 600) })
function cleanContent(type, c = {}) {
  const out = { title: clean(c.title, 140), kicker: clean(c.kicker, 80), tagline: clean(c.tagline, 300), intro: clean(c.intro, 1500), learnTitle: clean(c.learnTitle, 120),
    learn: (Array.isArray(c.learn) ? c.learn : String(c.learn || '').split('\n')).map((x) => clean(x, 200).trim()).filter(Boolean).slice(0, 10),
    whoFor: clean(c.whoFor, 400), cta: clean(c.cta, 40), host: cleanPerson(c.host || {}), speakers: (Array.isArray(c.speakers) ? c.speakers : []).slice(0, 8).map(cleanPerson).filter((s) => s.name),
    community: clean(c.community, 300), preview: clean(c.preview, 300), photo: clean(c.photo, 600),
    faq: (Array.isArray(c.faq) ? c.faq : []).slice(0, 8).map((f) => ({ q: clean(f && f.q, 200), a: clean(f && f.a, 800) })).filter((f) => f.q && f.a) }
  if (out.community && !/^https:\/\/(chat\.whatsapp\.com|wa\.me|whatsapp\.com|api\.whatsapp\.com)\//.test(out.community)) throw new PageError('The community link must be a WhatsApp link (https://chat.whatsapp.com/…).')
  if (type === 'webinar' || type === 'event') { out.when = clean(c.when, 20); out.minutes = Math.max(0, Math.min(1440, Number(c.minutes) || 0)) || null }
  if (type === 'webinar') out.platform = clean(c.platform, 80)
  if (type === 'event') { out.venue = clean(c.venue, 140); out.address = clean(c.address, 300); out.mapUrl = clean(c.mapUrl, 600) }
  if (type === 'audio') { out.parts = (Array.isArray(c.parts) ? c.parts : []).slice(0, 20).map((p) => ({ title: clean(p.title, 120), file: clean(p.file, 600), minutes: Number(p.minutes) || null, covers: clean(p.covers, 400) })).filter((p) => p.title && p.file)
    out.full = c.full && c.full.file ? { title: clean(c.full.title || 'Full course', 120), file: clean(c.full.file, 600) } : null }
  if (out.when && !/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(out.when)) throw new PageError('Give the date and time like 2026-11-14T19:00 (Lagos time).')
  return out
}
export async function listPages() {
  const pages = (await q(`select p.id, p.slug, p.type, p.status, p.goal, p.accepting, p.content->>'title' as title, p.content->>'when' as "when", p.updated_at,
      (select count(*)::int from page_signups s where s.page_id = p.id) as signups, (select count(*)::int from page_signups s where s.page_id = p.id and s.created_at > now() - interval '1 day') as today,
      (select count(*)::int from page_signups s where s.page_id = p.id and s.feedback is not null) as feedback
    from pages p order by p.updated_at desc`)).rows
  const aoc = await one("select (select count(*)::int from aoc_listeners) as joined, (select count(*)::int from aoc_listeners where feedback is not null) as feedback, s.goal, s.accepting from aoc_settings s where s.id = 1").catch(() => null)
  const links = (await q("select l.slug, l.phone, l.url, l.message, l.clicks, coalesce((select n from site_link_clicks c where c.slug = l.slug and c.day = (now() at time zone 'Africa/Lagos')::date), 0) as today from site_links l order by l.slug")).rows
  return { pages: pages.map((p) => ({ ...p, updated_at: p.updated_at.toISOString(), stage: stageOf(p.signups, p.goal, p.accepting) })), aoc, links }
}
export async function createPage(type) {
  if (!TYPES.includes(type)) throw new PageError('Choose a template.')
  let slug, n = 0; do { slug = `${type}-${Math.random().toString(36).slice(2, 7)}`; n++ } while (!(await slugFree(slug)).ok && n < 5)
  const r = await one("insert into pages (slug, type, content) values ($1, $2, $3) returning id", [slug, type, JSON.stringify({ title: '', host: { name: 'Olaitan Adebayo', role: 'Creative ideator', bio: '', photo: '/aoc/host.webp' } })])
  return { id: r.id }
}
export async function getPage(id) { const p = await one('select * from pages where id = $1', [Number(id)]); if (!p) throw new PageError('That page doesn’t exist.'); return p }
export async function savePage(id, { slug, content, goal }) {
  const p = await getPage(id), s = await slugFree(slug, { pageId: p.id }); if (!s.ok) throw new PageError(s.why)
  const c = cleanContent(p.type, content || {}), g = Math.max(1, Math.min(100000, Number(goal) || 100))
  await q('update pages set slug = $2, content = $3, goal = $4, updated_at = now() where id = $1', [p.id, s.slug, JSON.stringify(c), g])
  if (p.status === 'live') { refresh(s.slug); if (p.slug !== s.slug) refresh(p.slug) }
  return { ok: true, slug: s.slug }
}
export async function publishPage(id, live) {
  const p = await getPage(id), c = p.content || {}
  if (live) { const miss = []; if (!c.title) miss.push('a title'); if (!c.tagline) miss.push('a tagline'); if ((p.type === 'webinar' || p.type === 'event') && !c.when) miss.push('the date and time')
    if (p.type === 'event' && !c.venue) miss.push('the venue'); if (p.type === 'audio' && !(c.parts || []).length) miss.push('at least one recording')
    const ph = JSON.stringify(c).match(/\[add [^\]]+\]/); if (ph) miss.push(`the missing detail “${ph[0]}”`)
    if (miss.length) throw new PageError('Before publishing, add ' + miss.join(', ') + '.') }
  await q("update pages set status = $2, published_at = case when $2 = 'live' then coalesce(published_at, now()) else published_at end, updated_at = now() where id = $1", [p.id, live ? 'live' : 'draft'])
  refresh(p.slug); return { ok: true, status: live ? 'live' : 'draft' }
}
export async function deletePage(id) { const p = await getPage(id); await q('delete from pages where id = $1', [p.id]); refresh(p.slug); return { ok: true } }
export async function setAccepting(id, on) { const p = await getPage(id); await q('update pages set accepting = $2 where id = $1', [p.id, on === true]); refresh(p.slug); return { ok: true } }
export async function pageAdmin(id) {
  const p = await getPage(id), people = (await q('select id, name, progress, feedback, feedback_at, created_at, last_seen from page_signups where page_id = $1 order by created_at desc limit 5000', [p.id])).rows
  return { page: { ...p, created_at: p.created_at.toISOString(), updated_at: p.updated_at.toISOString(), published_at: p.published_at && p.published_at.toISOString() },
    people: people.map((x) => ({ ...x, created_at: x.created_at.toISOString(), last_seen: x.last_seen.toISOString(), feedback_at: x.feedback_at && x.feedback_at.toISOString() })), fewFrom: fewFrom(p.goal) }
}
export async function removeSignup(pageId, id) { const p = await getPage(pageId); await q('delete from page_signups where id = $1 and page_id = $2', [Number(id), p.id]); refresh(p.slug); return { ok: true } }

// ---------- short links ----------
export async function saveLink({ slug, phone, message, url, original }) {
  slug = String(slug || '').trim().toLowerCase(); const isNew = !original || original !== slug
  if (isNew) { const s = await slugFree(slug); if (!s.ok) throw new PageError(s.why) } else if (!SLUG.test(slug)) throw new PageError('Use lowercase letters, numbers and hyphens.')
  const ph = String(phone || '').replace(/\D/g, ''), u = String(url || '').trim()
  if (!ph && !u) throw new PageError('Give a WhatsApp number or a web address for the link to open.')
  if (ph && !/^\d{8,15}$/.test(ph)) throw new PageError('Give the WhatsApp number with its country code, digits only (like 2347011726321).')
  if (!ph && !/^https:\/\/[^\s]+$/.test(u)) throw new PageError('The web address must start with https://')
  if (original && original !== slug) await q('update site_links set slug = $2 where slug = $1', [original, slug])
  await q(`insert into site_links (slug, phone, message, url) values ($1, $2, $3, $4) on conflict (slug) do update set phone = $2, message = $3, url = $4, updated_at = now()`, [slug, ph || null, clean(message, 500), ph ? null : u])
  refresh(slug); return { ok: true, slug }
}
export async function deleteLink(slug) { if (slug === 'me') throw new PageError('olexweb.com/me is your main link; edit it instead.'); await q('delete from site_links where slug = $1', [slug]); refresh(slug); return { ok: true } }
export function linkTarget(l) { return l.phone ? `https://wa.me/${l.phone}${l.message ? '?text=' + encodeURIComponent(l.message) : ''}` : l.url }
export async function countTap(slug) {
  const r = await one('update site_links set clicks = clicks + 1 where slug = $1 returning slug', [slug]); if (!r) return
  await q(`insert into site_link_clicks (slug, day, n) values ($1, (now() at time zone 'Africa/Lagos')::date, 1) on conflict (slug, day) do update set n = site_link_clicks.n + 1`, [slug])
}

// ---------- the public side ----------
export async function publicBySlug(slug) {
  slug = String(slug || '').toLowerCase(); if (!SLUG.test(slug) || RESERVED.has(slug)) return null
  const p = await one("select id, slug, type, status, content, goal, accepting, (select count(*)::int from page_signups s where s.page_id = pages.id) as n from pages where slug = $1 and status = 'live'", [slug])
  if (p) { const c = { ...p.content }; delete c.community                                                  // given only after sign-up
    if (p.type === 'audio') c.parts = (c.parts || []).map((x) => ({ title: x.title, minutes: x.minutes, covers: x.covers })), c.full = c.full ? { title: c.full.title } : null   // files only after sign-up
    return { kind: 'page', page: { id: p.id, slug: p.slug, type: p.type, content: c, goal: p.goal, stage: stageOf(p.n, p.goal, p.accepting) } } }
  const l = await one('select slug, phone, url, message from site_links where slug = $1', [slug])
  return l ? { kind: 'link', slug: l.slug, target: linkTarget(l) } : null
}
async function livePage(id) { const p = await one("select * from pages where id = $1 and status = 'live'", [Number(id)]); if (!p) throw new PageError('This page isn’t available.'); return p }
function after(p) {                                   // what someone sees once signed up
  const c = p.content || {}
  return { community: c.community || null, ...(p.type === 'audio' ? { parts: c.parts || [], full: c.full || null } : {}) }
}
export async function join(pageId, { name, consent, ip }) {
  const p = await livePage(pageId), nm = String(name || '').replace(/\s+/g, ' ').trim()
  if (nm.length < 2 || nm.length > 60) throw new PageError('Please enter your name.')
  if (p.type === 'audio' && consent !== true) throw new PageError('Please tick the box to continue.')
  if (!p.accepting) throw new PageError('Sign-ups are closed for now.')
  const ipHash = createHash('sha256').update('page:' + ip + ':' + (process.env.AUTH_SECRET || '')).digest('hex')
  const r = await one("select count(*) filter (where created_at > now() - interval '1 hour')::int h from page_signups where ip_hash = $1", [ipHash])
  if (r.h >= 10) throw new PageError('Too many sign-ups from this connection. Try again later.')
  const n = (await one('select count(*)::int n from page_signups where page_id = $1', [p.id])).n, token = randomBytes(24).toString('base64url')
  await q('insert into page_signups (page_id, token, name, ip_hash) values ($1, $2, $3, $4)', [p.id, token, nm, ipHash])
  if (n + 1 === fewFrom(p.goal) || n + 1 === p.goal) refresh(p.slug)
  return { token, name: nm, ...after(p) }
}
export async function me(pageId, token) { const p = await livePage(pageId), s = await one('select name from page_signups where page_id = $1 and token = $2', [p.id, String(token || '')]); if (!s) throw new PageError('Not found.'); await q('update page_signups set last_seen = now() where token = $1', [String(token)]); return { name: s.name, ...after(p) } }
export async function track(pageId, token, part, event) {
  if (!['play', 'finish', 'download'].includes(event) || !/^[a-z0-9-]{1,24}$/.test(String(part))) throw new PageError('Request refused.')
  await q(`update page_signups set progress = jsonb_set(coalesce(progress, '{}'::jsonb), array[$3::text], coalesce(progress -> $3, '{}'::jsonb) || jsonb_build_object($4::text, now()::text), true), last_seen = now()
    where page_id = $1 and token = $2 and progress #> array[$3::text, $4::text] is null`, [Number(pageId), String(token || ''), String(part), event])
  return { ok: true }
}
export async function feedback(pageId, token, text) {
  const t = String(text || '').trim(); if (t.length < 3) throw new PageError('Write a little more.'); if (t.length > 3000) throw new PageError('Please keep it under 3000 characters.')
  const r = await one('update page_signups set feedback = $3, feedback_at = now() where page_id = $1 and token = $2 returning id', [Number(pageId), String(token || ''), t]); if (!r) throw new PageError('Not found.'); return { ok: true }
}

// ---------- AI writing: drafts and ✨ Suggest. Facts only from him; missing ones become [add …] ----------
const RULES = `You write landing-page copy for Olaitan Adebayo (Olexweb), a creative ideator and builder in Lagos, Nigeria.
Voice: warm, confident, plain English, short sentences, no hype, no buzzwords, no exclamation marks, no emojis.
NEVER invent facts: dates, times, prices, venues, platforms, links, speaker names, numbers of people, results or testimonials.
Use only facts given in the notes. If a needed fact is missing, write a placeholder like [add the date] or [add the venue] instead.`
const DRAFT = { type: 'object', properties: { title: { type: 'string' }, kicker: { type: 'string' }, tagline: { type: 'string' }, intro: { type: 'string' }, learnTitle: { type: 'string' },
  learn: { type: 'array', items: { type: 'string' } }, whoFor: { type: 'string' }, cta: { type: 'string' }, preview: { type: 'string' }, hostBio: { type: 'string' },
  faq: { type: 'array', items: { type: 'object', properties: { q: { type: 'string' }, a: { type: 'string' } }, required: ['q', 'a'] } },
  when: { type: 'string' }, minutes: { type: 'number' }, platform: { type: 'string' }, venue: { type: 'string' }, address: { type: 'string' } },
  required: ['title', 'kicker', 'tagline', 'intro', 'learnTitle', 'learn', 'whoFor', 'cta', 'preview', 'hostBio', 'faq'] }
const KIND = { webinar: 'a free online webinar', event: 'an in-person event', audio: 'a free audio course in short parts' }
export async function aiDraft(type, notes) {
  if (!TYPES.includes(type)) throw new PageError('Choose a template.'); const n = String(notes || '').trim(); if (n.length < 15) throw new PageError('Tell the AI a bit more about it first.')
  const d = await askJSON({ kind: 'write', temperature: 0.7, maxTokens: 2048, schema: DRAFT, system: RULES, prompt: `Draft the landing page for ${KIND[type]}.
Fields: title (2–6 words, memorable), kicker (2–5 words, small label above the title), tagline (one sentence, the promise), intro (2–3 sentences), learnTitle (short heading for the list),
learn (4–5 items, each one clear benefit, under 12 words), whoFor (one sentence), cta (button, 2–4 words), preview (link-preview text, under 150 characters), hostBio (one sentence about Olaitan for this topic),
faq (3 questions people would really ask, short answers). ${type !== 'audio' ? 'when: the date and time ONLY if given, as YYYY-MM-DDTHH:MM (Lagos time), else "". minutes: length only if given, else 0.' : ''}
${type === 'webinar' ? 'platform: only if given (e.g. Google Meet), else "".' : ''}${type === 'event' ? 'venue and address: only if given, else "".' : ''}
His notes:\n"""${n.slice(0, 4000)}"""` })
  return { title: d.title, kicker: d.kicker, tagline: d.tagline, intro: d.intro, learnTitle: d.learnTitle, learn: (d.learn || []).slice(0, 6), whoFor: d.whoFor, cta: d.cta, preview: d.preview, hostBio: d.hostBio,
    faq: (d.faq || []).slice(0, 5), when: /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(d.when || '') ? d.when : '', minutes: Number(d.minutes) || null, platform: d.platform || '', venue: d.venue || '', address: d.address || '' }
}
const FIELD = { title: 'the page title (2–6 words)', kicker: 'the small label above the title (2–5 words)', tagline: 'the tagline (one sentence, the promise)', intro: 'the intro (2–3 sentences)',
  learnTitle: 'the heading above the list of what people get', whoFor: 'who it’s for (one sentence)', cta: 'the button text (2–4 words)', preview: 'the link-preview text (under 150 characters)',
  bio: 'a one-line speaker introduction', faqA: 'an answer to the question' }
export async function aiSuggest(type, field, page, extra = '') {
  if (!FIELD[field]) throw new PageError('Request refused.')
  const d = await askJSON({ kind: 'write', temperature: 0.9, maxTokens: 800, system: RULES, schema: { type: 'object', properties: { options: { type: 'array', items: { type: 'string' } } }, required: ['options'] },
    prompt: `Suggest 3 different options for ${FIELD[field]} of this ${KIND[type] || 'page'}. Each must fit the rest of the page. Return {"options": [..3..]}.
The page so far:\n${JSON.stringify(page || {}).slice(0, 3000)}${extra ? '\nAbout this item: ' + String(extra).slice(0, 500) : ''}` })
  return { options: (d.options || []).map((x) => String(x).trim()).filter(Boolean).slice(0, 3) }
}
