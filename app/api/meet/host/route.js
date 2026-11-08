// The host's controls inside a meeting: let someone speak, stop them, mute their microphone, remove them, make them a
// co-host, end the meeting. Co-hosts (lib/site/meet.js mustHost) can do all of it except ending and co-host changes.
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
    const h = await mustHost(b.code, u, mu, { as: b.as, seat: b.seat })                 // the host, or a co-host proving their seat
    if (b.action === 'end') { if (h.cohost) throw new Refused('Only the host can end the meeting for everyone.', 403); return endMeeting(b.code) }
    if (['allow-speak', 'stop-speak', 'remove', 'mute', 'make-cohost', 'unmake-cohost'].includes(b.action)) return hostAction(b.code, b.action, b.identity, h)
    throw new Refused('Unknown action.')
  })
}
