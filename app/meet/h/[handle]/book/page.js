// Booking a one-on-one session with a host (mentorship): their free times for the next two weeks, in Lagos time.
import { notFound } from 'next/navigation'
import { currentMeetUser } from '@/lib/meet/auth'
import { slots } from '@/lib/meet/earn'
import { meetBase } from '@/lib/site/meet'
import Booker from '@/components/meet/Booker'
import PubTop from '@/components/meet/PubTop'
export const dynamic = 'force-dynamic'
export async function generateMetadata({ params }) {
  const s = await slots(params.handle).catch(() => null)
  return s ? { title: { absolute: `Book ${s.mentor.name} | Olexweb Meet` }, description: `${s.title} with ${s.mentor.name}: ${s.minutes} minutes, one on one.` } : { title: 'Book', robots: { index: false } }
}
export default async function Book({ params, searchParams }) {
  const [s, me] = await Promise.all([slots(params.handle).catch(() => null), currentMeetUser()])
  if (!s) notFound()
  const home = meetBase() ? '/' : '/meet'
  return (<div className="pb"><PubTop />
    <main className="pb-main pb-narrow pb-stack"><Booker data={JSON.parse(JSON.stringify(s))} signedIn={!!me} home={home} via={searchParams && searchParams.from === 'dir' ? 'directory' : null} /></main>
  </div>)
}
