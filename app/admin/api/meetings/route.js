// Meetings (owner only): create, end, delete, and the host's controls in the room (let speak, stop speaking, remove).
import { currentUser, sameOrigin, ownerOnly } from '@/lib/admin/auth'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { Refused } from '@/lib/admin/content'
import * as M from '@/lib/site/meet'
export const dynamic = 'force-dynamic'
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const u = await currentUser(); if (!u) return refuse('Sign in again.', 401)
  if (!ownerOnly(u)) return refuse('Only Olaitan can do this.', 403)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  return respond(async () => {
    if (b.action === 'create') return M.createMeeting({ title: b.title, speakers: b.speakers }, u)
    if (b.action === 'end') return M.endMeeting(b.code)
    if (b.action === 'delete') return M.deleteMeeting(b.code)
    if (['allow-speak', 'stop-speak', 'remove'].includes(b.action)) return M.hostAction(b.code, b.action, b.identity)
    throw new Refused('Unknown action.')
  })
}
