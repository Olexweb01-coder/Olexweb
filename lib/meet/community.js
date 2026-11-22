// Olexweb Meet's reasons to come back (Install C): achievements (badges), rewards (free Pro days, each given once),
// hosting streaks, a monthly leaderboard with a spotlight for the winners, invite links (both people get a month of
// Pro when the new person hosts their first meeting), public host profiles and following a host.
// Nobody appears on a profile page or a leaderboard unless they turned "Show me publicly" on.
import 'server-only'
import { randomBytes } from 'node:crypto'
import { q, one } from './db'
import { Refused } from '@/lib/admin/content'
import { notice } from './plans'

const iso = (d) => (d ? new Date(d).toISOString() : null)
const clean = (s, n) => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, n)
const monthKey = (d = new Date()) => d.toISOString().slice(0, 7)

// ---------- rewards: free Pro days, each one given once (the ref makes it so) ----------
export async function reward(userId, ref, days, title, body) {
  const r = await one('insert into meet_rewards (user_id, ref, days) values ($1, $2, $3) on conflict do nothing returning user_id', [userId, ref, days])
  if (!r) return false
  await q("update meet_users set pro_until = greatest(coalesce(pro_until, now()), now()) + ($2 || ' days')::interval where id = $1", [userId, String(days)])
  await notice(userId, title, body)
  return true
}

// ---------- achievements ----------
export const BADGES = [
  ['first', 'First meeting', 'Hosted your first meeting'], ['ten', '10 meetings', 'Hosted 10 meetings'], ['fifty', '50 meetings', 'Hosted 50 meetings'],
  ['hours10', '10 hours', '10 hours of meetings hosted'], ['hours100', '100 hours', '100 hours of meetings hosted'],
  ['crowd', 'Big room', 'A meeting with 50 or more people'], ['star', '5-star host', 'Rated 4.8 or more from 10 ratings'],
  ['loved', 'Loved', '10 written reviews from guests'], ['streak', 'On a roll', 'Hosted 4 weeks in a row'], ['winner', 'Host of the month', 'Top of a monthly leaderboard'],
  // Install 58
  ['public', 'On the map', 'Turned your public profile on'], ['invite', 'Connector', 'Someone you invited hosted their first meeting'], ['sale', 'First sale', 'Someone paid you on Olexweb Meet'],
  ['mentor', 'Mentor', 'Held your first one-on-one session'], ['member', 'Community', 'Your first member joined'],
].map(([id, name, desc]) => ({ id, name, desc }))
async function hostStats(userId) {
  return one(`select count(*)::int as meetings, coalesce(max(joins), 0)::int as biggest,
      (select coalesce(round(sum(extract(epoch from (coalesce(u.left_at, now()) - u.joined_at))) / 60), 0)::int from meet_usage u where u.identity like 'h\\_%' and u.code in (select code from meetings where host_user = $1)) as minutes,
      (select round(avg(stars)::numeric, 2)::float from meet_ratings r where not r.host and r.code in (select code from meetings where host_user = $1)) as rating,
      (select count(*)::int from meet_ratings r where not r.host and r.code in (select code from meetings where host_user = $1)) as ratings,
      (select count(*)::int from meet_ratings r where not r.host and r.review is not null and r.code in (select code from meetings where host_user = $1)) as reviews
    from meetings where host_user = $1 and started_at is not null`, [userId])
}
// weeks in a row with at least one hosted meeting (this week counts once there is one; until then, up to last week)
export async function streakOf(userId) {
  const weeks = (await q("select distinct date_trunc('week', started_at) as w from meetings where host_user = $1 and started_at is not null order by w desc limit 60", [userId])).rows.map((r) => r.w.getTime())
  if (!weeks.length) return 0
  const wk = 7 * 864e5, thisWeek = (await one("select date_trunc('week', now()) as w")).w.getTime()
  let at = weeks[0] === thisWeek ? thisWeek : thisWeek - wk, n = 0
  for (const w of weeks) { if (w === at) { n++; at -= wk } else if (w < at) break }
  return n
}
// quiet: no notice per badge (the first sign-in after Install 58 unlocks past achievements in one celebration)
export async function checkBadges(userId, { quiet = false } = {}) {
  if (!userId) return []
  const s = await hostStats(userId), streak = await streakOf(userId), earned = []
  const x = await one(`select (select public and handle is not null from meet_users where id = $1) as pub, exists (select 1 from meet_users where referred_by = $1 and ref_done) as inv,
      exists (select 1 from meet_payments p left join meetings m on m.code = p.code where p.status = 'paid' and p.kind in ('ticket', 'booking', 'bundle', 'membership', 'cert') and (p.host_user = $1 or m.host_user = $1)) as sale,
      exists (select 1 from meet_bookings where mentor = $1 and status = 'confirmed' and starts_at < now()) as mentor, exists (select 1 from meet_members where host_user = $1 and status <> 'pending') as mem`, [userId])
  const want = { first: s.meetings >= 1, ten: s.meetings >= 10, fifty: s.meetings >= 50, hours10: s.minutes >= 600, hours100: s.minutes >= 6000,
    crowd: s.biggest >= 50, star: s.ratings >= 10 && s.rating >= 4.8, loved: s.reviews >= 10, streak: streak >= 4,
    public: !!x.pub, invite: !!x.inv, sale: !!x.sale, mentor: !!x.mentor, member: !!x.mem }
  for (const b of BADGES) if (want[b.id]) {
    const r = await one('insert into meet_badges (user_id, badge) values ($1, $2) on conflict do nothing returning badge', [userId, b.id])
    if (r) { earned.push(b.id); if (!quiet) await notice(userId, `New badge: ${b.name}`, b.desc + '. It shows on your dashboard and your profile.') }
  }
  const n = (await one('select count(*)::int as n from meet_badges where user_id = $1', [userId])).n
  for (let k = 5; k <= n; k += 5) await reward(userId, 'badges' + k, 30, `${k} badges: a month of Pro`, `You’ve earned ${k} badges. Here’s a month of Pro, free.`)
  if (streak >= 4 && streak % 4 === 0) await reward(userId, 'streak:' + (await one("select date_trunc('week', now())::date::text as w")).w, 7, `${streak} weeks in a row 🔥`, 'You’ve hosted every week. Here’s a week of Pro, free.')
  return earned
}

// ---------- the leaderboard (public profiles only) ----------
export const BOARDS = [['hours', 'Most hours hosted'], ['biggest', 'Biggest meeting'], ['rated', 'Best rated (5+ ratings)'], ['loved', 'Most 5-star reviews']]
export async function leaderboard(month = monthKey(), top = 10) {
  const from = month + '-01', P = "u.public and u.handle is not null and u.banned_at is null and m.started_at >= $1::date and m.started_at < ($1::date + interval '1 month')"
  const run = (sql) => q(sql, [from]).then((r) => r.rows.map((x) => ({ name: x.name, handle: x.handle, picture: x.picture, value: Number(x.v) })))
  const [hours, biggest, rated, loved] = await Promise.all([
    run(`select u.name, u.handle, u.picture, round(sum(extract(epoch from (coalesce(g.left_at, now()) - g.joined_at))) / 3600, 1) as v from meetings m join meet_users u on u.id = m.host_user
      join meet_usage g on g.code = m.code and g.identity like 'h\\_%' where ${P} group by u.id having sum(extract(epoch from (coalesce(g.left_at, now()) - g.joined_at))) > 600 order by v desc limit ${top}`),
    run(`select u.name, u.handle, u.picture, max(m.joins) as v from meetings m join meet_users u on u.id = m.host_user where ${P} group by u.id having max(m.joins) >= 2 order by v desc limit ${top}`),
    run(`select u.name, u.handle, u.picture, round(avg(r.stars)::numeric, 2) as v from meetings m join meet_users u on u.id = m.host_user join meet_ratings r on r.code = m.code and not r.host
      where ${P} group by u.id having count(r.*) >= 5 order by v desc, count(r.*) desc limit ${top}`),
    run(`select u.name, u.handle, u.picture, count(*) as v from meetings m join meet_users u on u.id = m.host_user join meet_ratings r on r.code = m.code and not r.host and r.stars = 5 and r.review is not null
      where ${P} group by u.id order by v desc limit ${top}`),
  ])
  return { month, hours, biggest, rated, loved }
}
// on the 1st: last month's winners get a month of Pro, the badge, and the spotlight on the Meet home page
export async function monthlyAwards() {
  const d = new Date(), last = monthKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)))
  const s = await one('select awards from meet_settings where id = 1'), awards = (s && s.awards) || {}
  if (awards[last]) return null
  const lb = await leaderboard(last, 1), winners = {}
  for (const [k, label] of BOARDS) {
    const w = lb[k][0]; if (!w) continue
    winners[k] = { ...w, label }
    const u = await one('select id from meet_users where handle = $1', [w.handle]); if (!u) continue
    await one("insert into meet_badges (user_id, badge) values ($1, 'winner') on conflict do nothing returning badge", [u.id])
    await reward(u.id, `winner:${last}:${k}`, 30, `You topped “${label}” 🏆`, 'You’re in the spotlight on Olexweb Meet this month, with a month of Pro, free.')
  }
  const amb = await (await import('./payouts')).ambassador(last).catch(() => null)   // Install 58: the top inviter
  if (amb && amb.handle) winners.ambassador = { name: amb.name, handle: amb.handle, value: amb.invites, label: 'Ambassador of the month' }
  await q("update meet_settings set awards = awards || jsonb_build_object($1::text, $2::jsonb) where id = 1", [last, JSON.stringify(winners)])
  return winners
}
export async function spotlight() {
  const s = await one('select awards from meet_settings where id = 1').catch(() => null), a = (s && s.awards) || {}
  const k = Object.keys(a).sort().pop()
  return k && Object.keys(a[k]).length ? { month: k, winners: a[k] } : null
}

// ---------- invites ----------
export async function refCode(userId) {
  const u = await one('select ref_code from meet_users where id = $1', [userId])
  if (u && u.ref_code) return u.ref_code
  for (let i = 0; i < 5; i++) {
    const c = randomBytes(5).toString('base64url').replace(/[-_]/g, 'x').slice(0, 7).toLowerCase()
    const r = await one('update meet_users set ref_code = $2 where id = $1 and ref_code is null returning ref_code', [userId, c]).catch(() => null)
    if (r) return r.ref_code
  }
  return (await one('select ref_code from meet_users where id = $1', [userId])).ref_code
}
// a new account that came through someone's invite link (the meet_ref cookie)
export async function markReferred(userId, code) {
  const c = String(code || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12); if (!c) return
  const by = await one('select id from meet_users where ref_code = $1 and id <> $2', [c, userId]); if (!by) return
  await q("update meet_users set referred_by = $2 where id = $1 and referred_by is null and created_at > now() - interval '1 hour'", [userId, by.id])
}
// their first hosted meeting: both get a month of Pro (hosting is what makes an invite real)
export async function inviteDone(userId) {
  // Install 58: the inviter's rewards are now 30% of this person's Pro payments for 12 months, 5 invites in 15 days = a week of
  // Pro and the spotlight, and the Ambassador of the month (lib/meet/payouts.js). The new person still gets their month.
  const u = await one('update meet_users set ref_done = true, ref_done_at = now() where id = $1 and referred_by is not null and not ref_done returning referred_by, name', [userId]); if (!u) return
  await reward(userId, 'invited', 30, 'A month of Pro, on your friend', 'You joined through an invite and hosted your first meeting. Enjoy a month of Pro, free.')
  await notice(u.referred_by, `${u.name || 'Your friend'} hosted their first meeting`, 'That counts as an invite. You earn 30% of their Pro payments for their first year, and 5 invites in 15 days gives you a week of Pro.')
  await (await import('./payouts')).inviteCounted(u.referred_by).catch(() => {})
}

// ---------- profiles and following ----------
const HANDLE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/
const RESERVED = new Set(['admin', 'olexweb', 'meet', 'api', 'support', 'help', 'login', 'leaders', 'pro', 'pricing', 'book', 'about', 'aoc', 'cookies', 'doc', 'guides', 'insights', 'me', 'media', 'olex-ai', 'olex-runner', 'portfolio', 'preview', 'privacy', 'review', 'services', 'start', 'stories', 'terms', 'tools', 'updates', 'ventures', 'work-with-me', 'alerts', 'studio', 'blog', 'mentors', 'v', 'l', 'b', 'join', 'features', 'for', 'earn'])
export async function saveProfile(user, { handle, bio, public: pub }) {
  const h = String(handle || '').trim().toLowerCase()
  if (h && !HANDLE.test(h)) throw new Refused('Your profile name: 3 to 30 letters, numbers or dashes.')
  if (h && RESERVED.has(h) && !(h === 'olexweb' && user.role === 'owner')) throw new Refused(`“${h}” is kept for Olexweb’s own pages. Try another, like ${h}-${String(user.name || 'me').split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'me'}.`)
  if (pub && !h) throw new Refused('Choose a profile name to show your profile.')
  try { await q('update meet_users set handle = $2, bio = $3, public = $4 where id = $1', [user.id, h || null, clean(bio, 300) || null, !!pub]) }
  catch (e) { if (/unique|duplicate/i.test(String(e.message))) throw new Refused('That profile name is taken. Try another.'); throw e }
  return { ok: true }
}
export async function profile(handle, viewer = null) {
  const u = await one('select id, name, picture, bio, handle, public, created_at, booking, banner, banner_data is not null as banner_img, mentor, membership, payout is not null as sells from meet_users where lower(handle) = lower($1) and banned_at is null', [String(handle || '').slice(0, 40)])
  if (!u || !u.public) return null
  const [s, badges, reviews, upcoming, followers, following] = await Promise.all([hostStats(u.id),
    q('select badge, earned_at from meet_badges where user_id = $1 order by earned_at', [u.id]).then((r) => r.rows),
    q(`select r.stars, r.review, r.created_at from meet_ratings r join meetings m on m.code = r.code where m.host_user = $1 and not r.host and r.review is not null order by r.created_at desc limit 8`, [u.id]).then((r) => r.rows),
    q('select title, starts_at, mode from meetings where host_user = $1 and starts_at > now() and ended_at is null order by starts_at limit 5', [u.id]).then((r) => r.rows),
    one('select count(*)::int as n from meet_follows where host = $1', [u.id]),
    viewer ? one('select 1 from meet_follows where follower = $1 and host = $2', [viewer.id, u.id]) : null])
  return { id: u.id, name: u.name, picture: u.picture, bio: u.bio, handle: u.handle, since: iso(u.created_at), stats: { ...s, hours: Math.round((s.minutes / 60) * 10) / 10 }, streak: await streakOf(u.id),
    badges: badges.map((b) => ({ ...BADGES.find((x) => x.id === b.badge), at: iso(b.earned_at) })).filter((b) => b.id),
    reviews: reviews.map((r) => ({ stars: r.stars, review: r.review, at: iso(r.created_at) })), upcoming: upcoming.map((m) => ({ title: m.title, at: iso(m.starts_at), mode: m.mode })),
    followers: followers.n, following: !!following, mine: !!viewer && viewer.id === u.id, booking: !!(u.booking && u.booking.on),
    // Install 58: banner, the mentor bio (counted numbers), membership
    banner: u.banner || { kind: 'pattern', pattern: 'p1' }, bannerImg: !!u.banner_img, level: (await import('./levels')).levelOf((await import('./levels')).xpOf({ meetings: s.meetings, minutes: s.minutes, people: (await one('select coalesce(sum(joins), 0)::int as n from meetings where host_user = $1 and started_at is not null', [u.id])).n, badges: badges.length, ratings: s.ratings, streakWeeks: await streakOf(u.id) })),
    mentor: u.mentor && u.mentor.on ? { headline: u.mentor.headline, help: u.mentor.help || [], niche: u.mentor.niche, city: u.mentor.city, years: u.mentor.years, tags: u.mentor.tags || [], ...((await (await import('./mentors')).counted([u.id]))[u.id] || {}) } : null,
    membership: u.membership && u.membership.on && u.sells ? { price: u.membership.price, perMonth: u.membership.perMonth } : null,
    session: u.booking && u.booking.on ? { title: u.booking.title, price: u.booking.price || 0, minutes: u.booking.minutes } : null }
}
export async function follow(user, handle, on) {
  const h = await one('select id, public from meet_users where lower(handle) = lower($1)', [String(handle || '').slice(0, 40)])
  if (!h || !h.public) throw new Refused('That profile isn’t available.', 404)
  if (h.id === user.id) throw new Refused('That’s you.')
  if (on) await q('insert into meet_follows (follower, host) values ($1, $2) on conflict do nothing', [user.id, h.id])
  else await q('delete from meet_follows where follower = $1 and host = $2', [user.id, h.id])
  return { ok: true, following: !!on }
}
// a host scheduled a meeting: their followers are told (in their dashboard)
export async function tellFollowers(hostId, { title, startsAt, link }) {
  const h = await one('select name, public from meet_users where id = $1', [hostId]); if (!h || !h.public) return 0
  const f = (await q('select follower from meet_follows where host = $1 limit 2000', [hostId])).rows
  const when = new Date(startsAt).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' })
  for (const r of f) await notice(r.follower, `${h.name} scheduled “${title}”`, `${when} (Lagos time). Join with the link when it starts.`, link)
  return f.length
}

// ---------- the dashboard's community part ----------
export async function myCommunity(user, origin) {
  const [u, s, streak, mine, month, lb, spot, followers] = await Promise.all([
    one('select handle, bio, public from meet_users where id = $1', [user.id]), hostStats(user.id), streakOf(user.id),
    q('select badge from meet_badges where user_id = $1', [user.id]).then((r) => new Set(r.rows.map((x) => x.badge))),
    one(`select count(*)::int as meetings, coalesce(sum(joins), 0)::int as people,
      (select round(avg(r.stars)::numeric, 1)::float from meet_ratings r join meetings m2 on m2.code = r.code where m2.host_user = $1 and not r.host and r.created_at > date_trunc('month', now())) as rating
      from meetings where host_user = $1 and started_at > date_trunc('month', now())`, [user.id]),
    leaderboard(monthKey(), 3), spotlight(), one('select count(*)::int as n from meet_follows where host = $1', [user.id])])
  return { handle: (u && u.handle) || '', bio: (u && u.bio) || '', public: !!(u && u.public), streak, followers: followers.n,
    badges: BADGES.map((b) => ({ ...b, earned: mine.has(b.id) })), hours: Math.round((s.minutes / 60) * 10) / 10,
    recap: { month: monthKey(), ...month }, leaderboard: lb, spotlight: spot, invite: `${origin}/?ref=${await refCode(user.id)}` }
}
