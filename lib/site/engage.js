// Likes, saves, shares, reading and analytics. Server only.
// Privacy: no cookies and no addresses are stored. A reader is a one-way fingerprint that changes every day
// (a separate, stable one only remembers that someone liked an article, so they can like it once).
// Honesty: every number shown to readers is real; small ones stay hidden until they pass the owner's thresholds,
// and the thresholds are applied here, so hidden numbers never reach a reader's browser.
import 'server-only'
import { createHash } from 'node:crypto'
import { q, one } from '@/lib/admin/db'

const DAY = "(now() at time zone 'Africa/Lagos')::date"
const h = (s) => createHash('sha256').update(String(process.env.AUTH_SECRET || 'olexweb') + '|' + s).digest('hex').slice(0, 40)
const today = () => new Date(Date.now() + 3600e3).toISOString().slice(0, 10)             // Lagos is UTC+1
export const readerFp = (ip, ua) => h(`reader|${today()}|${ip}|${ua}`)
const likeFp = (ip, ua) => h(`like|${ip}|${ua}`)
export const isBot = (ua) => !ua || /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|lighthouse|python|curl|wget|httpclient|monitor/i.test(ua)
export const APPS = ['whatsapp', 'linkedin', 'facebook', 'x', 'copy', 'more']

export function source(ref, utm) {
  const u = String(utm || '').toLowerCase()
  if (u) { const m = { whatsapp: 'WhatsApp', wa: 'WhatsApp', linkedin: 'LinkedIn', x: 'X', twitter: 'X', facebook: 'Facebook', fb: 'Facebook', google: 'Google' }[u]; if (m) return m }
  let host = ''; try { host = new URL(ref).hostname.replace(/^www\./, '') } catch { return 'Direct' }
  if (!host || host.endsWith('olexweb.com') || host === 'localhost') return 'Direct'
  if (/(^|\.)google\./.test(host)) return 'Google'
  if (/whatsapp|wa\.me|l\.wl\.co/.test(host)) return 'WhatsApp'
  if (/linkedin|lnkd\.in/.test(host)) return 'LinkedIn'
  if (/(^|\.)t\.co$|(^|\.)x\.com$|twitter/.test(host)) return 'X'
  if (/facebook|fb\.com|fb\.me/.test(host)) return 'Facebook'
  if (/bing\.|duckduckgo|yahoo\./.test(host)) return 'Other search'
  return 'Other'
}

const bump = (postId, metric, key = '', by = 1) =>
  q(`insert into blog_daily (post_id, day, metric, key, n) values ($1, ${DAY}, $2, $3, $4)
     on conflict (post_id, day, metric, key) do update set n = blog_daily.n + excluded.n`, [postId, metric, key, by])
const once = async (postId, mark) => (await q(`insert into blog_seen (post_id, day, fp) values ($1, ${DAY}, $2) on conflict do nothing`, [postId, mark])).rowCount === 1

async function allowed(fp) {                                        // at most 60 actions per reader per 10 minutes
  const r = await one(`insert into blog_rate (fp, window_start, n) values ($1, date_trunc('hour', now()) + floor(extract(minute from now()) / 10) * interval '10 minutes', 1)
                       on conflict (fp, window_start) do update set n = blog_rate.n + 1 returning n`, [fp])
  if (Math.random() < 0.02) {                                      // tidy up now and then
    await q("delete from blog_rate where window_start < now() - interval '1 hour'")
    await q(`delete from blog_seen where day < ${DAY} - 1`)
    await q("delete from blog_reading where seen_at < now() - interval '10 minutes'")
  }
  return r.n <= 60
}

// A reader did something. Returns { ok } or { ok: false, reason } without revealing anything else.
export async function record({ slug, type, app, ref, utm }, ip, ua) {
  if (isBot(ua)) return { ok: true }                                  // bots: quietly not counted
  if (!/^[a-z0-9-]{1,90}$/.test(String(slug || ''))) return { ok: false, reason: 'unknown article' }
  const post = await one("select id from posts where slug = $1 and status = 'live'", [slug])
  if (!post) return { ok: false, reason: 'unknown article' }
  const fp = readerFp(ip, ua)
  if (!(await allowed(fp))) return { ok: false, reason: 'slow down' }
  const id = post.id
  if (type === 'view') {
    await bump(id, 'view')
    if (await once(id, fp)) { await bump(id, 'reader'); await bump(id, 'source', source(ref, utm)) }
  } else if (type === 'read') {
    if (await once(id, 'r:' + fp)) await bump(id, 'read')
  } else if (type === 'like') {
    const r = await q('insert into blog_likes (post_id, fp) values ($1, $2) on conflict do nothing', [id, likeFp(ip, ua)])
    if (r.rowCount === 1) { await q('update posts set likes = likes + 1 where id = $1', [id]); await bump(id, 'like') }
  } else if (type === 'unlike') {
    const r = await q('delete from blog_likes where post_id = $1 and fp = $2', [id, likeFp(ip, ua)])
    if (r.rowCount === 1) { await q('update posts set likes = greatest(likes - 1, 0) where id = $1', [id]); await bump(id, 'unlike') }
  } else if (type === 'save') {
    if (await once(id, 's:' + fp)) { await q('update posts set saves = saves + 1 where id = $1', [id]); await bump(id, 'save') }
  } else if (type === 'unsave') {
    if (await once(id, 'u:' + fp)) { await q('update posts set saves = greatest(saves - 1, 0) where id = $1', [id]); await bump(id, 'unsave') }
  } else if (type === 'share') {
    const a = APPS.includes(app) ? app : null
    if (!a) return { ok: false, reason: 'unknown app' }
    if (await once(id, `sh:${a}:` + fp)) await bump(id, 'share', a)
  } else return { ok: false, reason: 'unknown action' }
  return { ok: true }
}

// "Reading now": a check-in every 30 seconds while the article is open; counts people seen in the last minute.
export async function checkIn(slug, ip, ua) {
  if (isBot(ua) || !/^[a-z0-9-]{1,90}$/.test(String(slug || ''))) return 0
  const post = await one("select id from posts where slug = $1 and status = 'live'", [slug]); if (!post) return 0
  const fp = readerFp(ip, ua)
  if (!(await allowed(fp))) return null
  await q('insert into blog_reading (post_id, fp, seen_at) values ($1, $2, now()) on conflict (post_id, fp) do update set seen_at = now()', [post.id, fp])
  return Number((await one("select count(*)::int as n from blog_reading where post_id = $1 and seen_at > now() - interval '60 seconds'", [post.id])).n)
}

export const compact = (n) => (n >= 1e6 ? (n / 1e6).toFixed(n < 1e7 ? 1 : 0).replace(/\.0$/, '') + 'M' : n >= 1000 ? (n / 1000).toFixed(n < 1e4 ? 1 : 0).replace(/\.0$/, '') + 'k' : String(n))

// What readers may see: only numbers that passed the thresholds, and badges earned from real data.
// "Reads" = readers counted once per article per day (no tracking across days, so a returning reader counts again).
export async function publicStats(slugs) {
  const s = await one('select views_from, likes_from, reading_from, badges from blog_settings where id = 1')
  const posts = (await q(`select p.id, p.slug, p.likes, p.published_on,
      coalesce((select sum(n) from blog_daily d where d.post_id = p.id and d.metric = 'reader'), 0)::int as reads,
      coalesce((select sum(n) from blog_daily d where d.post_id = p.id and d.metric = 'reader' and d.day > ${DAY} - 7), 0)::int as week,
      coalesce((select sum(n) from blog_daily d where d.post_id = p.id and d.metric = 'reader' and d.day > ${DAY} - 3), 0)::int as last3,
      coalesce((select sum(n) from blog_daily d where d.post_id = p.id and d.metric = 'reader' and d.day <= ${DAY} - 3 and d.day > ${DAY} - 7), 0)::int as prev4,
      (select count(*) from blog_reading r where r.post_id = p.id and r.seen_at > now() - interval '60 seconds')::int as reading
    from posts p where p.status = 'live'`)).rows
  let most = null, trend = null
  if (s.badges) {
    const minWeek = Math.max(10, Math.ceil(s.views_from / 4))
    most = posts.filter((p) => p.week >= minWeek).sort((a, b) => b.week - a.week)[0] || null
    trend = posts.filter((p) => p !== most && p.last3 >= 20 && p.last3 / 3 > 1.5 * Math.max(p.prev4 / 4, 1)).sort((a, b) => b.last3 / 3 / Math.max(b.prev4 / 4, 1) - a.last3 / 3 / Math.max(a.prev4 / 4, 1))[0] || null
  }
  const out = {}
  for (const p of posts) {
    if (slugs && !slugs.includes(p.slug)) continue
    const fresh = p.published_on && (Date.now() - new Date(p.published_on)) < 7 * 86400e3
    out[p.slug] = {
      reads: p.reads >= s.views_from ? compact(p.reads) : null,       // readers once per article per day: refreshing never raises it
      likes: p.likes >= s.likes_from ? p.likes : null,
      reading: p.reading >= s.reading_from ? p.reading : null,
      badge: most && p.id === most.id ? 'Most read this week' : trend && p.id === trend.id ? 'Trending' : s.badges && fresh ? 'New' : null,
    }
  }
  const month = Number((await one(`select coalesce(sum(n), 0)::int as n from blog_daily where metric = 'reader' and day > ${DAY} - 30`)).n)
  return { posts: out, monthReads: month >= s.views_from ? month.toLocaleString('en-GB') : null }
}

// The owner's analytics for the last `days` days (and the same length before, to compare).
export async function analytics(days) {
  days = [7, 30, 90].includes(Number(days)) ? Number(days) : 30
  const sum = async (metric, from, to) => Number((await one(`select coalesce(sum(n), 0)::int as n from blog_daily where metric = $1 and day > ${DAY} - $2::int and day <= ${DAY} - $3::int`, [metric, from, to])).n)
  const totals = {}
  for (const m of ['view', 'reader', 'read', 'like', 'unlike', 'save', 'unsave', 'share']) totals[m] = await sum(m, days, 0)
  const before = await sum('view', days * 2, days)
  const series = (await q(`select to_char(g.day, 'YYYY-MM-DD') as day, coalesce(sum(d.n) filter (where d.metric = 'view'), 0)::int as views,
      exists (select 1 from posts p where p.status = 'live' and p.published_on = g.day) as launched
    from generate_series(${DAY} - ($1::int - 1), ${DAY}, interval '1 day') as g(day) left join blog_daily d on d.day = g.day group by g.day order by g.day`, [days])).rows
  const group = async (metric) => (await q(`select key, sum(n)::int as n from blog_daily where metric = $1 and day > ${DAY} - $2::int group by key order by n desc`, [metric, days])).rows
  const top = (await q(`select p.slug, p.title, p.origin, p.likes as likes_total,
      coalesce(sum(d.n) filter (where d.metric = 'view'), 0)::int as views, coalesce(sum(d.n) filter (where d.metric = 'read'), 0)::int as reads,
      coalesce(sum(d.n) filter (where d.metric = 'reader'), 0)::int as readers,
      coalesce(sum(d.n) filter (where d.metric = 'like'), 0)::int - coalesce(sum(d.n) filter (where d.metric = 'unlike'), 0)::int as likes,
      coalesce(sum(d.n) filter (where d.metric = 'save'), 0)::int - coalesce(sum(d.n) filter (where d.metric = 'unsave'), 0)::int as saves,
      coalesce(sum(d.n) filter (where d.metric = 'share'), 0)::int as shares
    from posts p left join blog_daily d on d.post_id = p.id and d.day > ${DAY} - $1::int where p.status = 'live'
    group by p.id order by views desc, p.published_on desc nulls last limit 20`, [days])).rows
  const side = (o) => { const r = top.filter((t) => (o === 'assistant') === (t.origin === 'assistant')); const v = r.reduce((a, t) => a + t.views, 0), rd = r.reduce((a, t) => a + t.reads, 0), lk = r.reduce((a, t) => a + Math.max(t.likes, 0), 0)
    return { articles: r.length, views: r.length ? Math.round(v / r.length) : 0, readRate: v ? Math.round((rd / v) * 100) : 0, likes: r.length ? Math.round(lk / r.length) : 0 } }
  const s = await one('select views_from, likes_from, reading_from, badges, testimonials from blog_settings where id = 1')
  const shown = (await one('select count(*)::int as n from posts p where p.status = \'live\' and coalesce((select sum(n) from blog_daily d where d.post_id = p.id and d.metric = \'reader\'), 0) >= $1', [s.views_from])).n
  const live = (await one("select count(*)::int as n from posts where status = 'live'")).n
  return { days, totals: { ...totals, likes: totals.like - totals.unlike, saves: totals.save - totals.unsave, viewsBefore: before }, series,
    sources: await group('source'), shares: await group('share'), top, you: side('person'), assistant: side('assistant'), settings: s, shown, live }
}

export async function saveSettings(d) {
  const n = (v, lo, hi) => { const x = Math.round(Number(v)); if (!Number.isFinite(x) || x < lo || x > hi) throw new Error(`Use a number from ${lo} to ${hi}.`); return x }
  await q('update blog_settings set views_from = $1, likes_from = $2, reading_from = $3, badges = $4, testimonials = $5, updated_at = now() where id = 1',
    [n(d.views_from, 0, 100000), n(d.likes_from, 0, 100000), n(d.reading_from, 2, 1000), d.badges === true, d.testimonials === true])
}
