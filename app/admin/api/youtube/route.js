// YouTube actions (owner only): fetch the numbers now, disconnect, find ideas now, pick or skip an idea.
import { currentUser, sameOrigin, ownerOnly, clientIp } from '@/lib/admin/auth'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { Refused } from '@/lib/admin/content'
import { syncYouTube, disconnect, YtError } from '@/lib/site/youtube'
import { findIdeas, decideIdea } from '@/lib/site/ideas'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 300
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const u = await currentUser(); if (!u) return refuse('Sign in again.', 401)
  if (!ownerOnly(u)) return refuse('Only Olaitan can do this.', 403)
  const body = await readJson(request); if (!body) return refuse('Request refused.', 400)
  return respond(async () => {
    if (body.action === 'sync') { try { return await syncYouTube() } catch (e) { if (e instanceof YtError) throw new Refused(e.message); throw e } }
    if (body.action === 'disconnect') { await disconnect(u.id, clientIp()); return { ok: true } }
    if (body.action === 'find-ideas') { try { return await findIdeas() } catch (e) { throw new Refused(/already running|busy|limit|AI key/i.test(e.message) ? e.message : 'The search for ideas failed: ' + e.message) } }
    if (body.action === 'decide') {
      if (!['picked', 'skipped', 'new'].includes(body.status) || !Number.isInteger(body.id)) throw new Refused('Request refused.')
      const r = await decideIdea(body.id, body.status); if (!r) throw new Refused('That idea is no longer there.'); return r
    }
    throw new Refused('Unknown action.')
  })
}
