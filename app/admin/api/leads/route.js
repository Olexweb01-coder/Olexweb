// The Leads inbox (owner only).
import { currentUser, sameOrigin, ownerOnly, audit, clientIp } from '@/lib/admin/auth'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { Refused } from '@/lib/admin/content'
import { updateLead, deleteLead } from '@/lib/site/leads'
export const dynamic = 'force-dynamic'
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const u = await currentUser(); if (!u) return refuse('Sign in again.', 401)
  if (!ownerOnly(u)) return refuse('Only Olaitan can see enquiries.', 403)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  const id = Number(b.id); if (!Number.isInteger(id) || id < 1) return refuse('Unknown enquiry.', 400)
  return respond(async () => {
    if (b.action === 'update') { const r = await updateLead(id, b); await audit(u.id, 'lead_updated', { id, status: b.status }, clientIp()); return r }
    if (b.action === 'delete') { const r = await deleteLead(id); await audit(u.id, 'lead_deleted', { id }, clientIp()); return r }
    throw new Refused('Unknown action.')
  })
}
