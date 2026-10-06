import { currentUser, sameOrigin, clientIp } from '@/lib/admin/auth'
import { decide, addTestimonial, newLink, switchOffLink } from '@/lib/admin/reviews'
import { respond, refuse, readJson } from '@/lib/admin/respond'
export const dynamic = 'force-dynamic'
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const u = await currentUser(); if (!u) return refuse('Sign in again.', 401)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  const ip = clientIp()
  return respond(async () => {
    if (b.action === 'add') return addTestimonial(u, ip, b.data || {})
    if (b.action === 'link-new') return { link: await newLink(u, ip) }
    if (b.action === 'link-off') { await switchOffLink(u, ip); return { ok: true } }
    return decide(u, ip, b)
  })
}
