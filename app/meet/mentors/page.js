// Find a mentor (Install 58): hosts who take one-on-one bookings and chose to be listed. Every number is counted by
// Olexweb Meet. Booking from here tells the host's booking page the client came from the directory.
import { directory, NICHES } from '@/lib/meet/mentors'
import PubTop from '@/components/meet/PubTop'
export const dynamic = 'force-dynamic'
export const metadata = { title: { absolute: 'Find a mentor | Olexweb Meet' }, description: 'Book one-on-one sessions with mentors on Olexweb Meet. Ratings and numbers are counted by Olexweb Meet, not typed by the mentor.' }
const N = (n) => '₦' + Number(n).toLocaleString('en-NG')
export default async function Mentors({ searchParams }) {
  const sp = searchParams || {}, niche = NICHES.includes(sp.niche) ? sp.niche : '', search = typeof sp.q === 'string' ? sp.q.slice(0, 60) : ''
  const d = await directory({ niche, search }).catch(() => ({ mentors: [], niches: NICHES }))
  const href = (n) => '/meet/mentors' + (n ? '?niche=' + encodeURIComponent(n) : '')
  return (<div className="pb"><PubTop />
    <main className="pb-main pb-stack">
      <div><h1 className="pb-h1">Find a mentor</h1><p className="pb-dim" style={{ margin: '6px 0 0' }}>One-on-one sessions, private and encrypted. Ratings and numbers are counted by Olexweb Meet, not typed by the mentor.</p></div>
      <form className="pb-row" action="/meet/mentors">{niche ? <input type="hidden" name="niche" value={niche} /> : null}
        <input className="pb-in" style={{ flex: '1 1 220px' }} name="q" defaultValue={search} placeholder="Search by name or skill" maxLength={60} /><button className="pb-btn">Search</button></form>
      <nav className="pb-chips" aria-label="Areas"><a className="pb-chip" href={href('')} aria-current={!niche}>All</a>{d.niches.map((n) => <a key={n} className="pb-chip" href={href(n)} aria-current={niche === n}>{n}</a>)}</nav>
      {d.mentors.length ? <div className="pb-grid">{d.mentors.map((m) => (<article key={m.handle} className="pb-card pb-stack">
        <div className="pb-row" style={{ flexWrap: 'nowrap' }}>{m.picture ? <img className="pb-av" src={m.picture} alt="" referrerPolicy="no-referrer" /> : <span className="pb-av">{m.name.slice(0, 1)}</span>}
          <div style={{ minWidth: 0 }}><h2 style={{ fontSize: 18 }}><a href={`/meet/h/${m.handle}`}>{m.name}</a></h2><p className="pb-dim" style={{ margin: 0 }}>{m.headline}</p></div></div>
        <div className="pb-row">{m.niche ? <span className="pb-pill">{m.niche}</span> : null}{m.city ? <span className="pb-pill">{m.city}</span> : null}{m.years ? <span className="pb-pill">{m.years} years</span> : null}</div>
        <p className="pb-faint" style={{ margin: 0 }}>{m.rating ? `★ ${m.rating.toFixed(1)} from ${m.ratings} rating${m.ratings === 1 ? '' : 's'} · ` : ''}{m.taught} people taught · {m.sessions} session{m.sessions === 1 ? '' : 's'} held</p>
        <div className="pb-row pb-sp"><b>{m.price ? `${N(m.price)} · ${m.minutes} min` : `Free · ${m.minutes} min`}</b><a className="pb-btn pb-sm pb-go" href={`/meet/h/${m.handle}/book?from=dir`}>Book</a></div>
      </article>))}</div> : <p className="pb-card pb-dim">No mentors listed here yet. Check back soon.</p>}
    </main>
    <footer className="pb-foot">Mentors set their own prices. You pay the price shown; Paystack handles the payment.</footer></div>)
}
