// Clients send reviews here from their review link. Nothing is published without Olaitan's approval.
import { sameOrigin, clientIp } from '@/lib/admin/auth'
import { submitReview } from '@/lib/admin/reviews'
import { respond, refuse, readJson } from '@/lib/admin/respond'
export const dynamic = 'force-dynamic'
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  return respond(() => submitReview(b, clientIp()))
}
