// Ventures (Install E): the businesses that make money. Olexweb Meet's numbers come straight from Meet; the others
// (Belloft and the ones to come) get their income added by hand each month until they're connected the same way.
import 'server-only'
import { q, one } from './db'
import { Refused } from './content'

const clean = (s, n) => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, n)
const months = (n = 6) => { const d = new Date(), out = []; for (let i = n - 1; i >= 0; i--) out.push(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1)).toISOString().slice(0, 7)); return out }
async function meetNumbers() {
  try {
    const { q: mq, one: mone } = await import('@/lib/meet/db')
    const byMonth = (await mq(`select to_char(paid_at, 'YYYY-MM') as m, sum(amount)::int as a from meet_payments where status = 'paid' and paid_at > now() - interval '7 months' group by 1`)).rows
    const k = await mone(`select (select count(*)::int from meet_users where banned_at is null) as users, (select count(*)::int from meet_users where pro_until > now()) as pro,
      (select count(*)::int from meetings where started_at > now() - interval '30 days') as meetings30, (select count(*)::int from meet_tickets where status = 'open') as tickets`)
    return { income: Object.fromEntries(byMonth.map((r) => [r.m, r.a])), ...k }
  } catch { return null }
}
export async function business() {
  const vs = (await q('select * from biz_ventures order by sort, id')).rows
  const inc = (await q('select id, venture_id, month, amount, note from biz_income order by month desc, id desc')).rows
  const meet = vs.some((v) => v.kind === 'meet') ? await meetNumbers() : null
  const ms = months(6), now = ms[ms.length - 1], last = ms[ms.length - 2]
  const list = vs.map((v) => {
    const own = inc.filter((i) => i.venture_id === v.id), auto = v.kind === 'meet' && meet ? meet.income : {}
    const per = Object.fromEntries(ms.map((m) => [m, (auto[m] || 0) + own.filter((i) => i.month === m).reduce((a, i) => a + i.amount, 0)]))
    const total = own.reduce((a, i) => a + i.amount, 0) + Object.values(auto).reduce((a, x) => a + x, 0)
    return { id: v.id, name: v.name, line: v.line, url: v.url, adminUrl: v.admin_url, status: v.status, kind: v.kind, notes: v.notes,
      users: v.kind === 'meet' && meet ? meet.users : v.users, extra: v.kind === 'meet' && meet ? { pro: meet.pro, meetings30: meet.meetings30, tickets: meet.tickets } : null,
      months: per, thisMonth: per[now], lastMonth: per[last], total, entries: own.slice(0, 12) }
  })
  return { months: ms, ventures: list, thisMonth: list.reduce((a, v) => a + v.thisMonth, 0), lastMonth: list.reduce((a, v) => a + v.lastMonth, 0), allTime: list.reduce((a, v) => a + v.total, 0) }
}
export async function saveVenture(b) {
  const name = clean(b.name, 80); if (!name) throw new Refused('Give the venture a name.')
  const url = clean(b.url, 300), adm = clean(b.adminUrl, 300)
  for (const u of [url, adm]) if (u && !/^(https:\/\/|\/admin\/)/.test(u)) throw new Refused('Links must start with https:// (or /admin/ for a page in this admin).')
  const status = ['building', 'live', 'paused'].includes(b.status) ? b.status : 'live', users = b.users === '' || b.users == null ? null : Math.max(0, Math.round(Number(b.users)) || 0)
  if (b.id) await q('update biz_ventures set name = $2, line = $3, url = $4, admin_url = $5, status = $6, users = case when kind = \'meet\' then users else $7 end, notes = $8 where id = $1', [Number(b.id), name, clean(b.line, 160), url || null, adm || null, status, users, clean(b.notes, 1000) || null])
  else await q('insert into biz_ventures (name, line, url, admin_url, status, users, notes, sort) values ($1, $2, $3, $4, $5, $6, $7, (select coalesce(max(sort), 0) + 1 from biz_ventures))', [name, clean(b.line, 160), url || null, adm || null, status, users, clean(b.notes, 1000) || null])
  return { ok: true }
}
export async function deleteVenture(id) {
  const v = await one('select kind from biz_ventures where id = $1', [Number(id) || 0])
  if (v && v.kind === 'meet') throw new Refused('Olexweb Meet is connected; it can’t be removed here.')
  await q('delete from biz_ventures where id = $1', [Number(id) || 0]); return { ok: true }
}
export async function addIncome({ ventureId, month, amount, note }) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || ''))) throw new Refused('Choose the month.')
  const a = Math.round(Number(amount)); if (!(a > 0 && a < 1e11)) throw new Refused('Type the amount in naira.')
  await q('insert into biz_income (venture_id, month, amount, note) values ($1, $2, $3, $4)', [Number(ventureId) || 0, month, a, clean(note, 200) || null])
  return { ok: true }
}
export const deleteIncome = (id) => q('delete from biz_income where id = $1', [Number(id) || 0]).then(() => ({ ok: true }))
