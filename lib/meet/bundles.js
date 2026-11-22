// Course bundles (Install 58): several of a host's meetings sold as one ticket, with an optional early-bird price (until
// a date) and a group price (several seats bought together, one link per seat). Olexweb keeps 5%; the host pays
// Paystack's fee. A bundle ticket lets its holder into every meeting in the bundle, including ones added later.
import 'server-only'
import { q, one } from './db'
import { Refused } from '@/lib/admin/content'
import { pricing, paystackReady, notice, proById } from './plans'
import { PCT, kobo, naira, discounted } from './money'
import { send as sendEmail, emailReady } from './email'
import { limit, clientIp } from './limit'

const clean = (s, n) => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, n)
const EMAIL = /^[^\s@<>]{1,64}@[^\s@<>]{1,190}\.[a-z]{2,24}$/i
const whole = (v) => { const n = Number(v); return v === '' || v == null || !Number.isFinite(n) ? 0 : Math.round(n) }
const base = async () => { const { meetBase, mainOrigin } = await import('@/lib/site/meet'); return meetBase() || mainOrigin() }
// the price right now: early-bird until its date, then the full price
export const priceNow = (b, at = new Date()) => (b.early_price && b.early_until && new Date(b.early_until) > at ? b.early_price : b.price)

export async function saveBundle(user, b) {
  if (!(await pricing()).on || !paystackReady()) throw new Refused('Selling isn’t open yet.', 403)
  if (!(await proById(user.id))) throw new Refused('Course bundles are for Pro hosts. Go Pro to sell them.', 402)   // Install 58j
  const u = await one('select payout from meet_users where id = $1', [user.id])
  if (!u.payout) throw new Refused('Add your bank first, so bundle money reaches you.')
  const title = clean(b.title, 90), blurb = clean(b.blurb, 400), price = whole(b.price), early = whole(b.earlyPrice), size = whole(b.groupSize), group = whole(b.groupPrice)
  const codes = [...new Set((Array.isArray(b.codes) ? b.codes : []).map((c) => String(c || '').slice(0, 20)))]
  if (!title) throw new Refused('Give the bundle a name.')
  if (price < 100 || price > 5_000_000) throw new Refused('A bundle can be ₦100 to ₦5,000,000.')
  if (!codes.length || codes.length > 30) throw new Refused('Choose 1 to 30 of your meetings.')
  const mine = (await q('select code from meetings where host_user = $1 and code = any($2) and ended_at is null', [user.id, codes])).rows.map((r) => r.code)
  if (mine.length !== codes.length) throw new Refused('Choose only your own meetings that haven’t ended.')
  let earlyUntil = null
  if (early) {
    earlyUntil = new Date(b.earlyUntil)
    if (early < 100 || early >= price) throw new Refused('The early-bird price must be lower than the full price (at least ₦100).')
    if (!(earlyUntil > new Date())) throw new Refused('Choose when the early-bird price ends (a future date).')
  }
  if (size || group) {
    if (size < 2 || size > 50) throw new Refused('A group is 2 to 50 people.')
    if (group < 100 * size || group >= size * price) throw new Refused(`The group price must be less than ${size} full tickets (${naira(kobo(size * price))}).`)
  }
  const vals = [title, blurb, price, early || null, earlyUntil, size || null, size ? group : null, b.onSale !== false]
  let id = Number(b.id) || 0
  if (id) { const r = await one('update meet_bundles set title = $3, blurb = $4, price = $5, early_price = $6, early_until = $7, group_size = $8, group_price = $9, on_sale = $10 where id = $1 and host_user = $2 returning id', [id, user.id, ...vals]); if (!r) throw new Refused('That bundle isn’t yours.', 404) }
  else id = (await one('insert into meet_bundles (host_user, title, blurb, price, early_price, early_until, group_size, group_price, on_sale) values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id', [user.id, ...vals])).id
  await q('delete from meet_bundle_items where bundle_id = $1 and not (code = any($2))', [id, mine])
  for (const c of mine) await q('insert into meet_bundle_items (bundle_id, code) values ($1, $2) on conflict do nothing', [id, c])
  return { ok: true, id: Number(id) }
}
export async function myBundles(user) {
  const rows = (await q(`select b.*, (select count(*)::int from meet_payments p where p.kind = 'bundle' and p.ref_id = b.id and p.status = 'paid') as sold,
    (select coalesce(sum(p.seats), 0)::int from meet_payments p where p.kind = 'bundle' and p.ref_id = b.id and p.status = 'paid') as seats,
    (select array_agg(code) from meet_bundle_items i where i.bundle_id = b.id) as codes from meet_bundles b where b.host_user = $1 order by b.created_at desc limit 50`, [user.id])).rows
  return rows.map((b) => ({ id: Number(b.id), title: b.title, blurb: b.blurb, price: b.price, earlyPrice: b.early_price, earlyUntil: b.early_until && b.early_until.toISOString(), groupSize: b.group_size, groupPrice: b.group_price,
    onSale: b.on_sale, codes: b.codes || [], sold: b.sold, seats: b.seats, now: priceNow(b) }))
}
// the public bundle page (with a ticket key: the holder's own meeting links)
export async function bundlePage(id, pass = null) {
  const b = await one(`select b.*, u.name as host, u.handle, u.picture, u.payout is not null as can from meet_bundles b join meet_users u on u.id = b.host_user where b.id = $1 and u.banned_at is null`, [Number(id) || 0])
  if (!b) return null
  const meetings = (await q('select m.code, m.title, m.starts_at, m.minutes, m.ended_at from meet_bundle_items i join meetings m on m.code = i.code where i.bundle_id = $1 order by m.starts_at nulls last', [b.id])).rows
  const holder = pass && String(pass).length === 22 ? !!(await one('select 1 from meet_passes where pass = $1 and bundle_id = $2', [String(pass), b.id])) : false
  const { meetLink } = await import('@/lib/site/meet')
  return { id: Number(b.id), title: b.title, blurb: b.blurb, host: { name: b.host, handle: b.handle, picture: b.picture }, onSale: b.on_sale && b.can,
    price: b.price, now: priceNow(b), earlyUntil: b.early_price && b.early_until > new Date() ? b.early_until.toISOString() : null, groupSize: b.group_size, groupPrice: b.group_price, pct: PCT.bundle,
    meetings: meetings.map((m) => ({ title: m.title, at: m.starts_at && m.starts_at.toISOString(), minutes: m.minutes, ended: !!m.ended_at, link: holder ? meetLink(m.code) + '?pass=' + pass : null })), holder }
}
export async function buyBundle({ id, name, email, group }, origin, buyer = null, linkId = null) {
  await limit('bundle:' + clientIp(), 10, 600)
  if (!(await pricing()).on || !paystackReady()) throw new Refused('Payments aren’t set up yet.', 503)
  const n = clean(name, 60), e = String(email || '').trim().toLowerCase().slice(0, 200)
  if (!n) throw new Refused('Type your name.')
  if (!EMAIL.test(e)) throw new Refused('That email doesn’t look right.')
  const b = await one('select b.*, u.payout from meet_bundles b join meet_users u on u.id = b.host_user where b.id = $1 and u.banned_at is null', [Number(id) || 0])
  if (!b || !b.on_sale || !b.payout || !(await proById(b.host_user))) throw new Refused('This bundle isn’t on sale.', 404)   // Install 58j: the host's Pro ended
  let amount = priceNow(b), seats = 1
  if (group) { if (!b.group_size) throw new Refused('This bundle has no group price.'); amount = b.group_price; seats = b.group_size }
  else if (buyer) { const p = await (await import('./members')).perksFor(b.host_user, buyer.id); if (p.discount) amount = discounted(amount, p.discount) }   // members' discount (one seat)
  const { startSplit, linkFor } = await import('./earn')
  return startSplit({ kind: 'bundle', amount, sub: b.payout.code, hostUser: b.host_user, name: n, email: e, userId: buyer ? buyer.id : null, refId: b.id, seats, linkId: await linkFor(linkId, b.host_user), origin })
}
export async function bundlePaid(pay, makePasses) {
  const passes = await makePasses(pay, null, pay.ref_id)
  const b = await one('select title, host_user from meet_bundles where id = $1', [pay.ref_id]); if (!b) return
  await notice(b.host_user, `Bundle sold: ${naira(kobo(pay.amount))}`, `${pay.buyer_name} bought “${b.title}”${pay.seats > 1 ? ` for ${pay.seats} people` : ''}. Paid to your bank weekly, minus Olexweb’s ${pay.pct}% and Paystack’s fee.`)
  if (!pay.buyer_email || !emailReady()) return
  const at = await base(), links = passes.map((p) => `${at}/meet/b/${pay.ref_id}?pass=${p}`)
  const many = links.length > 1
  await sendEmail({ to: pay.buyer_email, kind: 'meet-bundle', subject: `Your ${many ? 'tickets' : 'ticket'}: ${b.title}`,
    text: `Hi ${pay.buyer_name},\n\nYou’re in “${b.title}”.${many ? ` Here are ${links.length} links, one for each person (keep the first, send the others):` : ' Your own link (it opens every session):'}\n${links.join('\n')}\n\nOlexweb Meet`,
    html: `<p>Hi ${pay.buyer_name},</p><p>You’re in <b>${b.title}</b>.${many ? ` Here are ${links.length} links, one for each person (keep the first, send the others):` : ' Your own link (it opens every session):'}</p><ol>${links.map((l) => `<li><a href="${l}">${l}</a></li>`).join('')}</ol><p>Olexweb Meet</p>` }).catch(() => {})
}
// the return page from Paystack sends the buyer to their bundle page
export async function firstPass(paymentId) {
  const r = await one('select pass from meet_passes where payment_id = $1 order by created_at, pass limit 1', [paymentId])
  return r && r.pass
}
