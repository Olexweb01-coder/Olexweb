// A signed-in Meet account's own meetings: list, create (now or scheduled), change, end, delete. Same-site only.
import { sameOrigin } from '@/lib/admin/auth'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { Refused } from '@/lib/admin/content'
import { currentMeetUser } from '@/lib/meet/auth'
import * as M from '@/lib/site/meet'
import { canCreate } from '@/lib/meet/usage'
export const dynamic = 'force-dynamic'
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const mu = await currentMeetUser(); if (!mu) return refuse('Sign in to create or schedule meetings.', 401)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  return respond(async () => {
    if (b.action === 'list') return { meetings: await M.myMeetings(mu) }
    if (b.action === 'create') {
      const owner = mu.role === 'owner'
      await canCreate(owner)                                              // paused near the monthly limit (not for Olaitan)
      const r = await M.createMeeting({ title: b.title, speakers: b.speakers, startsAt: b.startsAt, minutes: b.minutes, form: b.form || null, ...(owner && Array.isArray(b.reminders) ? { reminders: b.reminders } : {}) }, null, { hostUser: mu.id, pushes: owner })
      return { ...r, link: M.meetLink(r.code) }
    }
    if (!['update', 'end', 'delete'].includes(b.action)) throw new Refused('Unknown action.')
    await M.mustHost(b.code, null, mu)
    if (b.action === 'end') return M.endMeeting(b.code)
    if (b.action === 'delete') return M.deleteMeeting(b.code)
    const f = {}; for (const k of ['title', 'speakers', 'startsAt', 'minutes', 'form']) if (k in b) f[k] = b[k]
    return M.updateMeeting(b.code, f)
  })
}
