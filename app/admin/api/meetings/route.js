// Meetings (owner only): create, end, delete, and the host's controls in the room (let speak, stop speaking, remove).
import { currentUser, sameOrigin, ownerOnly } from '@/lib/admin/auth'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { Refused } from '@/lib/admin/content'
import * as M from '@/lib/site/meet'
import * as G from '@/lib/meet/guests'
import * as U from '@/lib/meet/usage'
export const dynamic = 'force-dynamic'
export const maxDuration = 300   // notes for a long meeting ask the AI more than once
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const u = await currentUser(); if (!u) return refuse('Sign in again.', 401)
  if (!ownerOnly(u)) return refuse('Only Olaitan can do this.', 403)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  return respond(async () => {
    if (b.action === 'create') return M.createMeeting({ title: b.title, speakers: b.speakers, startsAt: b.startsAt, minutes: b.minutes, reminders: b.reminders, form: b.form || null }, u)
    if (b.action === 'update') { const f = {}; for (const k of ['title', 'speakers', 'startsAt', 'minutes', 'reminders', 'form']) if (k in b) f[k] = b[k]; return M.updateMeeting(b.code, f) }
    if (b.action === 'end') return M.endMeeting(b.code)
    if (b.action === 'delete') return M.deleteMeeting(b.code)
    if (['allow-speak', 'stop-speak', 'remove'].includes(b.action)) return M.hostAction(b.code, b.action, b.identity)
    if (b.action === 'notes') return M.makeNotes(b.code, b.transcript)
    if (b.action === 'get-notes') return M.getNotes(b.code)
    // the Meet app: accounts and reports (lib/meet/guests.js)
    if (b.action === 'meet-admin') return G.adminMeetData(b.search)
    if (b.action === 'usage') return { usage: await U.usageNow(), databases: await U.databases(), presets: U.PRESETS }
    if (b.action === 'limits') return U.saveLimits({ minutes: b.minutes, people: b.people })
    if (b.action === 'ban') return G.banUser(b.id, b.reason, M.endMeeting)
    if (b.action === 'unban') return G.unbanUser(b.id)
    if (b.action === 'dismiss') return G.dismissReport(b.id)
    throw new Refused('Unknown action.')
  })
}
