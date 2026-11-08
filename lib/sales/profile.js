// Olex Sales: read a business's own website for honest signals and published email addresses, then qualify it.
// Signals (each with evidence): NO_WEBSITE, SITE_DOWN, NO_HTTPS, NOT_MOBILE, OLD_COPYRIGHT, NO_BOOKING, SLOW_MOBILE
// (Google PageSpeed, free key PAGESPEED_API_KEY), PLATFORM. Emails: only ones printed on the business's own pages, and
// only if the domain can receive mail (MX). UK: emailed only once Companies House confirms a limited company (PECR).
// Fetching goes through safeFetch (refuses private and internal addresses).
import 'server-only'
import { promises as dns } from 'node:dns'
import { q, one } from '@/lib/admin/db'
import { safeFetch } from '@/lib/assistant/net'
import { CUES, planCompany } from './tier'
import { NEVER } from './playbook'
import { findWebsite, chConfirm, limitedType, domainOf, isDirectory } from './sources'

const T = () => String(process.env.SALES_TEST_BASE || '').replace(/\/$/, '')
const YEAR = () => new Date().getUTCFullYear()
const BOOKING = /\b(book (an? )?(appointment|table|online|now)|online booking|book online|reserve (a|your) table|schedule (an? )?(appointment|consultation))\b|calendly\.com|acuityscheduling|booksy\.com|fresha\.com|treatwell|opentable\.|resy\.com|squareup\.com\/appointments|setmore|simplybook|vagaro|dentally|zocdoc|mindbody|tablein|sevenrooms|youcanbook\.me/i
const BOOKING_KINDS = /dentist|clinic|salon|restaurant|caf|therap|beauty|hair/i
const PLATFORM = [['Wix', /wixstatic\.com|wix\.com/i], ['Squarespace', /squarespace/i], ['WordPress', /wp-content|wordpress/i], ['GoDaddy', /godaddy|img1\.wsimg\.com/i], ['Shopify', /cdn\.shopify\.com/i], ['Webflow', /webflow/i]]
const BAD_EMAIL = /\.(png|jpe?g|gif|webp|svg)$|^(example|test|name|your|you|email|user)@|@(example|domain|email|sentry|wixpress|sentry-next)\./i
const GENERIC = /^(info|hello|office|contact|enquiries|enquiry|inquiries|admin|reception|bookings|booking|appointments|mail|team|studio|practice|hi)@/i

const signal = (id, code, { num = null, text = null, evidence = null } = {}) =>
  q(`insert into sales_signals (company_id, code, value_num, value_text, evidence) values ($1, $2, $3, $4, $5)
     on conflict (company_id, code) do update set value_num = excluded.value_num, value_text = excluded.value_text, evidence = excluded.evidence, observed_at = now()`, [id, code, num, text, evidence])

export function emailsIn(html, domain) {
  const found = new Set()
  const decoded = String(html || '').replace(/&#64;|&commat;|\s?\[at\]\s?|\s?\(at\)\s?/gi, '@').replace(/\s?\[dot\]\s?|\s?\(dot\)\s?/gi, '.')
  for (const m of decoded.matchAll(/mailto:([^"'?>\s]+)/gi)) found.add(decodeURIComponent(m[1]).toLowerCase())
  for (const m of decoded.replace(/<[^>]+>/g, ' ').matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}/gi)) found.add(m[0].toLowerCase())
  const own = (e) => domain && (e.endsWith('@' + domain) || e.endsWith('.' + domain))
  return [...found].filter((e) => !BAD_EMAIL.test(e) && e.length < 120).sort((a, b) => (own(b) - own(a)) || (GENERIC.test(b) - GENERIC.test(a)))
}
export async function canReceive(domain) {
  if (T()) return !/nomx/.test(domain)                                                   // tests: domains containing "nomx" have no mail server
  try { const mx = await dns.resolveMx(domain); return mx.length > 0 } catch { return false }
}
async function pageSpeed(url) {
  if (!process.env.PAGESPEED_API_KEY && !T()) return null
  const base = T() ? T() + '/psi' : 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'
  try {
    const r = await fetch(`${base}?${new URLSearchParams({ url, strategy: 'mobile', category: 'performance', key: process.env.PAGESPEED_API_KEY || 'test' })}`, { signal: AbortSignal.timeout(60000), cache: 'no-store' })
    if (!r.ok) return null
    const j = await r.json(), L = j.lighthouseResult || {}
    return { score: Math.round(((L.categories || {}).performance || {}).score * 100), lcp: ((L.audits || {})['largest-contentful-paint'] || {}).numericValue || null }
  } catch { return null }
}

// read one company; returns its new status
export async function profileCompany(id) {
  const c = await one('select * from sales_companies where id = $1', [id]); if (!c) return null
  await q("delete from sales_signals where company_id = $1", [id])
  // UK: confirm a limited company (only those may be emailed without prior consent)
  if (c.country === 'GB' && !limitedType(c.company_type)) {
    const ch = await chConfirm(c.name, c.city).catch(() => null)
    if (ch) { await q('update sales_companies set ch_number = $2, company_type = $3 where id = $1', [id, ch.ch_number, ch.company_type]); c.company_type = ch.company_type }
  }
  // the website: known, or found by search
  if (!c.domain) {
    const w = await findWebsite(c.name, c.city, c.country).catch(() => null)
    if (w && !(await one('select 1 from sales_companies where lower(domain) = lower($1) and id <> $2', [w.domain, id]))) { await q('update sales_companies set website = $2, domain = $3 where id = $1', [id, w.website, w.domain]); Object.assign(c, w) }
  }
  if (!c.domain) {
    await signal(id, 'NO_WEBSITE', { evidence: c.phone ? `Listed with phone ${c.phone}, no website found` : 'No website found' })
    return finish(c, [])
  }
  const home = T() ? `${T()}/site/${c.domain}/` : `https://${c.domain}/`
  const ok = (p) => !p.error && p.status >= 200 && p.status < 400
  let page = await safeFetch(home, { maxBytes: 1_200_000, timeoutMs: 12000, allowHttp: true }).catch((e) => ({ error: e.message }))
  if (!ok(page) && !T()) page = await safeFetch(`http://${c.domain}/`, { maxBytes: 1_200_000, timeoutMs: 12000, allowHttp: true }).catch((e) => ({ error: e.message }))   // some old sites only work without https
  if (!ok(page)) { await signal(id, 'SITE_DOWN', { evidence: page.error ? 'The website didn’t load' : `The website answered ${page.status}` }); return finish(c, []) }
  const html = String(page.text || ''), finalUrl = String(page.url || home)
  if (!T() && finalUrl.startsWith('http:')) await signal(id, 'NO_HTTPS', { evidence: 'The site has no padlock (not HTTPS)' })
  if (T() && /nohttps/.test(c.domain)) await signal(id, 'NO_HTTPS', { evidence: 'The site has no padlock (not HTTPS)' })
  if (!/<meta[^>]+name=["']viewport["']/i.test(html)) await signal(id, 'NOT_MOBILE', { evidence: 'No mobile layout (no viewport setting)' })
  const years = [...html.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi)].map((m) => Number(m[1])).filter((y) => y > 1995 && y <= YEAR())
  if (years.length && Math.max(...years) <= YEAR() - 3) await signal(id, 'OLD_COPYRIGHT', { num: Math.max(...years), evidence: `Footer says © ${Math.max(...years)}` })
  for (const [name, re] of PLATFORM) if (re.test(html)) { await signal(id, 'PLATFORM', { text: name, evidence: `Built with ${name}` }); break }
  // signs of a bigger business (Install 18): they raise the price level, never lower it
  const words = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
  for (const [code, re, , why] of CUES) { const m = words.match(re); if (m) await signal(id, code, { evidence: `Their site says “${m[0].slice(0, 60)}” (${why})` }) }
  // a contact page often has the email
  let emails = emailsIn(html, c.domain), booking = BOOKING.test(html)
  const links = [...html.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]{0,80}?)<\/a>/gi)].map((m) => [m[1], m[2]])
  const contact = links.find(([h, t]) => CONTACT.test(h + ' ' + t)) || links.find(([h, t]) => /about|team/i.test(h + ' ' + t))
  let form = formIn(html) ? { url: T() ? `${T()}/site/${c.domain}/` : finalUrl, captcha: CAPTCHA.test(html) } : null   // Install 21: a contact form the agent can use
  if (contact && (emails.length === 0 || !form)) {
    try {
      const u = new URL(contact[0], T() ? `https://${c.domain}/` : finalUrl); if (domainOf(u.href) === c.domain) {   // links are read relative to the business's own site
        const at = T() ? `${T()}/site/${c.domain}${u.pathname}` : u.href
        const p2 = await safeFetch(at, { maxBytes: 800_000, timeoutMs: 10000, allowHttp: true })
        if (ok(p2)) {
          if (emails.length === 0) emails = emailsIn(p2.text, c.domain)
          booking = booking || BOOKING.test(p2.text || '')
          if (!form && CONTACT.test(contact[0] + ' ' + contact[1])) form = formIn(p2.text) || BUILDER.test(html) ? { url: at, captcha: CAPTCHA.test(p2.text || ''), maybe: !formIn(p2.text) } : null   // site builders draw forms with script: the factory checks
        }
      }
    } catch {}
  }
  await q('update sales_companies set form_url = $2, form_note = $3 where id = $1', [id, form && !form.captcha ? form.url : null, form && form.captcha ? 'Their contact form has a robot check' : null])
  // Install 21: an agency (a possible partner) is read for what it sells, not for what's wrong with its own site
  if (/Agencies \(partners\)/.test(c.category || '')) {
    const m = words.match(AGENCY_WORDS)
    if (m) await signal(id, 'AGENCY', { evidence: `Their site says “${m[0].slice(0, 50)}” (they sell this to clients)` })
  }
  if (!booking && BOOKING_KINDS.test(c.category || '')) await signal(id, 'NO_BOOKING', { evidence: 'No way to book online' })
  const ps = await pageSpeed(finalUrl)
  if (ps && ps.score < 50) await signal(id, 'SLOW_MOBILE', { num: ps.score, text: ps.lcp ? (ps.lcp / 1000).toFixed(1) : null, evidence: `Google PageSpeed (mobile): ${ps.score}/100${ps.lcp ? `, main content after ${(ps.lcp / 1000).toFixed(1)} s` : ''}` })
  return finish(c, emails, finalUrl)
}

// Install 21: contact forms. A form with a message box; robot checks (reCAPTCHA, hCaptcha, Turnstile) are never attempted
const CONTACT = /contact|get-in-touch|enquir|inquir|contactez|nous-contacter|devis/i
const CAPTCHA = /g-recaptcha|recaptcha\/api|grecaptcha|hcaptcha|cf-turnstile|challenges\.cloudflare\.com\/turnstile|friendlycaptcha/i
const BUILDER = /wix\.com|squarespace|webflow|godaddy|weebly|jimdo|duda|elementor|wpforms|contact-form-7|gravityforms|hsforms|typeform|jotform/i
const formIn = (h) => /<form[\s\S]{0,6000}?<textarea/i.test(String(h || ''))
const AGENCY_WORDS = /\b(web ?design|website design|web development|websites? for|branding|brand identity|digital (marketing|agency)|marketing agency|seo|ui\/ux|création de sites?|agence (web|digitale|de communication))\b/i
const WEIGHT = { AGENCY: 9, NO_WEBSITE: 9, SITE_DOWN: 8, SLOW_MOBILE: 8, NOT_MOBILE: 8, NO_HTTPS: 7, NO_BOOKING: 6, OLD_COPYRIGHT: 6 }
async function finish(c, emails, url) {
  for (const e of emails.slice(0, 3)) {
    const d = e.split('@')[1]
    if (await one('select 1 from sales_dnc where entry = $1 or entry = $2', [e, d])) continue
    const ok = await canReceive(d)
    await q(`insert into sales_contacts (company_id, email, email_status, source_url) values ($1, $2, $3, $4) on conflict ((lower(email))) do nothing`, [c.id, e, ok ? 'deliverable' : 'invalid', url || null])
  }
  for (const k of (await q("select id, email from sales_contacts where company_id = $1 and email_status = 'unchecked'", [c.id])).rows)   // e.g. from an OpenStreetMap listing
    await q('update sales_contacts set email_status = $2 where id = $1', [k.id, (await canReceive(k.email.split('@')[1])) ? 'deliverable' : 'invalid'])
  const sig = (await q('select code from sales_signals where company_id = $1', [c.id])).rows.map((r) => r.code)
  const weights = sig.map((s) => WEIGHT[s] || 0).filter(Boolean).sort((a, b) => b - a)
  const score = weights.length ? Math.min(10, weights[0] + (weights.length - 1)) : 0
  const reachable = await one("select 1 from sales_contacts where company_id = $1 and email_status = 'deliverable' and opted_out_at is null", [c.id])
  const f = await one('select form_url, form_note from sales_companies where id = $1', [c.id]), S = await one('select forms_enabled, partners_enabled from sales_settings where id = 1')
  const viaForm = !reachable && f.form_url && S && S.forms_enabled                 // Install 21: no published email, but a contact form
  let status = 'qualified', why = null
  if (/Agencies \(partners\)/.test(c.category || '') && !sig.includes('AGENCY')) { status = 'skipped'; why = 'Doesn’t look like an agency that sells websites' }   // found as an agency: only real ones get the partner pitch
  else if (!weights.length) { status = 'skipped'; why = 'Nothing to improve was found on their website' }
  else if (sig.includes('AGENCY') && S && !S.partners_enabled) { status = 'skipped'; why = 'Agency partners are switched off' }
  else if (!reachable && !viaForm) { status = 'no_email'; why = (f.form_note ? f.form_note + '; ' : '') + (c.phone ? `No published email (phone: ${c.phone})` : 'No published email') }
  else if (NEVER.includes(c.country)) { status = 'skipped'; why = 'This country’s law needs consent even for business emails' }
  else if (c.country === 'GB' && !limitedType(c.company_type)) { status = 'uk_unconfirmed'; why = 'UK law: only limited companies can be emailed without consent, and Companies House didn’t confirm this one' }
  await q('update sales_companies set status = $2, score = $3, profiled_at = now(), profile_error = $4, channel = $5 where id = $1', [c.id, status, score, why, reachable ? 'email' : viaForm ? 'form' : null])
  await planCompany(c.id).catch(() => {})                              // the agent's read: level, offer, price, angle, language (Install 18)
  return status
}
