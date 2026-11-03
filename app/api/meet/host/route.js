// The host's controls inside a meeting: let someone speak, stop them, remove them, end the meeting.
// For whoever hosts it (lib/site/meet.js isHost): Olaitan in the admin, or the Meet account that made it. Same-site only.
import { currentUser, sameOrigin } from '@/lib/admin/auth'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { Refused } from '@/lib/admin/content'
import { currentMeetUser } from '@/lib/meet/auth'
import { mustHost, hostAction, endMeeting } from '@/lib/site/meet'
export const dynamic = 'force-dynamic'
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  const u = await currentUser().catch(() => null), mu = await currentMeetUser()
  return respond(async () => {
    await mustHost(b.code, u, mu)
    if (b.action === 'end') return endMeeting(b.code)
    if (['allow-speak', 'stop-speak', 'remove'].includes(b.action)) return hostAction(b.code, b.action, b.identity)
    throw new Refused('Unknown action.')
  })
}
