// The new app's home (Install 58): everything the signed-in app shows, celebrations seen, photo and banner.
import { sameOrigin } from '@/lib/admin/auth'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { Refused } from '@/lib/admin/content'
import { currentMeetUser } from '@/lib/meet/auth'
import { meetBase, mainOrigin } from '@/lib/site/meet'
import { limit } from '@/lib/meet/limit'
import * as H from '@/lib/meet/home'
export const dynamic = 'force-dynamic'
export async function GET() {
  const mu = await currentMeetUser(); if (!mu) return refuse('Sign in first.', 401)
  return respond(() => H.homeData(mu, meetBase() || mainOrigin() + '/meet'))
}
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const mu = await currentMeetUser(); if (!mu) return refuse('Sign in first.', 401)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  return respond(async () => {
    if (b.action === 'seen') return H.markSeen(mu, b)
    await limit('profile-pic:' + mu.id, 30, 3600)
    if (b.action === 'photo') return H.savePhoto(mu, b.data)
    if (b.action === 'banner') return H.saveBanner(mu, b)
    throw new Refused('Unknown action.')
  })
}
