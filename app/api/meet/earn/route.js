// Hosts earning (Install D, grown in Install 58): their bank, ticket prices, mentorship bookings, course bundles,
// memberships, tracked links, the Find a mentor listing, certificates, and what Olexweb pays them (invites, ambassador).
// Buying a ticket, a bundle or a certificate needs no account; everything else does.
import { cookies } from 'next/headers'
import { sameOrigin } from '@/lib/admin/auth'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { Refused } from '@/lib/admin/content'
import { currentMeetUser } from '@/lib/meet/auth'
import { meetBase, mainOrigin } from '@/lib/site/meet'
import * as E from '@/lib/meet/earn'
export const dynamic = 'force-dynamic'
const linkId = () => { try { return Number(cookies().get('meet_l')?.value) || null } catch { return null } }   // the tracked link they came through (checked against the host)
export async function GET() {
  const mu = await currentMeetUser(); if (!mu) return refuse('Sign in first.', 401)
  return respond(() => E.myEarn(mu))
}
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  const origin = meetBase() || mainOrigin()
  const mu = await currentMeetUser()
  if (b.action === 'ticket') return respond(() => E.buyTicket(b, origin, mu, linkId()))
  if (b.action === 'bundle-buy') return respond(async () => (await import('@/lib/meet/bundles')).buyBundle(b, origin, mu, linkId()))
  if (b.action === 'cert-buy') return respond(async () => (await import('@/lib/meet/certs')).buyCert(b, origin))
  if (!mu) return refuse('Sign in first.', 401)
  return respond(async () => {
    if (b.action === 'banks') return { banks: await E.banks() }
    if (b.action === 'payout') return E.setPayout(mu, b)
    if (b.action === 'price') return E.setPrice(mu, b.code, b.price)
    if (b.action === 'booking') return E.saveBooking(mu, b)
    if (b.action === 'book') return E.book(mu, b.handle, b.startsAt, origin, b.via === 'directory' ? 'directory' : null, linkId())
    if (b.action === 'bundle-save') return (await import('@/lib/meet/bundles')).saveBundle(mu, b)
    if (b.action === 'link-make') return (await import('@/lib/meet/links')).makeLink(mu, b)
    if (b.action === 'link-drop') return (await import('@/lib/meet/links')).dropLink(mu, b.id)
    if (b.action === 'membership') return (await import('@/lib/meet/members')).saveMembership(mu, b)
    if (b.action === 'member-join') return (await import('@/lib/meet/members')).join(mu, b.handle, origin, linkId())
    if (b.action === 'member-cancel') return (await import('@/lib/meet/members')).cancel(mu, b.handle)
    if (b.action === 'listing') return (await import('@/lib/meet/mentors')).saveListing(mu, b)
    if (b.action === 'cert-brand') return (await import('@/lib/meet/certs')).saveBrand(mu, b)
    if (b.action === 'cert-meeting') return (await import('@/lib/meet/certs')).setMeetingCert(mu, b)
    if (b.action === 'cert-award') return (await import('@/lib/meet/certs')).setAward(mu, b.serial, b.award)
    if (b.action === 'cert-list') return { certs: await (await import('@/lib/meet/certs')).hostCerts(mu, b.code) }
    if (b.action === 'members-only') return E.setMembersOnly(mu, b.code, b.on)
    throw new Refused('Unknown action.')
  })
}
