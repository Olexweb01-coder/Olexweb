import { currentUser, sameOrigin, clientIp } from '@/lib/admin/auth'
import { invite, setPerms, removeAccess, cancelInvite } from '@/lib/admin/people'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { Refused } from '@/lib/admin/content'
export const dynamic = 'force-dynamic'
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const u = await currentUser(); if (!u) return refuse('Sign in again.', 401)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  const ip = clientIp(), A = { invite, perms: setPerms, remove: removeAccess, cancel: cancelInvite }
  return respond(async () => { if (!A[b.action]) throw new Refused('Unknown action.'); return A[b.action](u, ip, b) })
}
