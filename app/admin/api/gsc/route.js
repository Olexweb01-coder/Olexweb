// Search Console: fetch now (owner only).
import { currentUser, sameOrigin, ownerOnly } from '@/lib/admin/auth'
import { respond, refuse } from '@/lib/admin/respond'
import { Refused } from '@/lib/admin/content'
import { fetchSearchConsole, gscReady } from '@/lib/site/gsc'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const u = await currentUser(); if (!u) return refuse('Sign in again.', 401)
  if (!ownerOnly(u)) return refuse('Only Olaitan can do this.', 403)
  return respond(async () => {
    if (!gscReady()) throw new Refused('Search Console isn’t connected yet: add GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY and GSC_SITE.')
    try { return { rows: await fetchSearchConsole() } } catch (e) { throw new Refused(e.message) }
  })
}
