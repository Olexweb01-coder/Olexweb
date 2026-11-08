// Olex Sales, Install 21: contact forms. When a business publishes no email but has a "Contact us" form, the agent's
// message goes through the form instead. The site can't run a browser, so the factory (GitHub Actions, olexweb-factory,
// worker/forms.mjs) does it: the site starts the "forms" workflow; the worker asks for jobs (signed with FACTORY_SECRET),
// fills each form like a person (name, the reply address, the message), sends it, and reports back.
// Limits (plain code): 10 a day to start, 5 more each week the forms work well, up to the cap in settings (40); only in
// the business's office hours; never a form with a robot check; never a country or address on the do-not-contact list.
// If most recent forms fail, or someone complains, sending pauses itself and Olaitan is told.
import 'server-only'
import { q, one } from '@/lib/admin/db'
import { notify } from '@/lib/assistant/notify'
import { zoneOf, inOfficeHours, lagosDay } from './send'
import { formReplyTo } from './write'
import { NEVER } from './playbook'
import { SITE_ORIGIN } from '@/lib/site/youtube'

const T = () => String(process.env.SALES_TEST_BASE || '').replace(/\/$/, '')
const testNow = () => (T() && process.env.SALES_TEST_NOW ? new Date(process.env.SALES_TEST_NOW) : new Date())
export const formsReady = () => !!(formReplyTo() && process.env.FACTORY_GH_TOKEN && process.env.FACTORY_SECRET) || !!T()

// today's limit: 10, then +5 for each full week since the first form went out, up to forms_cap
export async function formCapToday(S) {
  const first = await one("select min(sent_at) t from sales_outbox where channel = 'form' and status = 'sent'")
  const weeks = first.t ? Math.floor((Date.now() - first.t.getTime()) / (7 * 864e5)) : 0
  return Math.max(0, Math.min(S.forms_cap || 40, 10 + 5 * weeks))
}
const sentToday = async () => (await one("select count(*)::int n from sales_outbox where channel = 'form' and status in ('sent', 'sending') and coalesce(sent_at, claimed_at) >= ($1::date - interval '1 hour')", [lagosDay()])).n

// jobs for the factory: due, in office hours, under today's limit. Each is marked "sending" so it's never sent twice.
export async function claimFormJobs(max = 6) {
  const S = await one('select * from sales_settings where id = 1')
  if (!S || !S.enabled || !S.forms_enabled || S.forms_paused_reason || S.paused_reason) return { jobs: [], why: 'Contact forms are off or paused.' }
  // a job handed out over 2 hours ago with no answer: back in the queue once, then given up
  await q("update sales_outbox set status = case when tries >= 2 then 'failed' else 'approved' end, error = case when tries >= 2 then 'The factory never reported back' else error end where channel = 'form' and status = 'sending' and claimed_at < now() - interval '2 hours'")
  const left = (await formCapToday(S)) - (await sentToday()); if (left <= 0) return { jobs: [], why: 'Today’s contact-form limit is reached.' }
  const now = testNow()
  const rows = (await q(`select o.id, o.subject, o.body, c.id as company_id, c.name, c.domain, c.form_url, c.country, c.region, c.city, c.status as company_status from sales_outbox o join sales_companies c on c.id = o.company_id
      where o.channel = 'form' and o.status = 'approved' and (o.send_after is null or o.send_after <= $1) order by o.id limit 40`, [now])).rows
  const jobs = []
  for (const m of rows) {
    if (jobs.length >= Math.min(max, left)) break
    let stop = null
    if (!m.form_url) stop = 'No contact form on record.'
    else if (NEVER.includes(m.country)) stop = 'This country is never contacted.'
    else if (['replied', 'booked', 'won', 'opted_out', 'lost', 'bounced'].includes(m.company_status)) stop = 'They already replied.'
    else if (await one('select 1 from sales_dnc where entry = $1', [String(m.domain || '').toLowerCase()])) stop = 'On the do-not-contact list.'
    if (stop) { await q("update sales_outbox set status = 'cancelled', error = $2 where id = $1", [m.id, stop]); continue }
    if (!inOfficeHours(zoneOf(m), now)) continue                                   // their office hours, like a person
    const r = await one("update sales_outbox set status = 'sending', claimed_at = now(), tries = tries + 1 where id = $1 and status = 'approved' returning id", [m.id]); if (!r) continue
    jobs.push({ id: Number(m.id), url: m.form_url, company: m.name, subject: m.subject, message: m.body, name: S.sender_name || 'Olaitan Adebayo', email: formReplyTo(), org: 'Olexweb', website: 'https://olexweb.com', country: m.country })
  }
  return { jobs }
}

// the factory's answer for one job
const RETRY = /timed? ?out|didn’t load|didn't load|net::|navigation|crash/i
export async function formResult({ id, ok, why, how }) {
  const m = await one("select o.*, c.name from sales_outbox o join sales_companies c on c.id = o.company_id where o.id = $1 and o.channel = 'form' and o.status = 'sending'", [Number(id)])
  if (!m) return false
  if (ok) {
    await q("update sales_outbox set status = 'sent', sent_at = now(), error = null, held_reason = $2 where id = $1", [m.id, how ? String(how).slice(0, 200) : null])
    await q("update sales_companies set status = 'contacted' where id = $1 and status in ('qualified', 'drafted')", [m.company_id])
  } else {
    const reason = String(why || 'The form couldn’t be sent').slice(0, 200)
    if (RETRY.test(reason) && m.tries < 2) await q("update sales_outbox set status = 'approved', error = $2, send_after = now() + interval '1 day' where id = $1", [m.id, reason])
    else {
      await q("update sales_outbox set status = 'failed', error = $2 where id = $1", [m.id, reason])
      await q("update sales_companies set status = 'no_email', profile_error = $2 where id = $1 and status in ('qualified', 'drafted')", [m.company_id, 'Contact form: ' + reason])
    }
  }
  await health()
  return true
}
// most recent forms failing means something changed: pause and tell Olaitan
async function health() {
  const r = await one("select count(*) filter (where status = 'failed')::int f, count(*)::int n from (select status from sales_outbox where channel = 'form' and status in ('sent', 'failed') order by id desc limit 20) x")
  if (r.n >= 10 && r.f / r.n > 0.7) {
    const S = await one('select forms_paused_reason from sales_settings where id = 1'); if (S.forms_paused_reason) return
    await q('update sales_settings set forms_paused_reason = $1 where id = 1', [`Paused: ${r.f} of the last ${r.n} contact forms couldn’t be sent. Check them before resuming.`])
    notify('sales', `Contact forms paused themselves: ${r.f} of the last ${r.n} failed.`, '/admin/sales')
  }
}

// start the factory's "forms" workflow when there's work and it isn't already running (at most every 90 minutes)
export async function maybeStartForms() {
  const S = await one('select * from sales_settings where id = 1')
  if (!S.forms_enabled || S.forms_paused_reason || !formsReady()) return null
  if (S.forms_dispatched_at && Date.now() - S.forms_dispatched_at.getTime() < 90 * 60e3) return null
  const due = await one("select count(*)::int n from sales_outbox where channel = 'form' and status = 'approved' and (send_after is null or send_after <= now())")
  if (!due.n || (await formCapToday(S)) - (await sentToday()) <= 0) return null
  await q('update sales_settings set forms_dispatched_at = now() where id = 1')
  if (T()) return { started: 'test' }                                              // tests run the worker themselves
  const GH = String(process.env.FACTORY_GH_API || 'https://api.github.com').replace(/\/$/, ''), REPO = process.env.FACTORY_REPO || 'Olexweb01-coder/olexweb-factory'
  const r = await fetch(`${GH}/repos/${REPO}/actions/workflows/forms.yml/dispatches`, { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(15000),
    headers: { Authorization: 'Bearer ' + process.env.FACTORY_GH_TOKEN, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    body: JSON.stringify({ ref: 'main', inputs: { api: SITE_ORIGIN() } }) }).catch(() => null)
  if (!r || r.status !== 204) { await q('update sales_settings set forms_dispatched_at = null where id = 1'); return { error: r ? 'GitHub said ' + r.status + ' (push the factory’s forms workflow?)' : 'GitHub didn’t answer' } }
  return { started: true }
}
