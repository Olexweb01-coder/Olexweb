// Reviews, testimonials and the review link. Every rule is checked here, on the server.
import 'server-only'
import { createHmac } from 'node:crypto'
import { q, one } from './db'
import { token, sha256, encrypt, decrypt, sameText } from './crypto'
import { can, ownerOnly, audit } from './auth'
import { Refused } from './content'
import { refreshSite } from './refresh'
import { notify } from '@/lib/assistant/notify'

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
const SITE = 'https://olexweb.com'

// ---------- the review link (owner only) ----------
export async function currentLink() {
  const r = await one('select token_enc from review_links where active order by created_at desc limit 1')
  return r && r.token_enc ? SITE + '/review/' + decrypt(r.token_enc) : null
}
export async function newLink(u, ip) {
  if (!ownerOnly(u)) throw new Refused('Only Olaitan can make review links.', 403)
  const t = token(12)
  await q('update review_links set active = false where active')
  await q('insert into review_links (token_hash, token_enc) values ($1, $2)', [sha256(t), encrypt(t)])
  await audit(u.id, 'review_link_created', {}, ip)
  return SITE + '/review/' + t
}
export async function switchOffLink(u, ip) {
  if (!ownerOnly(u)) throw new Refused('Only Olaitan can switch review links off.', 403)
  await q('update review_links set active = false where active'); await audit(u.id, 'review_link_switched_off', {}, ip)
}
export async function linkIsActive(t) {
  if (!t || !/^[A-Za-z0-9_-]{8,64}$/.test(t)) return false
  return !!(await one('select 1 from review_links where token_hash = $1 and active', [sha256(t)]))
}

// ---------- the form's tamper-proof start time ----------
const sign = (s) => createHmac('sha256', process.env.AUTH_SECRET).update('review-form:' + s).digest('base64url')
export const formStamp = () => { const t = String(Date.now()); return t + '.' + sign(t) }
function stampAge(stamp) {
  const [t, sig] = String(stamp || '').split('.')
  if (!t || !sig || !sameText(sig, sign(t))) return -1
  return Date.now() - Number(t)
}

// ---------- a client submits a review ----------
export async function submitReview(d, ip) {
  if (!(await linkIsActive(d.token))) throw new Refused('This review link has been switched off. Ask Olaitan for a new one.', 410)
  if (clean(d.website, 200)) return { ok: true }                     // the hidden bot trap was filled in: pretend it worked
  const age = stampAge(d.stamp)
  if (age < 3000 || age > 6 * 3600e3) throw new Refused('Please take a moment to write your review, then send it again.', 400)
  const ipHash = sha256('review:' + ip + ':' + process.env.AUTH_SECRET)   // privacy: the address itself is never stored
  const n = await one("select count(*) filter (where created_at > now() - interval '1 hour')::int as h, count(*)::int as d from testimonials where ip_hash = $1 and created_at > now() - interval '1 day'", [ipHash])
  if (n.h >= 3 || n.d >= 6) throw new Refused('Thank you. We’ve already received reviews from this connection today.', 429)
  const name = clean(d.name, 81), role = clean(d.role, 121), text = clean(d.text, 801), stars = Number(d.stars)
  if (name.length < 2 || name.length > 80) throw new Refused('Add your name.')
  if (role.length > 120) throw new Refused('Keep your role and business short.')
  if (text.length < 20) throw new Refused('Write a few more words about working with Olexweb.')
  if (text.length > 800) throw new Refused('Keep your review under 800 characters.')
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new Refused('Choose a rating.')
  if (d.consent !== true) throw new Refused('Tick the box to let Olexweb show your review.')
  await q("insert into testimonials (name, role, text, stars, source, status, consent, ip_hash) values ($1,$2,$3,$4,'link','waiting',true,$5)", [name, role, text, stars, ipHash])
  await audit(null, 'review_received', {}, null)
  await notify('review', `A new review from ${name} is waiting for you.`, '/admin/reviews')
  return { ok: true }
}

// ---------- decisions in the admin ----------
export async function decide(u, ip, { action, id }) {
  id = Number(id); if (!Number.isInteger(id)) throw new Refused('Unknown review.')
  const r = await one('select id, status from testimonials where id = $1', [id]); if (!r) throw new Refused('That review no longer exists.', 404)
  if (!can(u, 'reviews')) throw new Refused('Only Olaitan can approve reviews.', 403)
  const to = { approve: 'published', reject: 'rejected', unpublish: 'waiting' }[action]
  if (!to) throw new Refused('Unknown action.')
  await q('update testimonials set status = $2, decided_by = $3, decided_at = now() where id = $1', [id, to, u.id])
  await audit(u.id, 'review_' + { approve: 'approved', reject: 'rejected', unpublish: 'unpublished' }[action], { id }, ip)
  refreshSite('testimonial')
  return { ok: true, status: to }
}
export async function addTestimonial(u, ip, d) {
  if (!can(u, 'testimonials')) throw new Refused('Only Olaitan can add testimonials.', 403)
  const name = clean(d.name, 81), role = clean(d.role, 121), text = clean(d.text, 801)
  const stars = d.stars ? Number(d.stars) : null
  if (name.length < 2 || name.length > 80) throw new Refused('Add the client’s name.')
  if (text.length < 10 || text.length > 800) throw new Refused('Add what they said (up to 800 characters).')
  if (role.length > 120) throw new Refused('Keep the role short.')
  if (stars !== null && (!Number.isInteger(stars) || stars < 1 || stars > 5)) throw new Refused('Choose a rating from 1 to 5, or none.')
  if (d.consent !== true) throw new Refused('Confirm you have their permission to show this.')
  const status = can(u, 'reviews') ? 'published' : 'waiting'
  const r = await one("insert into testimonials (name, role, text, stars, source, status, consent, decided_by, decided_at) values ($1,$2,$3,$4,'typed',$5,true,$6,now()) returning id", [name, role, text, stars, status, u.id])
  await audit(u.id, 'testimonial_added', { id: r.id }, ip)
  if (status === 'published') refreshSite('testimonial')
  return { ok: true, status }
}
