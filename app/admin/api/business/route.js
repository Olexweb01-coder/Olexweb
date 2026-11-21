// Ventures (owner only): the businesses that make money and their income.
import { currentUser, sameOrigin, ownerOnly } from '@/lib/admin/auth'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { Refused } from '@/lib/admin/content'
import * as B from '@/lib/admin/business'
export const dynamic = 'force-dynamic'
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const u = await currentUser(); if (!u) return refuse('Sign in again.', 401)
  if (!ownerOnly(u)) return refuse('Only Olaitan can do this.', 403)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  return respond(async () => {
    if (b.action === 'list') return B.business()
    if (b.action === 'save') return B.saveVenture(b)
    if (b.action === 'delete') return B.deleteVenture(b.id)
    if (b.action === 'income') return B.addIncome(b)
    if (b.action === 'income-delete') return B.deleteIncome(b.id)
    throw new Refused('Unknown action.')
  })
}
