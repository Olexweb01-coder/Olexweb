// Pricing (Install 58g): Free, Pro for one meeting (Install 61) and Pro with the real prices from the admin, and what each includes.
import Site, { Section, Head, Final, PageHero, startHref, at } from '@/components/meet/site/Site'
import { siteBase, pageMeta } from '@/lib/meet/site'
import { pricing, naira, FREE_PEOPLE, MAX_WITH_EXTRA } from '@/lib/meet/plans'
import { currentMeetUser } from '@/lib/meet/auth'
import { PlanCards } from '@/components/meet/site/Plans'
const signinTo = (base, next) => `${base || ''}/?next=${encodeURIComponent(next)}#signin`.replace(/^\/\?/, '/?')
export const dynamic = 'force-dynamic'
export const generateMetadata = () => pageMeta('/pricing', 'Pricing', 'Olexweb Meet is free with no time limit for up to 100 people. Pro adds video recording, all your past meetings and transcripts, memberships and paid certificates.')

const ROWS = [['No time limit', 1, 1], [`Up to ${FREE_PEOPLE} people`, 1, 1], ['Audio and video, screen sharing, chat', 1, 1], ['Free MP3 recordings', 1, 1], ['AI meeting notes', 1, 1], ['Polls, Q&A and breakout rooms', 1, 1],
  ['End-to-end encryption', 1, 1], ['Sell tickets to paid meetings', 1, 1], ['Invite and earn', 1, 1], ['Free one-on-one sessions', 1, 1], ['Video recording', 0, 1], ['All your past meetings and transcripts', 'Last 3', 1], ['Course bundles', 0, 1], ['Paid one-on-one sessions', 0, 1], ['Listed in Find a mentor', 0, 1], ['Memberships', 0, 1], ['Paid certificates', 0, 1]]
const QS = [['Is the free plan really free?', `Yes. Meetings of up to ${FREE_PEOPLE} people with no time limit, for as long as you like. No card needed.`],
  ['Do my guests pay anything?', 'No. Guests join free from their browser. Only the host chooses a plan.'],
  ['Can I get Pro for just one meeting?', 'Yes. Buy Pro for a single meeting when you need video recording or certificates once.'],
  ['What if more than 100 people come?', `The host can choose to let more in, up to ${MAX_WITH_EXTRA}. You pay per extra person for each 30 minutes, with one invoice when the meeting ends.`],
  ['How do I pay?', 'In naira, securely through Paystack. Your card details never touch Olexweb.']]
const yes = (v) => (v === 1 ? <span className="yes" aria-label="Included">✓</span> : v === 0 ? <span className="no" aria-label="Not included">–</span> : <span>{v}</span>)

export default async function Pricing() {
  const base = siteBase('/pricing')
  const pr = await pricing().catch(() => ({ on: false, prices: {} })), p = pr.prices || {}
  const me = await currentMeetUser().catch(() => null)   // signed in: the plan buttons go straight to Billing
  return (<Site base={base} active="/pricing">
    <PageHero pill="Pricing" title="Free for real." accent="Pro when you grow." text={`Meet as long as you like with up to ${FREE_PEOPLE} people, free. Go Pro for recordings, your full history and more ways to earn.`} />
    <Section tight>
      {!pr.on ? <div className="soon rv"><b style={{ color: 'var(--fg)' }}>Right now, everything is free.</b> Every feature on this page works without paying. If that changes, you will see the prices here and in the app first.</div> : null}
      <PlanCards p={p} free={FREE_PEOPLE} freeHref={startHref(base)} oneHref={me ? at(base, '/') + '#billing' : signinTo(base, '/#billing')} proHref={me ? at(base, '/') + '#billing' : signinTo(base, '/#billing')} />
      <div className="ways" style={{ maxWidth: 920, margin: '14px auto 0', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))' }}>
        <div className="way rv"><h3>Big meetings</h3><p>{p.extra ? naira(p.extra) : '–'} per extra person for every 30 minutes, only past {FREE_PEOPLE} people, up to {MAX_WITH_EXTRA}. You choose to let more in.</p></div>
      </div>
    </Section>
    <Section alt>
      <Head eyebrow="Compare" title="What each plan includes" center />
      <div className="tablebox rv" style={{ maxWidth: 920, margin: '0 auto' }}><table className="ptable"><thead><tr><th scope="col">Feature</th><th scope="col">Free</th><th scope="col">Pro</th></tr></thead>
        <tbody>{ROWS.map(([l, f, pro]) => <tr key={l}><td>{l}</td><td>{yes(f)}</td><td>{yes(pro)}</td></tr>)}</tbody></table></div>
      <p className="rv" style={{ textAlign: 'center', color: 'var(--faint)', marginTop: 18, fontSize: 14 }}>Selling on Meet is free to start. The app shows every fee and what you keep before you set a price. <a href={at(base, '/earn')} style={{ textDecoration: 'underline' }}>How earning works</a></p>
    </Section>
    <Section>
      <Head title="Questions about pricing" center />
      <div className="faq rv">{QS.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
    </Section>
    <Final base={base} />
    <div style={{ height: 60 }} />
  </Site>)
}
