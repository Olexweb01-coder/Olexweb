// YouTube actions (owner only): fetch the numbers now, or disconnect the channel.
import { currentUser, sameOrigin, ownerOnly, clientIp } from '@/lib/admin/auth'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { Refused } from '@/lib/admin/content'
import { syncYouTube, disconnect, YtError } from '@/lib/site/youtube'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 120
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const u = await currentUser(); if (!u) return refuse('Sign in again.', 401)
  if (!ownerOnly(u)) return refuse('Only Olaitan can do this.', 403)
  const body = await readJson(request); if (!body) return refuse('Request refused.', 400)
  return respond(async () => {
    if (body.action === 'sync') { try { return await syncYouTube() } catch (e) { if (e instanceof YtError) throw new Refused(e.message); throw e } }
    if (body.action === 'disconnect') { await disconnect(u.id, clientIp()); return { ok: true } }
    throw new Refused('Unknown action.')
  })
}
