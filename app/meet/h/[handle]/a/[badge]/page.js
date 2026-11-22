// A shared achievement (Install 58): the card, with a link preview that shows it, and a way to the person's profile.
import { notFound } from 'next/navigation'
import { one } from '@/lib/meet/db'
import { BADGES } from '@/lib/meet/community'
import { meetBase, mainOrigin } from '@/lib/site/meet'
import PubTop from '@/components/meet/PubTop'
export const dynamic = 'force-dynamic'
async function load(params) {
  const b = BADGES.find((x) => x.id === params.badge); if (!b) return null
  const u = await one('select u.name, u.handle from meet_users u join meet_badges g on g.user_id = u.id and g.badge = $2 where lower(u.handle) = lower($1) and u.public and u.banned_at is null', [String(params.handle).slice(0, 40), b.id])
  return u ? { b, u } : null
}
export async function generateMetadata({ params }) {
  const x = await load(params).catch(() => null); if (!x) return { title: 'Achievement', robots: { index: false } }
  const img = `${meetBase() || mainOrigin()}/api/meet/card?b=${x.b.id}&h=${encodeURIComponent(x.u.handle)}`
  return { title: { absolute: `${x.u.name} earned “${x.b.name}” | Olexweb Meet` }, description: x.b.desc, openGraph: { title: `${x.u.name} earned “${x.b.name}”`, description: x.b.desc, images: [{ url: img, width: 1080, height: 1350 }] }, twitter: { card: 'summary_large_image', images: [img] } }
}
export default async function Achievement({ params }) {
  const x = await load(params).catch(() => null); if (!x) notFound()
  return (<div className="pb"><PubTop /><main className="pb-main pb-narrow pb-stack" style={{ textAlign: 'center' }}>
    <img src={`/api/meet/card?b=${x.b.id}&h=${encodeURIComponent(x.u.handle)}`} alt={`${x.u.name} earned ${x.b.name}`} width="540" height="675" style={{ width: '100%', maxWidth: 420, height: 'auto', borderRadius: 24, margin: '0 auto', display: 'block' }} />
    <div className="pb-row" style={{ justifyContent: 'center' }}><a className="pb-btn pb-go" href={`/meet/h/${x.u.handle}`}>See {x.u.name.split(' ')[0]}’s profile</a><a className="pb-btn" href="/meet">Try Olexweb Meet</a></div>
  </main></div>)
}
