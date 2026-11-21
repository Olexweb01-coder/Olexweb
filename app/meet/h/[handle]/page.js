// A host's public profile (only when they turned "Show me publicly" on): ratings, reviews, badges, upcoming meetings, follow.
import { notFound } from 'next/navigation'
import { currentMeetUser } from '@/lib/meet/auth'
import { profile } from '@/lib/meet/community'
import { meetBase, mainOrigin } from '@/lib/site/meet'
import Follow from '@/components/meet/Follow'
export const dynamic = 'force-dynamic'
const home = () => (meetBase() ? '/' : '/meet')
export async function generateMetadata({ params }) {
  const p = await profile(params.handle).catch(() => null)
  if (!p) return { title: 'Profile', robots: { index: false } }
  const d = `${p.name} hosts meetings on Olexweb Meet.${p.stats.rating ? ` Rated ${p.stats.rating.toFixed(1)} from ${p.stats.ratings} ratings.` : ''}${p.bio ? ' ' + p.bio : ''}`
  return { title: { absolute: `${p.name} | Olexweb Meet` }, description: d.slice(0, 200),
    openGraph: { type: 'profile', siteName: 'Olexweb Meet', title: p.name, description: d.slice(0, 200), images: [{ url: (meetBase() || mainOrigin()) + '/meet/og.png?v=2', width: 1200, height: 630 }] } }
}
export default async function HostProfile({ params }) {
  const me = await currentMeetUser(), p = await profile(params.handle, me).catch(() => null)
  if (!p) notFound()
  const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' })
  const time = (iso) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' })
  return (<div className="mh">
    <header className="mh-top"><a className="mh-brand" href={home()}><img src="/meet/logo-96.png" alt="" width="40" height="40" /><span>Olexweb <b>Meet</b></span></a></header>
    <main className="pf">
      <div className="pf-head">{p.picture ? <img src={p.picture} alt="" width="84" height="84" referrerPolicy="no-referrer" /> : <i>{(p.name || '?').slice(0, 1)}</i>}
        <div><h1>{p.name}</h1>{p.bio ? <p>{p.bio}</p> : null}<small>{p.followers} follower{p.followers === 1 ? '' : 's'} · hosting since {day(p.since)}</small></div>
        {!p.mine ? <Follow handle={p.handle} following={p.following} signedIn={!!me} home={home()} /> : <a className="mh-btn mh-sm" href={home() + '#dashboard'}>Edit in your dashboard</a>}</div>
      <div className="md-grid pf-stats">
        <div className="md-card"><span className="md-lab">Rating</span><b>{p.stats.rating ? '★ ' + p.stats.rating.toFixed(1) : '–'}</b><small>{p.stats.ratings} ratings</small></div>
        <div className="md-card"><span className="md-lab">Meetings</span><b>{p.stats.meetings}</b><small>hosted</small></div>
        <div className="md-card"><span className="md-lab">Hours</span><b>{p.stats.hours}</b><small>hosted</small></div>
        <div className="md-card"><span className="md-lab">Streak</span><b>{p.streak ? p.streak + ' 🔥' : '–'}</b><small>weeks in a row</small></div>
      </div>
      {p.badges.length ? <section><h2>Badges</h2><div className="pf-badges">{p.badges.map((b) => <span key={b.id} className="pf-badge" title={b.desc}>🏅 {b.name}</span>)}</div></section> : null}
      {p.upcoming.length ? <section><h2>Coming up</h2><ul className="pf-list">{p.upcoming.map((m, i) => <li key={i}><b>{m.title}</b><span>{time(m.at)} · {m.mode === 'audio' ? 'Audio call' : 'Video meeting'}</span></li>)}</ul>
        <p className="md-dim">Follow to get the link when a meeting is scheduled.</p></section> : null}
      {p.reviews.length ? <section><h2>What guests say</h2><ul className="pf-list">{p.reviews.map((r, i) => <li key={i}><b>{'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}</b><span>“{r.review}”</span><small>{day(r.at)}</small></li>)}</ul></section> : null}
      <p className="mh-fine"><a href={home()}>Olexweb Meet</a>: free audio and video meetings, no time limit.</p>
    </main>
  </div>)
}
