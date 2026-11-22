// Tracked links (Install 58): a host makes a link for something they sell (a paid or closed meeting, a bundle, their
// booking page or membership) and sees how it does: opened → started paying → paid, and what reached them after fees.
// Opening a link counts once per person per hour, and remembers the link for 7 days in a cookie so the sale is credited.
import 'server-only'
import { randomBytes, createHash } from 'node:crypto'
import { q, one } from './db'
import { Refused } from '@/lib/admin/content'
import { limit, clientIp } from './limit'
import { kobo, paystackFee } from './money'

const clean = (s, n) => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, n)
export const KINDS = ['meeting', 'bundle', 'booking', 'membership']
export const COOKIE = 'meet_l'

export async function makeLink(user, { label, kind, target }) {
  await limit('mklink:' + user.id, 30, 3600)
  const l = clean(label, 60), k = String(kind || ''), t = String(target || '').slice(0, 40)
  if (!l) throw new Refused('Name the link (for example, “Instagram, early-bird”).')
  if (!KINDS.includes(k)) throw new Refused('Choose what the link opens.')
  let ok = false
  if (k === 'meeting') ok = !!(await one('select 1 from meetings where code = $1 and host_user = $2 and ended_at is null', [t, user.id]))
  if (k === 'bundle') ok = !!(await one('select 1 from meet_bundles where id = $1 and host_user = $2', [Number(t) || 0, user.id]))
  if (k === 'booking' || k === 'membership') { const u = await one('select handle from meet_users where id = $1', [user.id]); ok = !!(u && u.handle) }
  if (!ok) throw new Refused('Choose one of your own things to link to.')
  for (let i = 0; i < 5; i++) {
    const slug = randomBytes(6).toString('base64url').replace(/[-_]/g, 'x').slice(0, 7)
    const r = await one('insert into meet_links (host_user, slug, label, kind, target) values ($1, $2, $3, $4, $5) on conflict (slug) do nothing returning id, slug', [user.id, slug, l, k, k === 'booking' || k === 'membership' ? '' : t])
    if (r) return { ok: true, slug: r.slug }
  }
  throw new Refused('Try again.')
}
// where a link goes (and counts the open)
export async function openLink(slug) {
  const l = await one('select l.*, u.handle from meet_links l join meet_users u on u.id = l.host_user where l.slug = $1 and u.banned_at is null', [String(slug || '').slice(0, 12)])
  if (!l) return null
  const who = createHash('sha256').update(clientIp() + '|' + l.id).digest('hex').slice(0, 24)
  const fresh = await limit('lopen:' + who, 1, 3600).then(() => true, () => false)   // the same person within an hour counts once
  if (fresh) await q('update meet_links set opens = opens + 1 where id = $1', [l.id])
  const { meetLink } = await import('@/lib/site/meet')
  const to = l.kind === 'meeting' ? meetLink(l.target) : l.kind === 'bundle' ? `/meet/b/${l.target}` : l.kind === 'booking' ? `/meet/h/${l.handle}/book` : `/meet/h/${l.handle}/join`
  return { id: Number(l.id), to }
}
export async function myLinks(user) {
  const rows = (await q(`select l.id, l.slug, l.label, l.kind, l.target, l.opens, l.created_at,
      count(p.*)::int as started, count(p.*) filter (where p.status = 'paid')::int as paid
    from meet_links l left join meet_payments p on p.link_id = l.id and p.host_user = l.host_user where l.host_user = $1 group by l.id order by l.created_at desc limit 100`, [user.id])).rows
  const sales = (await q("select link_id, amount, olex_kobo from meet_payments where status = 'paid' and link_id = any($1) and host_user = $2", [rows.map((r) => r.id), user.id])).rows
  return rows.map((r) => {
    const net = sales.filter((s) => Number(s.link_id) === Number(r.id)).reduce((t, s) => t + kobo(s.amount) - Number(s.olex_kobo || 0) - paystackFee(kobo(s.amount)), 0)
    return { id: Number(r.id), slug: r.slug, label: r.label, kind: r.kind, target: r.target, opens: r.opens, started: r.started, paid: r.paid, netKobo: net, at: r.created_at.toISOString() }
  })
}
export async function dropLink(user, id) {
  await q('delete from meet_links where id = $1 and host_user = $2', [Number(id) || 0, user.id])
  return { ok: true }
}
