// olexweb.com/meet/<code>: the meeting. Never indexed. Signed in as the owner = the host (name filled in, starts the meeting).
import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { currentUser } from '@/lib/admin/auth'
import { CODE_RE, meetingState, meetHost, meetLink, hostOf } from '@/lib/site/meet'
import { currentMeetUser } from '@/lib/meet/auth'
import MeetRoom from '@/components/meet/MeetRoom'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Meeting | Olexweb', robots: { index: false, follow: false } }
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
  return <MeetRoom code={code} title={m.title} speakers={m.speakers} initialState={m.state} startsAt={m.startsAt || null} minutes={m.minutes || 60} host={host} hostName={h.name} canNotes={!!h.host} form={m.form || null} />
}
