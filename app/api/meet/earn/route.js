// Hosts earning (Install D): their bank for payouts, ticket prices, mentorship booking settings and bookings, and
// buying a ticket (which needs no account).
import { sameOrigin } from '@/lib/admin/auth'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { Refused } from '@/lib/admin/content'
import { currentMeetUser } from '@/lib/meet/auth'
import { meetBase, mainOrigin } from '@/lib/site/meet'
import * as E from '@/lib/meet/earn'
export const dynamic = 'force-dynamic'
export async function GET() {
  const mu = await currentMeetUser(); if (!mu) return refuse('Sign in first.', 401)
  return respond(() => E.myEarn(mu))
}
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  const origin = meetBase() || mainOrigin()
  if (b.action === 'ticket') return respond(() => E.buyTicket(b, origin))
  const mu = await currentMeetUser(); if (!mu) return refuse('Sign in first.', 401)
  return respond(async () => {
    if (b.action === 'banks') return { banks: await E.banks() }
    if (b.action === 'payout') return E.setPayout(mu, b)
    if (b.action === 'price') return E.setPrice(mu, b.code, b.price)
    if (b.action === 'booking') return E.saveBooking(mu, b)
    if (b.action === 'book') return E.book(mu, b.handle, b.startsAt, origin)
    throw new Refused('Unknown action.')
  })
}
