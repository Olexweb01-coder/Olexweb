// Olexweb Meet's home (meet.olexweb.com): join with a link or code (no account), or sign in to create and schedule.
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { currentMeetUser, providers } from '@/lib/meet/auth'
import { myMeetings, meetBase, meetHost } from '@/lib/site/meet'
import MeetHome from '@/components/meet/MeetHome'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Olexweb Meet: video meetings that work on any connection' }
export default async function MeetHomePage({ searchParams }) {
  const mh = meetHost(), here = String(headers().get('x-forwarded-host') || headers().get('host') || '')
  if (mh && here !== mh) redirect(meetBase() + '/')                       // the Meet app has its own address
  const user = await currentMeetUser()
  const meetings = user ? await myMeetings(user).catch(() => []) : []
  return <MeetHome user={user} providers={providers()} meetings={meetings} notice={typeof searchParams.signin === 'string' ? searchParams.signin.slice(0, 200) : ''} />
}
