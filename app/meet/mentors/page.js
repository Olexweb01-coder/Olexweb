// Find a mentor (Install 58, restyled in 58g): hosts who take one-on-one bookings and chose to be listed. Every number
// is counted by Olexweb Meet. Booking from here tells the host's booking page the client came from the directory.
import { directory, NICHES } from '@/lib/meet/mentors'
import Site, { Section, PageHero, Final, at } from '@/components/meet/site/Site'
import { I } from '@/components/meet/app/icons'
import { siteBase, pageMeta } from '@/lib/meet/site'
export const dynamic = 'force-dynamic'
export const generateMetadata = () => pageMeta('/mentors', 'Find a mentor', 'Book one-on-one sessions with mentors on Olexweb Meet. Ratings and numbers are counted by Olexweb Meet, not typed by the mentor.')
const N = (n) => '₦' + Number(n).toLocaleString('en-NG')
export default async function Mentors({ searchParams }) {
  const base = siteBase('/mentors')
  const sp = searchParams || {}, niche = NICHES.includes(sp.niche) ? sp.niche : '', search = typeof sp.q === 'string' ? sp.q.slice(0, 60) : ''
  const d = await directory({ niche, search }).catch(() => ({ mentors: [], niches: NICHES }))
  const here = at(base, '/mentors'), href = (n) => here + (n ? '?niche=' + encodeURIComponent(n) : '')
  return (<Site base={base} active="/mentors">
    <PageHero pill="Find a mentor" title="Learn from people" accent="who’ve done it." text="One-on-one sessions, private and encrypted. Ratings and numbers are counted by Olexweb Meet, not typed by the mentor.">
      <form className="msearch" action={here} role="search">{niche ? <input type="hidden" name="niche" value={niche} /> : null}
        <I n="search" className="ico" /><input name="q" defaultValue={search} placeholder="Search by name or skill" maxLength={60} aria-label="Search mentors" /><button className="btn go">Search</button></form>
      <nav className="jump" aria-label="Areas"><a href={href('')} aria-current={!niche ? 'page' : undefined}>All</a>{d.niches.map((n) => <a key={n} href={href(n)} aria-current={niche === n ? 'page' : undefined}>{n}</a>)}</nav>
    </PageHero>
    <Section tight>
      {d.mentors.length ? <div className="mgrid">{d.mentors.map((m) => (<article key={m.handle} className="mcard">
        <div className="mtop">{m.picture ? <img className="mav" src={m.picture} alt="" referrerPolicy="no-referrer" /> : <span className="mav">{m.name.slice(0, 1)}</span>}
          <div style={{ minWidth: 0 }}><h2><a href={`/meet/h/${m.handle}`}>{m.name}</a></h2><p>{m.headline}</p></div></div>
        <div className="mtags">{m.niche ? <span>{m.niche}</span> : null}{m.city ? <span>{m.city}</span> : null}{m.years ? <span>{m.years} years</span> : null}</div>
        <p className="mstat">{m.rating ? `★ ${m.rating.toFixed(1)} from ${m.ratings} rating${m.ratings === 1 ? '' : 's'} · ` : ''}{m.taught} people taught · {m.sessions} session{m.sessions === 1 ? '' : 's'} held</p>
        <div className="mfoot"><b>{m.price ? `${N(m.price)} · ${m.minutes} min` : `Free · ${m.minutes} min`}</b><a className="btn go" href={`/meet/h/${m.handle}/book?from=dir`}>Book</a></div>
      </article>))}</div> : <div className="soon">{search || niche ? 'No mentors match that yet. Try another search or area.' : 'No mentors listed here yet. Check back soon.'}</div>}
      <p style={{ color: 'var(--faint)', fontSize: 14, marginTop: 22 }}>Mentors set their own prices. You pay the price shown; Paystack handles the payment.</p>
    </Section>
    <Final base={base} title="Mentor on Olexweb Meet." text="Open your booking page, set your hours and price, and get found here." second={<a className="btn" href={at(base, '/earn')}>How earning works</a>} />
    <div style={{ height: 60 }} />
  </Site>)
}
