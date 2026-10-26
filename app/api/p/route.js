// Pages built in the admin talk to this: sign up (name), come back later, listening progress, feedback, and short-link taps.
import { sameOrigin, clientIp } from '@/lib/admin/auth'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { Refused } from '@/lib/admin/content'
import { join, me, track, feedback, countTap, PageError } from '@/lib/site/pages'
export const dynamic = 'force-dynamic'
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  return respond(async () => {
    try {
      if (b.action === 'tap') { if (typeof b.slug === 'string') await countTap(b.slug.slice(0, 60)); return { ok: true } }
      if (!Number.isInteger(b.page)) throw new PageError('Request refused.')
      if (b.action === 'join') return await join(b.page, { name: b.name, consent: b.consent, ip: clientIp() })
      if (b.action === 'me') return await me(b.page, b.token)
      if (b.action === 'track') return await track(b.page, b.token, b.part, b.event)
      if (b.action === 'feedback') return await feedback(b.page, b.token, b.text)
      throw new PageError('Unknown action.')
    } catch (e) { if (e instanceof PageError) throw new Refused(e.message); throw e }
  })
}
