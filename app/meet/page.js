// Olexweb Meet's home (meet.olexweb.com): join with a link or code (no account), or sign in to create and schedule.
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { currentMeetUser, providers } from '@/lib/meet/auth'
import { myMeetings, meetBase, meetHost, mainOrigin } from '@/lib/site/meet'
import { TITLE, DESCRIPTION, FAQ, homeUrl, structuredData } from '@/lib/meet/seo'
import MeetHome from '@/components/meet/MeetHome'
import { emailSignInReady } from '@/lib/meet/emailauth'
import { pricing, planOf } from '@/lib/meet/plans'
import { spotlight } from '@/lib/meet/community'
export const dynamic = 'force-dynamic'
export async function generateMetadata() {
  const url = homeUrl(), image = (meetBase() ? meetBase() : mainOrigin()) + '/meet/og.png?v=2'
  return { title: { absolute: TITLE }, description: DESCRIPTION, alternates: { canonical: url }, robots: { index: true, follow: true },
    openGraph: { type: 'website', url, siteName: 'Olexweb Meet', title: TITLE, description: DESCRIPTION, images: [{ url: image, width: 1200, height: 630, alt: 'Olexweb Meet: free audio and video meetings, no time limit' }] },
    twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [image] } }
}
export default async function MeetHomePage({ searchParams }) {
  const mh = meetHost(), here = String(headers().get('x-forwarded-host') || headers().get('host') || '')
  if (mh && here !== mh) redirect(meetBase() + '/')                       // the Meet app has its own address
  const user = await currentMeetUser()
  const all = user ? await myMeetings(user).catch(() => []) : []
  const plans = await pricing().catch(() => ({ on: false, prices: {} }))
  const free = user && plans.on && !(await planOf(user)).pro, past = all.filter((m) => m.endedAt)   // Free (pricing on): the last 3 ended meetings
  const meetings = free ? all.filter((m) => !m.endedAt || past.indexOf(m) < 3) : all, morePast = free ? Math.max(0, past.length - 3) : 0
  return (<>
    {structuredData().map((d, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d).replace(/</g, '\\u003c') }} />)}
    <MeetHome user={user} providers={providers()} emailOn={emailSignInReady()} meetings={meetings} morePast={morePast} pricing={plans} spotlight={await spotlight().catch(() => null)} faq={FAQ} notice={typeof searchParams.signin === 'string' ? searchParams.signin.slice(0, 200) : ''} />
  </>)
}
