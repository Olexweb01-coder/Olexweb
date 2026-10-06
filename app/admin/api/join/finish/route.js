import { sameOrigin, clientIp } from '@/lib/admin/auth'
import { joinFinish } from '@/lib/admin/people'
import { respond, refuse, readJson } from '@/lib/admin/respond'
export const dynamic = 'force-dynamic'
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  return respond(() => joinFinish(b, clientIp()))
}
