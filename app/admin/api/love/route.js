// Admin → Our Space: list spaces, new invite links, ban or unban, erase a space (lib/site/love.js). Owner only.
import { currentUser, sameOrigin, ownerOnly, clientIp, audit } from '@/lib/admin/auth'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { loveSpaces, loveInvite, loveBan, loveDelete } from '@/lib/site/love'
export const dynamic = 'force-dynamic'
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const u = await currentUser(); if (!u) return refuse('Sign in again.', 401)
  if (!ownerOnly(u)) return refuse('Only the owner can do this.', 403)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  return respond(async () => {
    if (b.action === 'spaces') return loveSpaces()
    if (b.action === 'invite') { const r = await loveInvite(b.id, b.role); await audit(u.id, 'love_invite', { id: b.id, role: b.role }, clientIp()); return r }
    if (b.action === 'ban' || b.action === 'unban') { const r = await loveBan(b.id, b.role, b.action === 'ban'); await audit(u.id, 'love_' + b.action, { id: b.id, role: b.role }, clientIp()); return r }
    if (b.action === 'delete') { const r = await loveDelete(b.id, b.confirm); if (!r.confirmNeeded) await audit(u.id, 'love_delete', { id: b.id }, clientIp()); return r }
    return refuse('Unknown action.', 400)
  })
}
