// The dashboard's community part (badges, streak, recap, leaderboard, invite link, profile) and following a host.
import { sameOrigin } from '@/lib/admin/auth'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { Refused } from '@/lib/admin/content'
import { currentMeetUser } from '@/lib/meet/auth'
import { meetBase, mainOrigin } from '@/lib/site/meet'
import { limit } from '@/lib/meet/limit'
import * as C from '@/lib/meet/community'
export const dynamic = 'force-dynamic'
export async function GET() {
  const mu = await currentMeetUser(); if (!mu) return refuse('Sign in first.', 401)
  return respond(() => C.myCommunity(mu, meetBase() || mainOrigin() + '/meet'))
}
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const mu = await currentMeetUser(); if (!mu) return refuse('Sign in to follow hosts.', 401)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  return respond(async () => {
    await limit('community:' + mu.id, 60, 3600)
    if (b.action === 'profile') return C.saveProfile(mu, b)
    if (b.action === 'follow') return C.follow(mu, b.handle, b.on !== false)
    throw new Refused('Unknown action.')
  })
}
