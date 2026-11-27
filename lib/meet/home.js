// The new app's home (Install 58): one call brings the dashboard, community, level, celebrations to show, What's new,
// and nudges (reminders worked out from real data, never stored). Also the profile photo and banner.
import 'server-only'
import { q, one } from './db'
import { Refused } from '@/lib/admin/content'
import { xpOf, levelOf } from './levels'

const iso = (d) => (d ? new Date(d).toISOString() : null)
const lagosWeek = () => one("select (date_trunc('week', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos') as t").then((r) => r.t)

export async function homeData(user, origin) {
  const C = await import('./community'), { dashboard } = await import('./dash')
  const u = await one('select name, membership, welcomed, level_seen, news_seen, banner, photo_data is not null as photo, banner_data is not null as banner_img, picture, handle, bio, public, created_at from meet_users where id = $1', [user.id])
  await C.checkBadges(user.id, { quiet: !u.welcomed }).catch(() => [])          // first visit after Install 58: past achievements unlock together
  const [dash, comm] = await Promise.all([dashboard(user), C.myCommunity(user, origin)])
  const earned = comm.badges.filter((b) => b.earned)
  const lvl = levelOf(xpOf({ meetings: dash.stats.meetings, minutes: dash.stats.minutes, people: dash.stats.people, badges: earned.length, ratings: dash.stats.ratings, streakWeeks: comm.streak }))
  const unseen = (await q('select badge, earned_at from meet_badges where user_id = $1 and seen_at is null order by earned_at', [user.id])).rows
    .map((r) => ({ ...C.BADGES.find((b) => b.id === r.badge), at: iso(r.earned_at) })).filter((b) => b.id)
  const newsRows = (await q('select id, title, body, created_at from meet_news where id > $1 order by id desc limit 6', [u.news_seen])).rows   // Install 60: every update they haven't read (up to 6), newest first
  const celebrate = { welcome: !u.welcomed, badges: unseen, level: u.welcomed && lvl.level > u.level_seen && u.level_seen > 0 ? lvl.level : null }
  if (u.level_seen === 0) await q('update meet_users set level_seen = $2 where id = $1 and level_seen = 0', [user.id, lvl.level])   // no "level up" for levels they already had
  const [nudges, heat, rank] = await Promise.all([nudgesFor(user, comm, dash), heatOf(user.id), rankOf(user.id)])
  return { me: { id: user.id, name: u.name, handle: u.handle || '', bio: u.bio || '', public: !!u.public, picture: u.picture, banner: u.banner || { kind: 'pattern', pattern: 'p1' }, bannerImg: !!u.banner_img, since: iso(u.created_at), membersOn: !!(u.membership && u.membership.on) },
    level: lvl, dash, community: comm, celebrate, news: newsRows.length ? { id: Number(newsRows[0].id), title: newsRows[0].title, body: newsRows[0].body, at: iso(newsRows[0].created_at), items: newsRows.map((n) => ({ id: Number(n.id), title: n.title, body: n.body, at: iso(n.created_at) })) } : null, nudges, heat, rank,
    spots: await (await import('./payouts')).spots().catch(() => []), pause: await (await import('./solo')).myRestriction(user.id) }   // Install 66
}
export async function markSeen(user, b) {
  if (b.badges) await q('update meet_badges set seen_at = now() where user_id = $1 and seen_at is null', [user.id])
  if (b.level) await q('update meet_users set level_seen = greatest(level_seen, $2) where id = $1', [user.id, Math.min(Math.max(Number(b.level) || 0, 0), 99)])
  if (b.news) await q('update meet_users set news_seen = greatest(news_seen, $2) where id = $1', [user.id, Number(b.news) || 0])
  if (b.welcome) await q('update meet_users set welcomed = true where id = $1', [user.id])
  return { ok: true }
}

// ---------- nudges: worked out from what's really happening ----------
async function nudgesFor(user, comm, dash) {
  const out = [], week = await lagosWeek()
  const next = await one(`select m.code, m.title, m.starts_at, (select count(*)::int from meet_regs r where r.code = m.code) as regs from meetings m
    where m.host_user = $1 and m.ended_at is null and m.starts_at between now() and now() + interval '24 hours' order by m.starts_at limit 1`, [user.id])
  if (next) out.push({ kind: 'soon', icon: 'clock', title: `“${next.title}” starts soon`, body: next.regs ? `${next.regs} ${next.regs === 1 ? 'person has' : 'people have'} signed up.` : 'Share the invite so people can sign up.', at: iso(next.starts_at), code: next.code })
  const thisWeek = await one('select count(*)::int as n from meetings where host_user = $1 and started_at >= $2', [user.id, week])
  if (comm.streak >= 1 && !thisWeek.n) out.push({ kind: 'streak', icon: 'flame', title: `Keep your ${comm.streak}-week streak`, body: 'Host a meeting this week (any length) to keep it going.' })
  const months = (await q(`select to_char(date_trunc('month', started_at at time zone 'Africa/Lagos'), 'YYYY-MM') as m, count(*)::int as n from meetings where host_user = $1 and started_at is not null group by 1 order by 1 desc limit 13`, [user.id])).rows
  const lastKey = (() => { const d = new Date(Date.now() + 3600_000); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 7) })()
  const last = months.find((x) => x.m === lastKey), before = months.filter((x) => x.m < lastKey)
  if (last && last.n >= 3 && before.length && last.n > Math.max(...before.map((x) => x.n))) out.push({ kind: 'best', icon: 'rocket', title: 'Last month was your best month yet', body: `${last.n} meetings. Host this week to keep the momentum.` })
  const r = await rankOf(user.id)
  if (r && r.rank <= 10) out.push({ kind: 'rank', icon: 'trophy', title: `You’re #${r.rank} on this month’s leaderboard`, body: r.gap ? `${r.gap} more hour${r.gap === 1 ? '' : 's'} hosted passes the person above you.` : 'You’re at the top. Keep it up.' })
  if (comm.spotlight && Object.values(comm.spotlight.winners || {}).some((w) => w.handle && w.handle === comm.handle)) out.push({ kind: 'spot', icon: 'star', title: 'You’re in the spotlight', body: 'Everyone on Olexweb Meet can see you this month.' })
  if (!comm.public) out.push({ kind: 'public', icon: 'user', title: 'Show your profile', body: 'Turn on your public profile to join the leaderboard and let people follow you.' })
  return out.slice(0, 5)
}
async function rankOf(userId) {
  const rows = (await q(`select m.host_user as id, sum(extract(epoch from (coalesce(g.left_at, now()) - g.joined_at))) / 3600 as h from meetings m join meet_users u on u.id = m.host_user
    join meet_usage g on g.code = m.code and g.identity like 'h\\_%' where u.public and u.handle is not null and u.banned_at is null and m.started_at >= date_trunc('month', now())
    group by m.host_user having sum(extract(epoch from (coalesce(g.left_at, now()) - g.joined_at))) > 600 order by h desc limit 200`)).rows
  const i = rows.findIndex((x) => Number(x.id) === Number(userId)); if (i < 0) return null
  return { rank: i + 1, hours: Math.round(rows[i].h * 10) / 10, gap: i ? Math.max(1, Math.ceil(rows[i - 1].h - rows[i].h)) : 0 }
}
// meetings per week, the last 26 weeks (oldest first)
async function heatOf(userId) {
  const rows = (await q(`select floor(extract(epoch from (date_trunc('week', now()) - date_trunc('week', started_at))) / 604800)::int as ago, count(*)::int as n from meetings
    where host_user = $1 and started_at > now() - interval '26 weeks' group by 1`, [userId])).rows
  const a = Array(26).fill(0); for (const r of rows) if (r.ago >= 0 && r.ago < 26) a[25 - r.ago] = r.n
  return a
}

// ---------- photo and banner ----------
const MAGIC = [['image/jpeg', [0xff, 0xd8, 0xff]], ['image/png', [0x89, 0x50, 0x4e, 0x47]], ['image/webp', [0x52, 0x49, 0x46, 0x46]]]
export function imageType(buf) { for (const [t, m] of MAGIC) if (m.every((x, i) => buf[i] === x)) return t; return null }
function readImage(dataUrl, maxBytes) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''))
  if (!m) throw new Refused('Choose a photo (JPEG, PNG or WebP).')
  const buf = Buffer.from(m[2], 'base64')
  if (buf.length > maxBytes) throw new Refused('That picture is too big. Try a smaller one.')
  if (!imageType(buf)) throw new Refused('That file isn’t a picture.')
  return buf.toString('base64')
}
export async function savePhoto(user, data) {
  if (data === null) { await q("update meet_users set photo_data = null, picture = case when picture like '/api/meet/pic/%' then null else picture end where id = $1", [user.id]); return { ok: true, picture: null } }
  const b64 = readImage(data, 150_000), pic = `/api/meet/pic/${user.id}?v=${Date.now().toString(36)}`
  await q('update meet_users set photo_data = $2, picture = $3 where id = $1', [user.id, b64, pic])
  return { ok: true, picture: pic }
}
export const PATTERNS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']
export async function saveBanner(user, b) {
  const kind = ['pattern', 'image', 'bio'].includes(b.kind) ? b.kind : 'pattern', pattern = PATTERNS.includes(b.pattern) ? b.pattern : 'p1'
  if (kind === 'image' && b.data) await q('update meet_users set banner_data = $2 where id = $1', [user.id, readImage(b.data, 400_000)])
  if (kind === 'image' && !b.data && !(await one('select banner_data is not null as y from meet_users where id = $1', [user.id])).y) throw new Refused('Choose a picture for your banner.')
  await q('update meet_users set banner = $2 where id = $1', [user.id, JSON.stringify({ kind, pattern, v: Date.now().toString(36) })])
  return { ok: true }
}
// who may see a photo or banner: anyone, when the person is public or sells on Meet; otherwise only themselves
export async function picture(id, banner, viewer) {
  const u = await one(`select ${banner ? 'banner_data' : 'photo_data'} as d, public, payout is not null as sells from meet_users where id = $1 and banned_at is null`, [Number(id) || 0])
  if (!u || !u.d) return null
  if (!u.public && !u.sells && !(viewer && Number(viewer.id) === Number(id))) return null
  return Buffer.from(u.d, 'base64')
}
