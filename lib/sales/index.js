// Olex Sales: the background step (every 10 minutes, from quickRun) and what Admin → Sales shows.
// Each step is small: read up to 3 websites, draft up to 2 emails (never more than 2 days' worth waiting), send at most one.
import 'server-only'
import { q, one } from '@/lib/admin/db'
import { profileCompany } from './profile'
import { draftFirst } from './write'
import { sendNext, blocked, capToday, gmailReady } from './send'
import * as Src from './sources'
export { KINDS } from './sources'

export async function salesRun({ deadlineMs = 25000 } = {}) {
  const S = await one('select * from sales_settings where id = 1'); if (!S || !S.enabled) return null
  const t0 = Date.now(), report = {}
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
  const C = country === 'US' ? 'US' : 'GB'
  let list
  if (source === 'companies_house') list = await Src.companiesHouse({ kind, town, newerThanDays: Number(newerThanDays) || 0 })
  else if (source === 'serper') list = await Src.serperPlaces({ kind, town, country: C })
  else if (source === 'osm') list = await Src.openStreetMap({ kind, town, country: C })
  else if (source === 'manual') list = Src.pasted(text, C)
  else throw new Src.SourceError('Choose where to look.')
  return { found: list.length, added: await Src.saveCompanies(list) }
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
