// A host's membership (Install 58): what they promise, what it costs, and the promise as Olexweb counts it.
import { notFound } from 'next/navigation'
import { membershipOf } from '@/lib/meet/members'
import { currentMeetUser } from '@/lib/meet/auth'
import { meetBase } from '@/lib/site/meet'
import PubTop from '@/components/meet/PubTop'
import MemberActions from '@/components/meet/MemberActions'
export const dynamic = 'force-dynamic'
const N = (n) => '₦' + Number(n).toLocaleString('en-NG')
export async function generateMetadata({ params }) {
  const m = await membershipOf(params.handle).catch(() => null)
  return m ? { title: { absolute: `Join ${m.host.name}’s community | Olexweb Meet` }, description: `${m.perMonth} members-only meeting${m.perMonth === 1 ? '' : 's'} a month${m.line ? '. ' + m.line : ''}`.slice(0, 200) } : { title: 'Membership', robots: { index: false } }
}
export default async function Join({ params }) {
  const me = await currentMeetUser(), m = await membershipOf(params.handle, me).catch(() => null)
  if (!m) notFound()
  const home = meetBase() ? '/' : '/meet', day = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'Africa/Lagos' })
  const held = Math.min(m.heldThisMonth, m.perMonth)
  const status = m.mine ? { active: 'You’re a member', renewing: 'You’re a member', paused: 'Paused: no charge until the host holds a members-only meeting', lapsed: 'Your membership needs paying', ended: 'Your membership ended' }[m.mine.status] : null
  return (<div className="pb"><PubTop />
    <main className="pb-main pb-stack">
      <div className="pb-row">{m.host.picture ? <img className="pb-av" src={m.host.picture} alt="" referrerPolicy="no-referrer" /> : <span className="pb-av">{m.host.name.slice(0, 1)}</span>}
        <div><span className="pb-pill">Membership</span><h1 className="pb-h1" style={{ marginTop: 8 }}>{m.host.name}’s community</h1>{m.line ? <p className="pb-dim" style={{ margin: '4px 0 0' }}>{m.line}</p> : null}</div></div>
      {status ? <div className={'pb-ok' + (['lapsed', 'ended'].includes(m.mine.status) ? ' pb-bad' : '')}><b>{['lapsed', 'ended'].includes(m.mine.status) ? '!' : '✓'}</b><div><b>{status}</b>
        {m.mine.until && ['active', 'renewing'].includes(m.mine.status) ? <span className="pb-dim"> · {m.mine.cancelling ? 'ends' : 'renews'} {day(m.mine.until)}</span> : null}</div></div> : null}
      <div className="pb-two">
        <section className="pb-card pb-stack"><h2 className="pb-h2" style={{ margin: 0 }}>What members get</h2>
          <ul className="pb-list"><li><span><b>{m.perMonth} members-only meeting{m.perMonth === 1 ? '' : 's'} every month</b></span></li>
            {m.perks.free ? <li><span>Free entry to {m.host.name}’s paid meetings</span></li> : null}
            {m.perks.discount ? <li><span>{m.perks.discount}% off one-on-one sessions and course bundles</span></li> : null}
            <li><span>A Member badge in {m.host.name}’s meetings</span></li></ul>
          <div><div className="pb-row pb-sp"><b>This month, counted by Olexweb Meet</b><span>{m.heldThisMonth} of {m.perMonth} held</span></div>
            <div className="pb-meter" style={{ marginTop: 8 }}><i style={{ width: `${Math.round((held / m.perMonth) * 100)}%` }} /></div></div>
          <p className="pb-faint" style={{ margin: 0 }}>If {m.host.name} holds no members-only meeting in your month, you aren’t charged for the next one. Your membership pauses and starts again when they hold one.</p></section>
        <section className="pb-card pb-stack">
          <div className="pb-price">{N(m.mine && m.mine.price ? m.mine.price : m.price)}<span className="pb-dim" style={{ fontSize: 16, fontWeight: 650 }}> / month</span></div>
          <ul className="pb-list"><li><span>Cancel any time. You keep access until your paid month ends.</span></li><li><span>Renews monthly with the card you pay with (or a payment link if you pay another way).</span></li>
            <li><span>Secure payment by Paystack. You pay the price shown, nothing more.</span></li></ul>
          <MemberActions handle={m.host.handle} mine={m.mine} price={m.price} signedIn={!!me} home={home} back={`/meet/h/${m.host.handle}/join`} />
          <p className="pb-faint" style={{ margin: 0 }}>{m.members} member{m.members === 1 ? '' : 's'}. Olexweb keeps {m.pct}% of each payment for running the platform.</p></section>
      </div>
    </main></div>)
}
