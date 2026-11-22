// A signed-in Meet account's own meetings: list, create (now or scheduled), change, end, delete. Same-site only.
import { sameOrigin } from '@/lib/admin/auth'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { Refused } from '@/lib/admin/content'
import { currentMeetUser } from '@/lib/meet/auth'
import * as M from '@/lib/site/meet'
import { canCreate } from '@/lib/meet/usage'
import { pricing, planOf, mustNotOwe } from '@/lib/meet/plans'
export const dynamic = 'force-dynamic'
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const mu = await currentMeetUser(); if (!mu) return refuse('Sign in to create or schedule meetings.', 401)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  return respond(async () => {
    if (b.action === 'room') return (await import('@/lib/meet/pro')).myRoom(mu)    // Install D: their personal room
    if (b.action === 'list') {
      const all = await M.myMeetings(mu), p = await pricing()
      if (!p.on || (await planOf(mu)).pro) return { meetings: all }
      const past = all.filter((m) => m.endedAt)                                 // Free (pricing on): the last 3 ended meetings; Pro: all
      return { meetings: all.filter((m) => !m.endedAt || past.indexOf(m) < 3), morePast: Math.max(0, past.length - 3) }
    }
    if (b.action === 'create') {
      const owner = mu.role === 'owner'
      if (!owner) await mustNotOwe(mu.id)                                    // an unpaid invoice pauses new meetings
      await canCreate(owner)                                              // paused near the monthly limit (not for Olaitan)
      const wantsPro = b.kind === 'webinar' || !!(b.slug && String(b.slug).trim())   // Install 58l: checked before anything is made
      if (wantsPro && !owner && !(await (await import('@/lib/meet/plans')).proById(mu.id))) throw new Refused(b.kind === 'webinar' ? 'Webinars are for Pro hosts. Go Pro to run one.' : 'Branded links are for Pro hosts. Go Pro to choose your own link.', 402)
      const r = await M.createMeeting({ title: b.title, speakers: b.speakers, mode: b.mode, private: !!b.private, certs: !!b.certs, followup: !!b.followup, startsAt: b.startsAt, minutes: b.minutes, form: b.form || null, ...(owner && Array.isArray(b.reminders) ? { reminders: b.reminders } : {}) }, null, { hostUser: mu.id, pushes: owner })
      if (b.kind || b.regRequired || b.slug) { const o = await M.meetingOptions(r.code, { kind: b.kind, regRequired: b.regRequired, slug: b.slug || undefined }, mu).catch(async (e) => { await M.deleteMeeting(r.code).catch(() => {}); throw e }); return { ...r, ...o } }   // Install 58l
      return { ...r, link: M.meetLink(r.code) }
    }
    if (!['update', 'end', 'delete', 'options'].includes(b.action)) throw new Refused('Unknown action.')
    await M.mustHost(b.code, null, mu)
    if (b.action === 'end') return M.endMeeting(b.code)
    if (b.action === 'delete') return M.deleteMeeting(b.code)
    if (b.action === 'options') return M.meetingOptions(b.code, { kind: b.kind, regRequired: b.regRequired, slug: b.slug }, mu)   // Install 58l
    const f = {}; for (const k of ['title', 'speakers', 'startsAt', 'minutes', 'form']) if (k in b) f[k] = b[k]
    return M.updateMeeting(b.code, f)
  })
}
