// Olex Sales: the background step (every 10 minutes, from quickRun) and what Admin → Sales shows.
// Each step is small: read up to 3 websites, draft up to 2 emails (never more than 2 days' worth waiting), send at most one.
import 'server-only'
import { q, one } from '@/lib/admin/db'
import { profileCompany } from './profile'
import { draftFirst, draftFollowUp } from './write'
import { checkInbox } from './inbox'
import { sendNext, blocked, capToday, gmailReady } from './send'
import * as Src from './sources'
export { KINDS } from './sources'
import { NEVER, COUNTRIES } from './playbook'

export async function salesRun({ deadlineMs = 25000 } = {}) {
  const S = await one('select * from sales_settings where id = 1'); if (!S || !S.enabled) return null
  const t0 = Date.now(), report = {}
  if (gmailReady() || String(process.env.SALES_TEST_BASE || '')) try { const r = await checkInbox(); if (r.length) report.inbox = r.length } catch (e) { report.error = 'inbox: ' + e.message }
  try { const s = await sendNext(); if (s.sent) report.sent = s.to } catch (e) { report.error = 'send: ' + e.message }
  for (const c of (await q("select id from sales_companies where status = 'new' order by id limit 3")).rows) {
    if (Date.now() - t0 > deadlineMs) break
    try { await profileCompany(c.id); report.profiled = (report.profiled || 0) + 1 } catch (e) { await q("update sales_companies set status = 'error', profile_error = $2 where id = $1", [c.id, String(e.message).slice(0, 200)]) }
  }
  const waiting = await one("select count(*)::int as n from sales_outbox where status in ('waiting', 'approved')")
  if (waiting.n < capToday(S) * 2) for (const c of (await q("select id from sales_companies where status = 'qualified' order by score desc nulls last, id limit 2")).rows) {
    if (Date.now() - t0 > deadlineMs) break
    try { if (await draftFirst(c.id)) report.drafted = (report.drafted || 0) + 1 } catch (e) { report.error = 'draft: ' + e.message }
  }
  // follow-ups: 3 days after the first email, then 4 days after that (only if nobody replied; out-of-office pushes them back)
  for (const r of (await q(`select c.id, max(o.step)::int as step from sales_companies c join sales_outbox o on o.company_id = c.id and o.status = 'sent' and o.channel = 'email'
      where c.status = 'contacted' and (c.next_touch_after is null or c.next_touch_after < now()) group by c.id
      having max(o.step) < 3 and max(o.sent_at) < now() - (case when max(o.step) = 1 then interval '3 days' else interval '4 days' end) limit 2`)).rows) {
    if (Date.now() - t0 > deadlineMs) break
    try { if (await draftFollowUp(r.id, r.step + 1)) report.followUps = (report.followUps || 0) + 1 } catch (e) { report.error = 'follow-up: ' + e.message }
  }
  // Install 21: find more businesses when the pipeline runs low
  if (Date.now() - t0 < deadlineMs) try { const f = await autoFind(); if (f) report.found = f } catch (e) { report.error = 'find: ' + e.message }
  // Install 21: contact forms go out through the factory's browser
  try { const { maybeStartForms } = await import('./forms'); const f = await maybeStartForms(); if (f) report.forms = f } catch (e) { report.error = 'forms: ' + e.message }
  // Install 19: keep conversations going, check in on "later", and brief Olaitan before each call
  const { draftNudge, draftCheckIn } = await import('./converse')
  for (const r of (await q(`select c.id from sales_companies c where c.status = 'replied' and c.handover is null
      and (select max(sent_at) from sales_outbox o where o.company_id = c.id and o.status = 'sent' and o.step between 9 and 11) < now() - (case
        when exists (select 1 from sales_outbox o where o.company_id = c.id and o.step = 10 and o.status = 'sent' and o.sent_at > coalesce((select max(received_at) from sales_replies r where r.company_id = c.id), 'epoch')) then interval '4 days' else interval '3 days' end)
      and not exists (select 1 from sales_outbox o where o.company_id = c.id and o.status in ('waiting', 'approved', 'held')) limit 2`)).rows) {
    if (Date.now() - t0 > deadlineMs) break
    try { if (await draftNudge(r.id)) report.nudges = (report.nudges || 0) + 1 } catch (e) { report.error = 'nudge: ' + e.message }
  }
  for (const r of (await q("select id from sales_companies where status = 'nurture' and next_touch_after < now() order by next_touch_after limit 2")).rows) {
    if (Date.now() - t0 > deadlineMs) break
    try { if (await draftCheckIn(r.id)) report.checkIns = (report.checkIns || 0) + 1 } catch (e) { report.error = 'check-in: ' + e.message }
  }
  for (const r of (await q("select id from sales_companies where status = 'booked' and brief_at is null limit 1")).rows) {
    if (Date.now() - t0 > deadlineMs) break
    try { const { makeBrief } = await import('./brief'); if (await makeBrief(r.id)) report.briefs = (report.briefs || 0) + 1 } catch (e) { report.error = 'brief: ' + e.message }
  }
  return Object.keys(report).length ? report : null
}

export async function overview() {
  const S = await one('select * from sales_settings where id = 1')
  const by = Object.fromEntries((await q('select status, count(*)::int as n from sales_companies group by status')).rows.map((r) => [r.status, r.n]))
  const ob = Object.fromEntries((await q("select status, count(*)::int as n from sales_outbox where created_at > now() - interval '60 days' group by status")).rows.map((r) => [r.status, r.n]))
  const today = await one("select count(*)::int as n from sales_outbox where status = 'sent' and sent_at > now() - interval '24 hours'")
  const now = String(process.env.SALES_TEST_BASE || '') && process.env.SALES_TEST_NOW ? new Date(process.env.SALES_TEST_NOW) : new Date()
  return { settings: S, companies: by, outbox: ob, sentToday: today.n, capToday: capToday(S, now), blocked: await blocked(S),
    keys: { gmail: gmailReady(), companiesHouse: Src.chReady(), serper: Src.serperReady(), pageSpeed: !!process.env.PAGESPEED_API_KEY } }
}
export async function find({ source, kind, town, country, text, newerThanDays }) {
  const C = ['US', 'GB', 'FR'].includes(country) ? country : NEVER.includes(country) ? null : 'GB'
  if (!C) throw new Src.SourceError('Not there: that country’s law needs consent even for business emails.')
  const on = String((await one('select countries from sales_settings where id = 1')).countries || 'GB,US,FR').split(',')
  if (!on.includes(C)) throw new Src.SourceError(`${COUNTRIES[C].name} is switched off on the Sales screen.`)
  if (source === 'companies_house' && C !== 'GB') throw new Src.SourceError('Companies House is for UK businesses only.')
  let list
  if (source === 'companies_house') list = await Src.companiesHouse({ kind, town, newerThanDays: Number(newerThanDays) || 0 })
  else if (source === 'serper') list = await Src.serperPlaces({ kind, town, country: C })
  else if (source === 'osm') list = await Src.openStreetMap({ kind, town, country: C })
  else if (source === 'manual') list = Src.pasted(text, C)
  else throw new Src.SourceError('Choose where to look.')
  return { found: list.length, added: await Src.saveCompanies(list) }
}
// Install 21: finding businesses by itself. When fewer than 40 are waiting to be researched or written to (and not more
// than once every 3 hours), it searches the next kind of business in the next city, taking turns between the countries
// that are switched on. UK: Companies House when its key is there (it confirms limited companies); otherwise map search.
export const TOWNS = {
  GB: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Bristol', 'Glasgow', 'Edinburgh', 'Liverpool', 'Sheffield', 'Nottingham', 'Cardiff', 'Brighton'],
  US: ['Austin TX', 'Denver CO', 'Miami FL', 'Atlanta GA', 'Seattle WA', 'Phoenix AZ', 'Chicago IL', 'Dallas TX', 'San Diego CA', 'Nashville TN', 'Charlotte NC', 'Boston MA'],
  FR: ['Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Lille', 'Toulouse', 'Nantes', 'Nice', 'Strasbourg', 'Montpellier'],
}
export function nextSearch(S, i) {
  const countries = String(S.countries || 'GB,US,FR').split(',').filter((c) => TOWNS[c]); if (!countries.length) return null
  const kinds = Object.keys(Src.KINDS).filter((k) => S.partners_enabled || !Src.KINDS[k].partner)
  const country = countries[i % countries.length], j = Math.floor(i / countries.length)
  const kind = kinds[j % kinds.length], town = TOWNS[country][Math.floor(j / kinds.length) % TOWNS[country].length]
  const source = country === 'GB' && Src.chReady() ? 'companies_house' : Src.serperReady() || String(process.env.SALES_TEST_BASE || '') ? 'serper' : 'osm'
  return { country, kind, town, source }
}
export async function autoFind() {
  const S = await one('select * from sales_settings where id = 1')
  if (!S.enabled || !S.auto_find) return null
  if (S.found_at && Date.now() - S.found_at.getTime() < 3 * 3600e3) return null
  const p = await one("select count(*)::int n from sales_companies where status in ('new', 'qualified', 'drafted')"); if (p.n >= 40) return null
  const s = nextSearch(S, S.find_cursor || 0); if (!s) return null
  let res
  try { res = await find(s) } catch (e) { res = { error: String(e.message).slice(0, 160) } }
  await q('update sales_settings set find_cursor = find_cursor + 1, found_at = now(), last_find = $1 where id = 1', [JSON.stringify({ ...s, ...res, at: new Date().toISOString() })])
  return { ...s, ...res }
}
// a quick check of each source with the keys in Vercel (one small request each)
export async function testSources() {
  const out = {}
  try { out.companiesHouse = Src.chReady() ? `works (${(await Src.companiesHouse({ kind: 'accounting', town: 'Leeds', max: 5 })).length} found)` : 'no key yet' } catch (e) { out.companiesHouse = e.message }
  try { out.serper = Src.serperReady() ? `works (${(await Src.serperPlaces({ kind: 'dentist', town: 'Austin TX', country: 'US' })).length} found)` : 'no key yet' } catch (e) { out.serper = e.message }
  try { out.openStreetMap = `works (${(await Src.openStreetMap({ kind: 'cafe', town: 'York', country: 'GB' })).length} found)` } catch (e) { out.openStreetMap = e.message }
  out.gmail = gmailReady() ? 'connected' : 'not connected yet'; out.pageSpeed = process.env.PAGESPEED_API_KEY ? 'key added' : 'no key yet (speed checks skipped)'
  return out
}

// ---------- Install 18: the simple Sales screen ----------
const STAGES = [['found', 'Found', ['new', 'error']], ['ready', 'Researched, ready', ['qualified', 'drafted']], ['emailed', 'Emailed', ['contacted']],
  ['talking', 'Talking', ['replied']], ['later', 'Later', ['nurture']], ['booked', 'Call booked', ['booked']], ['won', 'Won', ['won']]]
export async function simpleData() {
  const S = await one('select * from sales_settings where id = 1')
  const by = Object.fromEntries((await q('select status, count(*)::int as n from sales_companies group by status')).rows.map((r) => [r.status, r.n]))
  const stages = STAGES.map(([key, label, sts]) => ({ key, label, n: sts.reduce((a, s) => a + (by[s] || 0), 0) }))
  const waiting = (await one("select count(*)::int n from sales_outbox where status = 'waiting'")).n
  const replies = (await one("select count(*)::int n from sales_replies where not handled and intent not in ('auto_reply', 'bounce', 'opt_out')")).n
  const leads = (await q(`select id, name, country, status, plan, (select json_build_object('token', p.token, 'views', p.views, 'clicks', p.clicks, 'shared', p.shared_at is not null) from sales_previews p where p.company_id = sales_companies.id) as preview from sales_companies where plan is not null and status in ('qualified', 'drafted', 'contacted', 'replied', 'booked', 'nurture')
      order by case status when 'booked' then 0 when 'replied' then 1 when 'contacted' then 2 else 3 end, (plan->>'tier') = 'premium' desc, score desc nulls last limit 6`)).rows
  const today = await one("select count(*)::int as n from sales_outbox where status = 'sent' and sent_at > now() - interval '24 hours'")
  const now = String(process.env.SALES_TEST_BASE || '') && process.env.SALES_TEST_NOW ? new Date(process.env.SALES_TEST_NOW) : new Date()
  const { recentDocs } = await import('./docs')
  // Install 19: upcoming calls (with their brief) and the conversations that need Olaitan
  const calls = (await q(`select b.starts_at, b.name, b.meeting_code, c.id, c.name as company, c.brief_at is not null as brief from sales_bookings b join sales_companies c on c.id = b.company_id
      where b.starts_at > now() - interval '1 hour' order by b.starts_at limit 6`)).rows.map((r) => ({ ...r, starts_at: r.starts_at.toISOString() }))
  const needs = (await q(`select c.id, c.name, c.handover, (select body from sales_replies r where r.company_id = c.id order by id desc limit 1) as said,
      (select id from sales_outbox o where o.company_id = c.id and o.status = 'waiting' order by id desc limit 1) as draft from sales_companies c where c.handover is not null order by (c.handover->>'at') desc limit 6`)).rows
  // Install 21: contact forms and agency partners
  const { formCapToday, formsReady } = await import('./forms'), { formReplyTo } = await import('./write')
  const fm = await one(`select count(*) filter (where status = 'sent' and sent_at >= now() - interval '1 day')::int as today, count(*) filter (where status in ('waiting', 'approved', 'sending'))::int as waiting,
      count(*) filter (where status = 'sent')::int as total from sales_outbox where channel = 'form'`)
  const forms = { enabled: S.forms_enabled, paused: S.forms_paused_reason || null, ready: formsReady(), replyTo: formReplyTo() || null, today: fm.today, waiting: fm.waiting, total: fm.total, cap: await formCapToday(S) }
  const pa = await one(`select count(*)::int as found, count(*) filter (where status in ('contacted', 'replied', 'booked', 'won'))::int as reached from sales_companies c where exists (select 1 from sales_signals s where s.company_id = c.id and s.code = 'AGENCY')`)
  const partners = { enabled: S.partners_enabled, found: pa.found, reached: pa.reached }
  const finding = { on: S.auto_find, last: S.last_find || null }
  // personal previews (mock-ups): how many were made, sent and opened, and the latest opens
  const pv = await one(`select count(*)::int as made, count(*) filter (where shared_at is not null)::int as sent, count(*) filter (where views > 0)::int as opened from sales_previews`)
  const opens = (await q(`select c.id, c.name, p.token, p.views, p.clicks, p.last_view_at from sales_previews p join sales_companies c on c.id = p.company_id where p.views > 0 order by p.last_view_at desc limit 5`)).rows.map((r) => ({ ...r, last_view_at: r.last_view_at.toISOString() }))
  const previews = { enabled: S.previews_enabled !== false, inFirst: !!S.preview_in_first, ...pv, opens }
  return { enabled: S.enabled, autoSend: !S.require_approval, paused: S.paused_reason || null, blocked: await blocked(S), sentToday: today.n, capToday: capToday(S, now),
    countries: String(S.countries || 'GB,US,FR').split(','), stages, waiting, replies, leads, docs: await recentDocs(5), bankSet: !!(S.bank && S.bank.account_number), bank: S.bank || null, calls, needs, forms, partners, finding, previews }
}
