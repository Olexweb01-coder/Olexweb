// Find a mentor (Install 58): a public directory of hosts who take one-on-one bookings and chose to be listed. A booking
// that starts from the directory pays Olexweb 10% (we brought the client); bookings from the host's own links stay 5%.
// Every number on a listing is counted by Olexweb Meet (people taught, sessions held, ratings), never typed by the host.
import 'server-only'
import { q, one } from './db'
import { Refused } from '@/lib/admin/content'
import { PCT } from './money'

const clean = (s, n) => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, n)
export const NICHES = ['Design', 'Tech and coding', 'Business', 'Marketing', 'Careers', 'Finance', 'Writing', 'Languages', 'Music and arts', 'Health and fitness', 'Faith', 'School and exams', 'Other']

export async function saveListing(user, b) {
  const on = !!b.on, niche = NICHES.includes(b.niche) ? b.niche : null
  const tags = (Array.isArray(b.tags) ? b.tags : []).map((t) => clean(t, 30)).filter(Boolean).slice(0, 6)
  const help = (Array.isArray(b.help) ? b.help : []).map((t) => clean(t, 140)).filter(Boolean).slice(0, 4)
  const headline = clean(b.headline, 90), city = clean(b.city, 40), years = Math.min(Math.max(Math.round(Number(b.years) || 0), 0), 60)
  if (on) {
    if (!(await (await import('./plans')).proById(user.id))) throw new Refused('Find a mentor lists Pro hosts. Go Pro to be listed.', 402)   // Install 58j
    const u = await one('select handle, public, booking from meet_users where id = $1', [user.id])
    if (!u.handle || !u.public) throw new Refused('Show your profile publicly first (Profile → Show me publicly).')
    if (!u.booking || !u.booking.on) throw new Refused('Open one-on-one bookings first, so people can book you from the directory.')
    if (!niche) throw new Refused('Choose your main area.')
    if (!headline) throw new Refused('Write one line about what you do (for example, “Product designer, 8 years”).')
    if (!help.length) throw new Refused('Add at least one way you can help.')
  }
  await q('update meet_users set mentor = $2 where id = $1', [user.id, JSON.stringify({ on, niche, tags, help, headline, city, years })])
  return { ok: true, pct: PCT.directory }
}
// counted numbers for a host (used by the directory and the public bio)
export async function counted(ids) {
  if (!ids.length) return {}
  const rows = (await q(`select u.id,
      (select count(distinct coalesce(lower(a.email), g.identity))::int from meet_usage g join meetings m on m.code = g.code left join meet_attendees a on a.identity = g.identity
        where m.host_user = u.id and g.identity not like 'h\\_%') as taught,
      (select count(*)::int from meet_bookings b where b.mentor = u.id and b.status = 'confirmed' and b.starts_at < now()) as sessions,
      (select round(avg(r.stars)::numeric, 1)::float from meet_ratings r join meetings m on m.code = r.code where m.host_user = u.id and not r.host) as rating,
      (select count(*)::int from meet_ratings r join meetings m on m.code = r.code where m.host_user = u.id and not r.host) as ratings
    from meet_users u where u.id = any($1)`, [ids])).rows
  return Object.fromEntries(rows.map((r) => [r.id, { taught: r.taught, sessions: r.sessions, rating: r.rating, ratings: r.ratings }]))
}
export async function directory({ niche = '', search = '', page = 0 } = {}) {
  const n = NICHES.includes(niche) ? niche : null, s = clean(search, 60).toLowerCase(), off = Math.max(0, Math.min(Number(page) || 0, 50)) * 24
  const { pricing, ownerEmails } = await import('./plans'), free = !(await pricing()).on, owners = free ? [] : await ownerEmails()   // Install 58j: Pro hosts only
  const rows = (await q(`select id, name, handle, picture, bio, mentor, booking from meet_users
    where ($4 or pro_until > now() or lower(email) = any($5::text[])) and public and handle is not null and banned_at is null and payout is not null and (mentor->>'on')::boolean and (booking->>'on')::boolean
      and ($1::text is null or mentor->>'niche' = $1) and ($2 = '' or lower(name || ' ' || coalesce(mentor->>'headline', '') || ' ' || coalesce(mentor->>'tags', '')) like '%' || $2 || '%')
    order by last_seen desc limit 24 offset $3`, [n, s.replace(/[%_\\]/g, ''), off, free, owners])).rows
  const c = await counted(rows.map((r) => r.id))
  return { niches: NICHES, pct: PCT.directory, mentors: rows.map((r) => ({ name: r.name, handle: r.handle, picture: r.picture, headline: r.mentor.headline, niche: r.mentor.niche, tags: r.mentor.tags || [],
    city: r.mentor.city || '', years: r.mentor.years || 0, price: (r.booking && r.booking.price) || 0, minutes: (r.booking && r.booking.minutes) || 45, ...c[r.id] }))
    .sort((a, b) => (b.ratings || 0) * (b.rating || 0) - (a.ratings || 0) * (a.rating || 0)) }
}
export async function listingOf(userId) {
  const u = await one('select mentor from meet_users where id = $1', [userId])
  return (u && u.mentor) || { on: false, niche: null, tags: [], help: [], headline: '', city: '', years: 0 }
}
