// olexweb.com/meet/<code>: the meeting. Never indexed. Signed in as the owner = the host (name filled in, starts the meeting).
import { notFound } from 'next/navigation'
import { currentUser } from '@/lib/admin/auth'
import { CODE_RE, meetingState } from '@/lib/site/meet'
import MeetRoom from '@/components/meet/MeetRoom'
import '../meet.css'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Meeting | Olexweb', robots: { index: false, follow: false } }
export const viewport = { themeColor: '#0a0b0a', colorScheme: 'dark' }
export default async function MeetPage({ params }) {
  const code = String(params.code || '').toLowerCase()
  if (!CODE_RE.test(code)) notFound()
  const m = await meetingState(code).catch(() => null)
  if (!m) notFound()
  const u = await currentUser().catch(() => null), host = !!(u && u.role === 'owner')
  return <MeetRoom code={code} title={m.title} speakers={m.speakers} initialState={m.state} host={host} hostName={host ? u.name : ''} />
}
