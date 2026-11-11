// Admin → Downloads (lib/site/apps.js): approve, decline, ban, unban; start and finish a new version's upload
import { currentUser, sameOrigin, ownerOnly, clientIp, audit } from '@/lib/admin/auth'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { decide, startRelease, finishRelease, adminData } from '@/lib/site/apps'
export const dynamic = 'force-dynamic'
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const u = await currentUser(); if (!u) return refuse('Sign in again.', 401)
  if (!ownerOnly(u)) return refuse('Only the owner can do this.', 403)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  return respond(async () => {
    if (b.action === 'data') return adminData()
    if (['approve', 'decline', 'ban', 'unban', 'forget'].includes(b.action)) { const r = await decide(Number(b.id), b.action); await audit(u.id, 'app_access_' + b.action, { id: Number(b.id) }, clientIp()); return r }
    if (b.action === 'start') { try { return await startRelease(String(b.app || ''), b) } catch (e) { if (e.status) throw e; throw new (await import('@/lib/admin/content')).Refused('Couldn’t start the upload: ' + e.message, 500) } }
    if (b.action === 'finish') { const r = await finishRelease(Number(b.id)); await audit(u.id, 'app_release_live', { id: Number(b.id) }, clientIp()); return r }
    return refuse('Unknown action.', 400)
  })
}
