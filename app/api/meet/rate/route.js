// Rating a meeting (1 to 5 stars and an optional review), by anyone who was in it, the host too. The key proves the
// person really joined (it's made by the server when they join), so nobody can rate in someone else's name.
import { sameOrigin } from '@/lib/admin/auth'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { rateMeeting } from '@/lib/site/meet'
import { currentMeetUser } from '@/lib/meet/auth'
export const dynamic = 'force-dynamic'
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  const mu = await currentMeetUser()
  return respond(() => rateMeeting(b, mu))
}
