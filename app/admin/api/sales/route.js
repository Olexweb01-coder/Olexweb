// Admin → Sales (Olaitan only). lib/sales.
import { currentUser, sameOrigin, ownerOnly } from '@/lib/admin/auth'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { Refused } from '@/lib/admin/content'
import { q, one } from '@/lib/admin/db'
import * as Sales from '@/lib/sales'
import { profileCompany } from '@/lib/sales/profile'
import { draftFirst, checkDraft } from '@/lib/sales/write'
import { SourceError } from '@/lib/sales/sources'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
const STATUSES = ['new', 'qualified', 'drafted', 'contacted', 'no_email', 'uk_unconfirmed', 'skipped', 'write_failed', 'error', 'replied', 'booked', 'opted_out']
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
        case 'kinds': return { kinds: Object.entries(Sales.KINDS).map(([id, k]) => ({ id, label: k.label })) }
        case 'find': return Sales.find(b)
        case 'test-sources': return Sales.testSources()
        case 'companies': {
          const st = STATUSES.includes(b.status) ? b.status : null
          const rows = (await q(`select c.id, c.name, c.website, c.domain, c.country, c.city, c.category, c.source, c.status, c.score, c.profile_error, c.company_type, c.phone,
            (select json_agg(json_build_object('code', s.code, 'evidence', s.evidence)) from sales_signals s where s.company_id = c.id) as signals,
            (select json_agg(json_build_object('email', k.email, 'status', k.email_status)) from sales_contacts k where k.company_id = c.id) as contacts
            from sales_companies c where ($1::text is null or c.status = $1) order by c.score desc nulls last, c.id desc limit 200`, [st])).rows
          return { companies: rows }
        }
        case 'profile': return { status: await profileCompany(Number(b.id)) }
        case 'draft': { const id = await draftFirst(Number(b.id)); if (!id) throw new Refused('No email could be drafted (see the company’s reason).'); return { id } }
        case 'skip': await q("update sales_companies set status = 'skipped', profile_error = 'Skipped by you' where id = $1", [Number(b.id)]); return { ok: true }
        case 'outbox': return { items: (await q(`select o.id, o.subject, o.body, o.status, o.error, o.sent_at, o.created_at, c.name as company, c.country, c.city, c.website, k.email,
            (select json_agg(json_build_object('code', s.code, 'evidence', s.evidence)) from sales_signals s where s.company_id = c.id) as signals
            from sales_outbox o join sales_companies c on c.id = o.company_id join sales_contacts k on k.id = o.contact_id
            where o.status = any($1) order by o.id desc limit 100`, [b.which === 'sent' ? ['sent', 'failed', 'cancelled', 'rejected'] : ['waiting', 'approved', 'held']])).rows }
        case 'approve': await q("update sales_outbox set status = 'approved' where id = $1 and status in ('waiting', 'held')", [Number(b.id)]); return { ok: true }
        case 'reject': await q("update sales_outbox set status = 'rejected' where id = $1 and status in ('waiting', 'held', 'approved')", [Number(b.id)]); return { ok: true }
        case 'edit': {
          const sig = String(b.body || '').split('\n\n').slice(0, -1).join('\n\n') || b.body
          const problems = checkDraft({ subject: b.subject, body: sig.trim() })
          if (problems.length && !b.force) throw new Refused('This email breaks a rule: ' + problems.join('; ') + '. Save anyway?')
          await q("update sales_outbox set subject = $2, body = $3 where id = $1 and status in ('waiting', 'held', 'approved')", [Number(b.id), String(b.subject).slice(0, 120), String(b.body).slice(0, 3000)]); return { ok: true }
        }
        case 'settings': {
          const s = b.settings || {}
          await q(`update sales_settings set enabled = $1, require_approval = $2, daily_cap = $3, start_date = $4, sender_name = $5, postal_address = $6, opt_out_line = $7, updated_at = now() where id = 1`,
            [!!s.enabled, s.require_approval !== false, Math.max(1, Math.min(20, Number(s.daily_cap) || 20)), s.start_date || null, String(s.sender_name || 'Olaitan Adebayo').slice(0, 80),
             String(s.postal_address || '').slice(0, 300) || null, String(s.opt_out_line || '').slice(0, 200) || 'Not interested? Reply "no thanks" and I won\'t email again.'])
          return Sales.overview()
        }
        case 'dnc-add': { const e = String(b.entry || '').trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, ''); if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$|^[a-z0-9.-]+\.[a-z]{2,}$/.test(e)) throw new Refused('Add an email address or a website (domain).')
          await q('insert into sales_dnc (entry, reason) values ($1, $2) on conflict (entry) do nothing', [e, String(b.reason || '').slice(0, 120) || null])
          await q("update sales_outbox o set status = 'cancelled', error = 'On the do-not-contact list' from sales_contacts k where k.id = o.contact_id and o.status in ('waiting', 'approved', 'held') and (lower(k.email) = $1 or split_part(lower(k.email), '@', 2) = $1)", [e]); return { ok: true } }
        case 'dnc': return { list: (await q('select entry, reason, created_at from sales_dnc order by created_at desc limit 300')).rows }
        case 'dnc-remove': await q('delete from sales_dnc where entry = $1', [String(b.entry || '').toLowerCase()]); return { ok: true }
        default: throw new Refused('Unknown action.')
      }
}
