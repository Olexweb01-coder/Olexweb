// Project enquiries from olexweb.com/start (public, from this site only).
import { headers } from 'next/headers'
import { sameOrigin, clientIp } from '@/lib/admin/auth'
import { submitLead } from '@/lib/site/leads'
import { respond, refuse, readJson } from '@/lib/admin/respond'
export const dynamic = 'force-dynamic'
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  return respond(() => submitLead(b, clientIp(), headers().get('user-agent') || ''))
}
