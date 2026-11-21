// A host's personal room: meet.olexweb.com/<their profile name>. Open: straight in. Not open yet: a calm waiting page
// that checks again every 15 seconds.
import { redirect, notFound } from 'next/navigation'
import { roomOf } from '@/lib/meet/pro'
import { meetBase } from '@/lib/site/meet'
export const dynamic = 'force-dynamic'
export async function generateMetadata({ params }) {
  const r = await roomOf(params.handle).catch(() => null)
  return r ? { title: { absolute: `${r.name}’s room | Olexweb Meet` }, description: `Join ${r.name}’s meetings on Olexweb Meet. Free, no account needed.`, robots: { index: false } } : { title: 'Room', robots: { index: false } }
}
export default async function Room({ params }) {
  const r = await roomOf(params.handle).catch(() => null)
  if (!r) notFound()
  if (r.code) redirect(meetBase() ? `/${r.code}` : `/meet/${r.code}`)
  return (<div className="mt mt-solo">
    <meta httpEquiv="refresh" content="15" />
    <header className="mt-brand"><img src="/studio/mark.png" alt="" width="22" height="26" /><span>Olexweb</span></header>
    <main className="mt-card"><h1 className="mt-h">{r.name}’s room</h1>
      <p className="mt-p mt-wait"><span className="mt-pulse" aria-hidden="true" />{r.name.split(' ')[0]} hasn’t opened the room yet. Keep this page open: it checks every 15 seconds and you’ll go in as soon as it opens.</p></main>
  </div>)
}
