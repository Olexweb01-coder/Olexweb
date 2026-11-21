// olexweb.com/meet/<code>: the meeting. Never indexed. Signed in as the owner = the host (name filled in, starts the meeting).
import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { currentUser } from '@/lib/admin/auth'
import { CODE_RE, meetingState, meetHost, meetLink, hostOf, meetBase, mainOrigin } from '@/lib/site/meet'
import { currentMeetUser } from '@/lib/meet/auth'
import MeetRoom from '@/components/meet/MeetRoom'
export const dynamic = 'force-dynamic'
// shared on WhatsApp and elsewhere, the link shows the meeting's own name (never indexed)
export async function generateMetadata({ params }) {
  const code = String(params.code || '').toLowerCase()
  const m = CODE_RE.test(code) ? await meetingState(code).catch(() => null) : null
  const title = m ? m.title : 'Meeting', kind = m && m.mode === 'audio' ? 'audio call' : 'video meeting'
  const description = `Join this ${kind} on Olexweb Meet. Free, no account needed: just open the link.`
  const f = m ? await (await import('@/lib/meet/pro')).flyer(code).catch(() => null) : null   // Pro meetings: their own flyer
  const image = { url: (meetBase() || mainOrigin()) + (f && f.pro ? `/api/meet/flyer/${code}` : '/meet/og.png?v=2'), width: 1200, height: 630, alt: title }
  return { title: { absolute: `${title} | Olexweb Meet` }, description, robots: { index: false, follow: false },
    openGraph: { type: 'website', siteName: 'Olexweb Meet', title, description, images: [image] }, twitter: { card: 'summary_large_image', title, description, images: [image.url] } }
}
export const viewport = { themeColor: '#0a0b0a', colorScheme: 'dark' }
export default async function MeetPage({ params }) {
  const code = String(params.code || '').toLowerCase()
  if (!CODE_RE.test(code)) notFound()
  const m = await meetingState(code).catch(() => null)
  if (!m) notFound()
  const u = await currentUser().catch(() => null), mu = await currentMeetUser(), h = await hostOf(code, u, mu), host = h.host
  // once the Meet app is set up, guests on the old address go there; you stay here, where your sign-in makes you the host
  const mh = meetHost(), here = String(headers().get('x-forwarded-host') || headers().get('host') || '')
  if (mh && here !== mh && !host) redirect(meetLink(code))   // (Meet hosts sign in on the Meet app; Olaitan can host from either)
  return <MeetRoom code={code} title={m.title} speakers={m.speakers} price={m.price || 0} mode={m.mode} videoOn={m.video} initialState={m.state} startsAt={m.startsAt || null} minutes={m.minutes || 60} host={host} hostName={h.name} canNotes={!!h.host} form={m.form || null} />
}
