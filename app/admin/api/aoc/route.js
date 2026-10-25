// Course & links (owner only): the WhatsApp link's number and message, the course content and goal, removing a name.
import { currentUser, sameOrigin, ownerOnly } from '@/lib/admin/auth'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { Refused } from '@/lib/admin/content'
import { saveLink, saveContent, removeListener, setAccepting, AocError } from '@/lib/site/aoc'
export const dynamic = 'force-dynamic'
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const u = await currentUser(); if (!u) return refuse('Sign in again.', 401)
  if (!ownerOnly(u)) return refuse('Only Olaitan can do this.', 403)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  return respond(async () => {
    try {
      if (b.action === 'save-link') return await saveLink(b)
      if (b.action === 'save-content') return await saveContent(b.content || {})
      if (b.action === 'accepting') return await setAccepting(b.on)
      if (b.action === 'remove') { if (!Number.isInteger(b.id)) throw new AocError('Request refused.'); return await removeListener(b.id) }
      throw new AocError('Unknown action.')
    } catch (e) { if (e instanceof AocError) throw new Refused(e.message); throw e }
  })
}
