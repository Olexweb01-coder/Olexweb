// A host's public profile (only when they turned "Show me publicly" on): ratings, reviews, badges, upcoming meetings, follow.
import { notFound } from 'next/navigation'
import { currentMeetUser } from '@/lib/meet/auth'
import { profile } from '@/lib/meet/community'
import { meetBase, mainOrigin } from '@/lib/site/meet'
import Follow from '@/components/meet/Follow'
import PubTop from '@/components/meet/PubTop'
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
  const time = (iso) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' }) + ' (Lagos)'
  const N = (n) => '₦' + Number(n).toLocaleString('en-NG'), b = p.banner || {}
  const cover = b.kind === 'image' && p.bannerImg ? { backgroundImage: `url(/api/meet/pic/${p.id}?b=1&v=${b.v || ''})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined
  return (<div className="pb">
    <PubTop />
    <main className="pb-main pb-stack">
      <div className={'pf2-cover ' + (b.kind === 'pattern' ? (b.pattern || 'p1') : b.kind === 'bio' ? 'bio' : '')} style={cover}>{b.kind === 'bio' && p.bio ? <span>{p.bio}</span> : null}</div>
      <div className="pf2-head">
        {p.picture ? <img className="pf2-av" src={p.picture} alt="" referrerPolicy="no-referrer" /> : <span className="pf2-av">{(p.name || '?').slice(0, 1)}</span>}
        <div className="pf2-info"><h1 className="pb-h1">{p.name}</h1>
          <p className="pb-dim" style={{ margin: '4px 0 0' }}>{p.mentor && p.mentor.headline ? p.mentor.headline + ' · ' : ''}Level {p.level.level} · {p.level.title} · {p.followers} follower{p.followers === 1 ? '' : 's'} · hosting since {day(p.since)}</p>
          {p.bio && b.kind !== 'bio' ? <p style={{ margin: '8px 0 0' }}>{p.bio}</p> : null}</div>
        <div className="pb-row">{p.booking ? <a className="pb-btn pb-go" href={`/meet/h/${p.handle}/book`}>Book a session</a> : null}
          {p.membership ? <a className="pb-btn" href={`/meet/h/${p.handle}/join`}>Join the community</a> : null}
          {!p.mine ? <Follow handle={p.handle} following={p.following} signedIn={!!me} home={home()} /> : <a className="pb-btn" href={home() + '#profile'}>Edit my profile</a>}</div>
      </div>
      <div className="pb-grid pf2-stats">
        <div className="pb-card"><span className="pb-faint">Rating</span><b>{p.stats.rating ? '★ ' + p.stats.rating.toFixed(1) : '–'}</b><small className="pb-dim">{p.stats.ratings} ratings</small></div>
        <div className="pb-card"><span className="pb-faint">{p.mentor ? 'People taught' : 'Meetings'}</span><b>{p.mentor ? p.mentor.taught : p.stats.meetings}</b><small className="pb-dim">{p.mentor ? `${p.mentor.sessions} one-on-one sessions` : 'hosted'}</small></div>
        <div className="pb-card"><span className="pb-faint">Hours</span><b>{p.stats.hours}</b><small className="pb-dim">hosted</small></div>
        <div className="pb-card"><span className="pb-faint">Streak</span><b>{p.streak || '–'}</b><small className="pb-dim">weeks in a row</small></div>
      </div>
      {p.mentor && p.mentor.help.length ? <section className="pb-card pb-stack"><h2 className="pb-h2" style={{ margin: 0 }}>How I can help you</h2><ul className="pb-list">{p.mentor.help.map((x, i) => <li key={i}><span>{x}</span></li>)}</ul>
        {p.mentor.tags.length ? <div className="pb-row">{p.mentor.tags.map((t) => <span key={t} className="pb-pill">{t}</span>)}</div> : null}</section> : null}
      {p.session || p.membership ? <div className="pb-grid">
        {p.session ? <section className="pb-card pb-stack"><div><b>{p.session.title}</b><div className="pb-dim">{p.session.minutes} minutes · one on one · private and encrypted</div></div><div className="pb-row pb-sp"><span className="pb-price" style={{ fontSize: 26 }}>{p.session.price ? N(p.session.price) : 'Free'}</span><a className="pb-btn pb-go pb-sm" href={`/meet/h/${p.handle}/book`}>Book</a></div></section> : null}
        {p.membership ? <section className="pb-card pb-stack"><div><b>{p.name}’s community</b><div className="pb-dim">{p.membership.perMonth} members-only meeting{p.membership.perMonth === 1 ? '' : 's'} a month, counted by Olexweb Meet</div></div><div className="pb-row pb-sp"><span className="pb-price" style={{ fontSize: 26 }}>{N(p.membership.price)}<small className="pb-dim" style={{ fontSize: 14 }}>/month</small></span><a className="pb-btn pb-sm" href={`/meet/h/${p.handle}/join`}>See more</a></div></section> : null}
      </div> : null}
      {p.badges.length ? <section className="pb-stack"><h2 className="pb-h2" style={{ margin: 0 }}>Achievements</h2><div className="pb-row">{p.badges.map((x) => <a key={x.id} className="pb-pill pb-gold" href={`/meet/h/${p.handle}/a/${x.id}`} title={x.desc}>★ {x.name}</a>)}</div></section> : null}
      {p.upcoming.length ? <section className="pb-card pb-stack"><h2 className="pb-h2" style={{ margin: 0 }}>Coming up</h2><ul className="pb-list">{p.upcoming.map((m, i) => <li key={i}><span><b>{m.title}</b><br /><span className="pb-faint">{time(m.at)} · {m.mode === 'audio' ? 'Audio call' : 'Video meeting'}</span></span></li>)}</ul>
        <p className="pb-faint" style={{ margin: 0 }}>Follow to get the link when a meeting is scheduled.</p></section> : null}
      {p.reviews.length ? <section className="pb-card pb-stack"><h2 className="pb-h2" style={{ margin: 0 }}>What people say</h2>{p.reviews.map((r, i) => <div key={i}><b style={{ color: '#e9c46a' }}>{'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}</b><p style={{ margin: '4px 0 0' }}>“{r.review}”</p><small className="pb-faint">{day(r.at)}</small></div>)}
        <p className="pb-faint" style={{ margin: 0 }}>Reviews come only from people who were in the meeting. Numbers are counted by Olexweb Meet, not typed by the host.</p></section> : null}
    </main>
    <footer className="pb-foot"><a href={home()}>Olexweb Meet</a>: free audio and video meetings, no time limit. <a href="/meet/mentors">Find a mentor</a></footer>
  </div>)
}
