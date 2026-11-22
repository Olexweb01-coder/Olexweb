// A course bundle (Install 58): what's in it, the price now (early-bird until its date), the group price, and checkout.
// With the holder's ticket key (?pass=…) it lists their own links to every session.
import { notFound } from 'next/navigation'
import { bundlePage } from '@/lib/meet/bundles'
import { currentMeetUser } from '@/lib/meet/auth'
import PubTop from '@/components/meet/PubTop'
import PayForm from '@/components/meet/PayForm'
export const dynamic = 'force-dynamic'
const N = (n) => '₦' + Number(n).toLocaleString('en-NG')
const when = (iso) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' }) + ' (Lagos)'
export async function generateMetadata({ params }) {
  const b = await bundlePage(params.id).catch(() => null)
  return b ? { title: { absolute: `${b.title} | ${b.host.name} on Olexweb Meet` }, description: (b.blurb || `${b.meetings.length} live sessions with ${b.host.name}.`).slice(0, 200) } : { title: 'Bundle', robots: { index: false } }
}
export default async function Bundle({ params, searchParams }) {
  const pass = searchParams && typeof searchParams.pass === 'string' ? searchParams.pass : null
  const [b, me] = await Promise.all([bundlePage(params.id, pass).catch(() => null), currentMeetUser()])
  if (!b) notFound()
  const early = b.earlyUntil && b.now < b.price
  return (<div className="pb"><PubTop />
    <main className="pb-main pb-stack">
      <div className="pb-row">{b.host.picture ? <img className="pb-av" src={b.host.picture} alt="" referrerPolicy="no-referrer" /> : <span className="pb-av">{b.host.name.slice(0, 1)}</span>}
        <div><span className="pb-pill">Course bundle · {b.meetings.length} live session{b.meetings.length === 1 ? '' : 's'}</span><h1 className="pb-h1" style={{ marginTop: 8 }}>{b.title}</h1>
          <p className="pb-dim" style={{ margin: '4px 0 0' }}>With {b.host.handle ? <a href={`/meet/h/${b.host.handle}`}>{b.host.name}</a> : b.host.name}</p></div></div>
      {b.holder ? <div className="pb-ok"><b>✓</b><div><b>You’re in.</b> <span className="pb-dim">Your own links are below. Keep this page: it opens every session.</span></div></div> : null}
      <div className="pb-two">
        <section className="pb-card pb-stack">{b.blurb ? <p style={{ margin: 0 }}>{b.blurb}</p> : null}
          <h2 className="pb-h2" style={{ margin: 0 }}>Sessions</h2>
          <ul className="pb-list">{b.meetings.map((m, i) => <li key={i}><div><b>{m.title}</b><br /><span className="pb-faint">{m.at ? when(m.at) : 'Time to be announced'}{m.ended ? ' · ended' : ''}</span>
            {m.link && !m.ended ? <><br /><a className="pb-btn pb-sm pb-go" style={{ marginTop: 6 }} href={m.link}>Join this session</a></> : null}</div></li>)}</ul></section>
        {!b.holder ? <section className="pb-card pb-stack">
          <div><div className="pb-price">{N(b.now)}{early ? <span className="pb-strike">{N(b.price)}</span> : null}</div>
            {early ? <p className="pb-dim" style={{ margin: '4px 0 0' }}>Early-bird price until {new Date(b.earlyUntil).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'Africa/Lagos' })}.</p> : null}
            {b.groupSize ? <p className="pb-dim" style={{ margin: '4px 0 0' }}>Group of {b.groupSize}: {N(b.groupPrice)} in total ({N(Math.floor(b.groupPrice / b.groupSize))} each). You get one link per person.</p> : null}</div>
          {b.onSale ? <PayForm action="bundle-buy" payload={{ id: b.id }} askName defaults={{ name: me ? me.name : '', email: me ? me.email || '' : '' }} label={`Pay ${N(b.now)}`}
            group={b.groupSize ? `Pay for ${b.groupSize} people (${N(b.groupPrice)})` : null} note="Secure payment by Paystack. You pay the price shown, nothing more. Your links are emailed to you." />
            : <p className="pb-dim">This bundle isn’t on sale right now.</p>}
        </section> : null}
      </div>
    </main></div>)
}
