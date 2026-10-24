// The free audio course (olexweb.com/aoc) and the short WhatsApp link (olexweb.com/me).
// The course is open like a shared folder: people give their name, tick that they'll share what they learned, and the
// recordings appear with play and download buttons. Nothing is locked; names and listening are kept for monitoring.
import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { q, one } from '@/lib/admin/db'
import { AOC_WAVES } from './aoc-waves'

export class AocError extends Error {}
const clean = (s, n) => String(s ?? '').replace(/<[^>]*>/g, '').replace(/[\u0000-\u001F\u007F<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n)
export const DEFAULT_CONTENT = {
  title: 'Anatomy of Creation', tagline: 'How everything that exists was actually made,', taglineBold: 'and how to make yours.',
  intro: 'Short audios. Listen anywhere, on your phone.',
  learn: ['Why you were never meant to be a user', 'The Eye: where every creation begins', 'The Question you can’t leave alone', 'Giving your idea a body', 'Keeping it alive, for good'],
  parts: [
    { key: 'part1', title: 'Part 1', covers: '00 · Why you were never meant to be a user\n01 · The Eye: where every creation begins', file: '/aoc/anatomy-of-creation-part-1.m4a' },
    { key: 'part2', title: 'Part 2', covers: '02 · The Question you can’t leave alone', file: '/aoc/anatomy-of-creation-part-2.m4a' },
    { key: 'part3', title: 'Part 3', covers: '03 · Giving your idea a body', file: '/aoc/anatomy-of-creation-part-3.m4a' },
    { key: 'part4', title: 'Part 4', covers: '04 · Keeping it alive, for good', file: '/aoc/anatomy-of-creation-part-4.m4a' }],
  full: { title: 'Full course', file: '/aoc/anatomy-of-creation-full-course.m4a', note: 'All 4 parts in one file · 37 minutes · 18 MB' },
  map: null }

// ---------- the WhatsApp link ----------
export async function linkTarget(slug) {
  const l = await one('select phone, message from site_links where slug = $1', [slug]); if (!l) return null
  await q("update site_links set clicks = clicks + 1 where slug = $1", [slug])
  await q("insert into site_link_clicks (slug, day, n) values ($1, (now() at time zone 'Africa/Lagos')::date, 1) on conflict (slug, day) do update set n = site_link_clicks.n + 1", [slug])
  return `https://wa.me/${l.phone}${l.message ? '?text=' + encodeURIComponent(l.message) : ''}`
}
export async function saveLink({ phone, message }) {
  const p = String(phone || '').replace(/[^\d]/g, '')
  if (p.length < 10 || p.length > 15) throw new AocError('Enter the number with the country code, like 2347011726321.')
  const m = String(message || '').replace(/[\u0000-\u0009\u000B-\u001F]/g, '').trim().slice(0, 600)
  return one("update site_links set phone = $1, message = $2, updated_at = now() where slug = 'me' returning phone, message", [p, m])
}

// ---------- the course ----------
async function settings() { const s = await one('select goal, content, close_when_full from aoc_settings where id = 1'); return { goal: s ? s.goal : 300, close: s ? s.close_when_full : true, content: s && s.content && s.content.parts ? s.content : DEFAULT_CONTENT } }
export async function publicCourse() {             // the course, and whether it's closed; the count itself is shown only in the admin
  const s = await settings(), n = await one('select count(*)::int n from aoc_listeners')
  const wave = (f) => AOC_WAVES[f] || null                                       // the player draws the real waveform when it's known
  const content = { ...s.content, parts: s.content.parts.map((p) => ({ ...p, wave: wave(p.file) })), full: s.content.full ? { ...s.content.full, wave: wave(s.content.full.file) } : null }
  return { content, closed: s.close && n.n >= s.goal, goal: s.goal }
}
export async function join({ name, consent }, ip) {
  const nm = clean(name, 60)
  if (nm.length < 2) throw new AocError('Please enter your name.')
  if (consent !== true) throw new AocError('Please tick the box to continue.')
  const s = await settings(), n = await one('select count(*)::int n from aoc_listeners')
  if (s.close && n.n >= s.goal) throw new AocError(`All ${s.goal} slots have been taken.`)
  const ipHash = createHash('sha256').update('aoc:' + ip + ':' + (process.env.AUTH_SECRET || '')).digest('hex')
  const r = await one("select count(*) filter (where created_at > now() - interval '1 hour')::int h from aoc_listeners where ip_hash = $1", [ipHash])
  if (r && r.h >= 20) throw new AocError('Too many sign-ups from this connection. Try again in an hour.')
  const token = randomBytes(18).toString('base64url')
  await q('insert into aoc_listeners (token, name, ip_hash) values ($1, $2, $3)', [token, nm, ipHash])
  return { token, name: nm }
}
export async function track({ token, part, event }) {
  const s = await settings()
  if (!s.content.parts.some((p) => p.key === part) && part !== 'map' && part !== 'full') throw new AocError('Unknown part.')
  if (!['play', 'finish', 'download'].includes(event)) throw new AocError('Unknown event.')
  const r = await one(`update aoc_listeners set last_seen = now(), progress = jsonb_set(progress, array[$2::text], coalesce(progress->$2, '{}'::jsonb) || jsonb_build_object($3::text, to_jsonb(now())))
                       where token = $1 returning id`, [String(token || '').slice(0, 64), part, event])
  return { ok: !!r }
}
export async function feedback({ token, text }) {
  const t = String(text || '').replace(/[\u0000-\u0009\u000B-\u001F]/g, '').trim().slice(0, 3000)
  if (t.length < 3) throw new AocError('Write a few words about what you learned.')
  const r = await one('update aoc_listeners set feedback = $2, feedback_at = now(), last_seen = now() where token = $1 returning id', [String(token || '').slice(0, 64), t])
  if (!r) throw new AocError('Open the course again from your link, then send this.')
  return { ok: true }
}

// ---------- the admin ----------
export async function adminData() {
  const s = await settings()
  const link = await one("select phone, message, clicks, updated_at from site_links where slug = 'me'")
  const days = (await q("select to_char(day, 'YYYY-MM-DD') as day, n from site_link_clicks where slug = 'me' and day > (now() at time zone 'Africa/Lagos')::date - 14 order by day")).rows
  const people = (await q('select id, name, progress, feedback, feedback_at, created_at, last_seen from aoc_listeners order by created_at desc limit 1000')).rows
  return { link, days, goal: s.goal, close: s.close, content: s.content, people: people.map((p) => ({ ...p, created_at: p.created_at.toISOString(), last_seen: p.last_seen.toISOString(), feedback_at: p.feedback_at && p.feedback_at.toISOString() })) }
}
export async function saveContent(c) {
  const parts = (Array.isArray(c.parts) ? c.parts : []).slice(0, 20).map((p, i) => ({ key: clean(p.key, 20).replace(/[^a-z0-9-]/gi, '') || 'p' + i, title: clean(p.title, 90), file: clean(p.file, 300),
    covers: String(p.covers || '').split('\n').map((x) => clean(x, 120)).filter(Boolean).slice(0, 6).join('\n') })).filter((p) => p.title && p.file)
  if (!parts.length) throw new AocError('Add at least one recording.')
  if (new Set(parts.map((p) => p.key)).size !== parts.length) throw new AocError('Each recording needs its own key.')
  const bad = [...parts.map((p) => p.file), c.map && c.map.file, c.full && c.full.file].filter(Boolean).find((f) => !/^(\/[\w\-./]+|https:\/\/[^\s"'<>]+)$/.test(f))
  if (bad) throw new AocError(`“${bad}” isn’t a valid file address. Use /aoc/file-name.m4a or a full https:// address.`)
  const learn = (Array.isArray(c.learn) ? c.learn : String(c.learn || '').split('\n')).map((x) => clean(x, 90)).filter(Boolean).slice(0, 12)
  const content = { title: clean(c.title, 80) || 'Anatomy of Creation', tagline: clean(c.tagline, 140), taglineBold: clean(c.taglineBold, 80), intro: clean(c.intro, 300), learn, parts,
    full: c.full && clean(c.full.file, 300) ? { title: clean(c.full.title, 80) || 'Full course', file: clean(c.full.file, 300), note: clean(c.full.note, 120) } : null,
    map: c.map && clean(c.map.file, 300) ? { title: clean(c.map.title, 80) || 'Download', file: clean(c.map.file, 300) } : null }
  const goal = Math.max(1, Math.min(100000, Number(c.goal) || 300))
  await q('update aoc_settings set content = $1, goal = $2, close_when_full = $3 where id = 1', [JSON.stringify(content), goal, c.close !== false])
  return { ok: true }
}
export async function removeListener(id) { await q('delete from aoc_listeners where id = $1', [Number(id)]); return { ok: true } }
