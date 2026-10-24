// The audio course page talks to this: join (name + tick), listening progress, and "what I learned".
import { sameOrigin, clientIp } from '@/lib/admin/auth'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { join, track, feedback, AocError } from '@/lib/site/aoc'
import { Refused } from '@/lib/admin/content'
export const dynamic = 'force-dynamic'
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  return respond(async () => {
    try {
      if (b.action === 'join') return await join(b, clientIp())
      if (b.action === 'track') return await track(b)
      if (b.action === 'feedback') return await feedback(b)
      throw new AocError('Unknown action.')
    } catch (e) { if (e instanceof AocError) throw new Refused(e.message); throw e }
  })
}
