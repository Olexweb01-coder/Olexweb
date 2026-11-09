// Admin → Sales (Olaitan only). lib/sales.
import { currentUser, sameOrigin, ownerOnly } from '@/lib/admin/auth'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { Refused } from '@/lib/admin/content'
import { q, one } from '@/lib/admin/db'
import * as Sales from '@/lib/sales'
import { profileCompany } from '@/lib/sales/profile'
import { draftFirst, checkDraft } from '@/lib/sales/write'
import { SourceError } from '@/lib/sales/sources'
import * as Docs from '@/lib/sales/docs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
const STATUSES = ['new', 'qualified', 'drafted', 'contacted', 'no_email', 'uk_unconfirmed', 'skipped', 'write_failed', 'error', 'replied', 'booked', 'opted_out', 'nurture', 'lost']
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const u = await currentUser().catch(() => null)
  if (!u) return refuse('Sign in first.', 401)
  if (!ownerOnly(u)) return refuse('Only Olaitan can use Sales.', 403)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  return respond(async () => {
    try { return await handle(b) }                     // awaited, so a source's error becomes a plain message
    catch (e) { if (e instanceof SourceError) throw new Refused(e.message); throw e }
  })
}
async function handle(b) {
      switch (b.action) {
        case 'overview': return Sales.overview()
        // Install 18: the simple screen and official documents
        case 'simple': return Sales.simpleData()
        // Install 19: the pre-call brief, and "I've dealt with this one" for a handover
        case 'brief': { const id = Number(b.id); if (!Number.isInteger(id)) throw new Refused('Which business?'); const { makeBrief } = await import('@/lib/sales/brief'); const brief = await makeBrief(id); if (!brief) throw new Refused('That business wasn’t found.'); return { brief } }
        case 'handover-done': { const id = Number(b.id); if (!Number.isInteger(id)) throw new Refused('Which business?'); await q('update sales_companies set handover = null where id = $1', [id]); await q('update sales_replies set handled = true where company_id = $1', [id]); return { ok: true } }
        case 'agent': await q('update sales_settings set enabled = $1, paused_reason = case when $1 then null else paused_reason end where id = 1', [b.on === true]); return { ok: true }
        // Install 21: contact forms and agency partners
        case 'forms': await q('update sales_settings set forms_enabled = $1, forms_paused_reason = case when $1 then null else forms_paused_reason end where id = 1', [b.on === true]); return { ok: true }
        case 'auto-find': await q('update sales_settings set auto_find = $1, found_at = null where id = 1', [b.on === true]); return { ok: true }
        // personal previews: on/off, the link in the first email or only when they say yes, and make or remake one
        case 'previews': await q('update sales_settings set previews_enabled = $1 where id = 1', [b.on === true]); return { ok: true }
        case 'preview-first': await q('update sales_settings set preview_in_first = $1 where id = 1', [b.on === true]); return { ok: true }
        case 'preview': { const id = Number(b.id); if (!Number.isInteger(id)) throw new Refused('Which business?'); const { makePreview } = await import('@/lib/sales/preview'); const p = await makePreview(id, { again: b.again === true }); if (!p) throw new Refused('No mock-up for this one (agencies get the partner pitch instead).'); return p }
        case 'partners': await q('update sales_settings set partners_enabled = $1 where id = 1', [b.on === true]); return { ok: true }
        case 'auto-send': await q('update sales_settings set require_approval = $1 where id = 1', [b.on !== true]); return { ok: true }
        case 'countries': { const list = (Array.isArray(b.list) ? b.list : []).filter((c) => ['GB', 'US', 'FR'].includes(c)); if (!list.length) throw new Refused('Keep at least one country on.'); await q('update sales_settings set countries = $1 where id = 1', [list.join(',')]); return { ok: true } }
        case 'doc-ratecard': return await Docs.makeRateCard({ country: String(b.country || 'US'), currency: b.currency, tier: String(b.tier || 'starter'), client: b.client || null })
        case 'doc-invoice': try { return await Docs.makeInvoice(b) } catch (e) { if (e instanceof Docs.DocError) throw new Refused(e.message); throw e }
        case 'bank': try { return await Docs.saveBank(b) } catch (e) { if (e instanceof Docs.DocError) throw new Refused(e.message); throw e }
        case 'docs': return { docs: await Docs.recentDocs(30) }
        case 'kinds': return { kinds: Object.entries(Sales.KINDS).map(([id, k]) => ({ id, label: k.label })) }
        case 'find': return Sales.find(b)
        case 'test-sources': return Sales.testSources()
        case 'companies': {
          const st = STATUSES.includes(b.status) ? b.status : null
          const rows = (await q(`select c.id, c.name, c.website, c.domain, c.country, c.city, c.category, c.source, c.status, c.score, c.profile_error, c.company_type, c.phone,
            (select json_agg(json_build_object('code', s.code, 'evidence', s.evidence)) from sales_signals s where s.company_id = c.id) as signals,
            (select json_agg(json_build_object('email', k.email, 'status', k.email_status)) from sales_contacts k where k.company_id = c.id) as contacts,
            (select json_build_object('token', p.token, 'views', p.views) from sales_previews p where p.company_id = c.id) as preview
            from sales_companies c where ($1::text is null or c.status = $1) order by c.score desc nulls last, c.id desc limit 200`, [st])).rows
          return { companies: rows }
        }
        case 'profile': return { status: await profileCompany(Number(b.id)) }
        case 'draft': { const id = await draftFirst(Number(b.id)); if (!id) throw new Refused('No email could be drafted (see the company’s reason).'); return { id } }
        case 'skip': await q("update sales_companies set status = 'skipped', profile_error = 'Skipped by you' where id = $1", [Number(b.id)]); return { ok: true }
        case 'outbox': return { items: (await q(`select o.id, o.step, o.subject, o.body, o.status, o.error, o.held_reason, o.sent_at, o.created_at, c.name as company, c.country, c.city, c.website, coalesce(k.email, 'their contact form') as email, o.channel, c.form_url,
            (select json_agg(json_build_object('code', s.code, 'evidence', s.evidence)) from sales_signals s where s.company_id = c.id) as signals
            from sales_outbox o join sales_companies c on c.id = o.company_id left join sales_contacts k on k.id = o.contact_id
            where o.status = any($1) order by o.id desc limit 100`, [b.which === 'sent' ? ['sent', 'failed', 'cancelled', 'rejected'] : ['waiting', 'approved', 'held', 'sending']])).rows }
        case 'approve': await q("update sales_outbox set status = 'approved' where id = $1 and status in ('waiting', 'held')", [Number(b.id)]); return { ok: true }
        case 'reject': await q("update sales_outbox set status = 'rejected' where id = $1 and status in ('waiting', 'held', 'approved')", [Number(b.id)]); return { ok: true }
        case 'edit': {
          const sig = String(b.body || '').replace(/\n\n(The mock-up|La maquette): https?:\/\/\S+/g, '').split('\n\n').slice(0, -1).join('\n\n') || b.body   // the mock-up link line is added by code
          const problems = checkDraft({ subject: b.subject, body: sig.trim() })
          if (problems.length && !b.force) throw new Refused('This email breaks a rule: ' + problems.join('; ') + '. Save anyway?')
          await q("update sales_outbox set subject = $2, body = $3 where id = $1 and status in ('waiting', 'held', 'approved')", [Number(b.id), String(b.subject).slice(0, 120), String(b.body).slice(0, 3000)]); return { ok: true }
        }
        case 'settings': {
          const s = b.settings || {}
          const ch = s.call_hours || {}, days = (Array.isArray(ch.days) ? ch.days : [1, 2, 3, 4, 5]).map(Number).filter((d) => d >= 0 && d <= 6), hhmm = (v, d) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(v || '') ? v : d)
          const hours = { days, from: hhmm(ch.from, '14:00'), to: hhmm(ch.to, '18:00') }; if (hours.from >= hours.to) throw new Refused('Call hours: the end must be after the start.')
          await q(`update sales_settings set enabled = $1, require_approval = $2, daily_cap = $3, start_date = $4, sender_name = $5, postal_address = $6, opt_out_line = $7, call_hours = $8, paused_reason = case when $9 then null else paused_reason end, updated_at = now() where id = 1`,
            [!!s.enabled, s.require_approval !== false, Math.max(1, Math.min(20, Number(s.daily_cap) || 20)), s.start_date || null, String(s.sender_name || 'Olaitan Adebayo').slice(0, 80),
             String(s.postal_address || '').slice(0, 300) || null, String(s.opt_out_line || '').slice(0, 200) || 'Not interested? Reply "no thanks" and I won\'t email again.', JSON.stringify(hours), !!s.resume])
          return Sales.overview()
        }
        case 'dnc-add': { const e = String(b.entry || '').trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, ''); if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$|^[a-z0-9.-]+\.[a-z]{2,}$/.test(e)) throw new Refused('Add an email address or a website (domain).')
          await q('insert into sales_dnc (entry, reason) values ($1, $2) on conflict (entry) do nothing', [e, String(b.reason || '').slice(0, 120) || null])
          await q("update sales_outbox o set status = 'cancelled', error = 'On the do-not-contact list' from sales_contacts k where k.id = o.contact_id and o.status in ('waiting', 'approved', 'held') and (lower(k.email) = $1 or split_part(lower(k.email), '@', 2) = $1)", [e]); return { ok: true } }
        case 'replies': return { replies: (await q(`select r.*, c.name as company, c.website from sales_replies r left join sales_companies c on c.id = r.company_id order by r.id desc limit 100`)).rows }
        case 'reply-done': await q('update sales_replies set handled = true where id = $1', [Number(b.id)]); return { ok: true }
        case 'dnc': return { list: (await q('select entry, reason, created_at from sales_dnc order by created_at desc limit 300')).rows }
        case 'dnc-remove': await q('delete from sales_dnc where entry = $1', [String(b.entry || '').toLowerCase()]); return { ok: true }
        default: throw new Refused('Unknown action.')
      }
}
