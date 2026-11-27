// A signed-in Meet account's dashboard: plan, numbers, announcements, notices, invoices, payments and support.
import { sameOrigin } from '@/lib/admin/auth'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { Refused } from '@/lib/admin/content'
import { currentMeetUser } from '@/lib/meet/auth'
import { meetBase, mainOrigin } from '@/lib/site/meet'
import { one } from '@/lib/meet/db'
import * as D from '@/lib/meet/dash'
import { startPayment, meetingPro, claimTransfer } from '@/lib/meet/plans'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export async function GET() {
  const mu = await currentMeetUser(); if (!mu) return refuse('Sign in to see your dashboard.', 401)
  return respond(() => D.dashboard(mu))
}
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const mu = await currentMeetUser(); if (!mu) return refuse('Sign in first.', 401)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  return respond(async () => {
    if (b.action === 'read') return D.readAll(mu)
    if (b.action === 'help') return D.help(mu, b.question)
    if (b.action === 'ticket') return D.openTicket(mu, b)
    if (b.action === 'claim') return claimTransfer(mu, b.ref)
    if (b.action === 'pay') return startPayment(mu, b, meetBase() || mainOrigin())
    if (b.action === 'use-free') return (await import('@/lib/meet/community')).useFreeMeeting(mu, b.code)   // Install 64
    if (b.action === 'pro-check') { const m = await one('select code, host_user, pro from meetings where code = $1', [String(b.code || '')]); return { pro: !!m && (await meetingPro(m)) } }
    throw new Refused('Unknown action.')
  })
}
