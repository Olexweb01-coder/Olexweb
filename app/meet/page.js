// Olexweb Meet's home (meet.olexweb.com): join with a link or code (no account), or sign in to create and schedule.
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { currentMeetUser, providers } from '@/lib/meet/auth'
import { myMeetings, meetBase, meetHost, mainOrigin } from '@/lib/site/meet'
import { TITLE, DESCRIPTION, FAQ, homeUrl, structuredData } from '@/lib/meet/seo'
import MeetHome from '@/components/meet/MeetHome'
import { emailSignInReady } from '@/lib/meet/emailauth'
export const dynamic = 'force-dynamic'
export async function generateMetadata() {
  const url = homeUrl(), image = (meetBase() ? meetBase() : mainOrigin()) + '/meet/og.png'
  return { title: { absolute: TITLE }, description: DESCRIPTION, alternates: { canonical: url }, robots: { index: true, follow: true },
    openGraph: { type: 'website', url, siteName: 'Olexweb Meet', title: TITLE, description: DESCRIPTION, images: [{ url: image, width: 1200, height: 630, alt: 'Olexweb Meet: video meetings that keep working on any connection' }] },
    twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [image] } }
}
export default async function MeetHomePage({ searchParams }) {
  const mh = meetHost(), here = String(headers().get('x-forwarded-host') || headers().get('host') || '')
  if (mh && here !== mh) redirect(meetBase() + '/')                       // the Meet app has its own address
  const user = await currentMeetUser()
  const meetings = user ? await myMeetings(user).catch(() => []) : []
  return (<>
    {structuredData().map((d, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d).replace(/</g, '\\u003c') }} />)}
    <MeetHome user={user} providers={providers()} emailOn={emailSignInReady()} meetings={meetings} faq={FAQ} notice={typeof searchParams.signin === 'string' ? searchParams.signin.slice(0, 200) : ''} />
  </>)
}
