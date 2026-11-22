// Help (Install 58g): the common questions, by topic. The first group is what search engines read as the FAQ.
import Site, { Section, Final, PageHero, at } from '@/components/meet/site/Site'
import { siteBase, pageMeta } from '@/lib/meet/site'
import { FAQ, structuredData } from '@/lib/meet/seo'
import { providers } from '@/lib/meet/auth'
import { emailSignInReady } from '@/lib/meet/emailauth'
import { INVITE_PCT, INVITE_MONTHS, PAYOUT_MIN, naira } from '@/lib/meet/money'
export const dynamic = 'force-dynamic'
export const generateMetadata = () => pageMeta('/help', 'Help', 'Answers about Olexweb Meet: joining, hosting, weak networks, recording, AI notes, scheduling, getting paid and your account.')

const MORE = (ways) => [
  ['earning', 'Getting paid', [
    ['How do I get paid?', 'Add your bank once in Earn. Each sale is split the moment someone pays, and Paystack sends your part to your bank every week.'],
    ['Which ways to earn need Pro?', 'Selling tickets to paid meetings and Invite and earn work on any plan. Course bundles, paid one-on-one sessions, being listed in Find a mentor, memberships and paid certificates need Pro.'],
    ['Will I see the fees before I sell?', 'Yes. Before you set a price, the app shows every fee and exactly what reaches your bank, to the kobo.'],
    ['What happens if someone asks for a refund?', 'The refunds policy explains who can get one and when. A refunded sale is taken off what you are owed.'],
    ['How does Invite and earn work?', `Share your invite link. When someone you invited pays for Pro, you get ${INVITE_PCT}% of their payments for their first ${INVITE_MONTHS} months, paid on a Monday once ${naira(PAYOUT_MIN)} or more is ready.`]]],
  ['account', 'Your account', [
    ['How do I sign in?', `${ways}. The same buttons create your free account.`],
    ['Can I have a public profile?', 'Yes, if you want. Choose a profile name and switch on Show me publicly to appear on the leaderboard and let people find you.'],
    ['How do I get help from a person?', 'Use Help inside the app after you sign in, or write to Olexweb from olexweb.com.']]],
]
export default function Help() {
  const base = siteBase('/help')
  const list = [...providers().map((p) => p.name), ...(emailSignInReady() ? ['your email'] : [])]   // only what is really switched on
  const ways = list.length ? 'With ' + (list.length > 1 ? list.slice(0, -1).join(', ') + ' or ' + list[list.length - 1] : list[0]) : 'Sign-in opens soon'
  const groups = [['meetings', 'Meetings', FAQ], ...MORE(ways)]
  return (<Site base={base} active="/help">
    {structuredData('faq').map((d, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d).replace(/</g, '\\u003c') }} />)}
    <PageHero pill="Help" title="How can we" accent="help?" text="Quick answers to what people ask most. Still stuck? Sign in and use Help in the app." />
    <Section tight><div className="hgrid2">
      <nav className="hnav" aria-label="Topics">{groups.map(([id, t]) => <a key={id} href={'#' + id}>{t}</a>)}<a href="/meet/legal/earnings">Earnings policy</a><a href="/meet/legal/refunds">Refunds policy</a><a href="/meet/legal/community">Community rules</a></nav>
      <div>{groups.map(([id, t, list]) => <section key={id} id={id} className="hsec rv"><h2>{t}</h2><div className="faq">{list.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></section>)}</div>
    </div></Section>
    <Final base={base} second={<a className="btn" href={at(base, '/features')}>See every feature</a>} />
    <div style={{ height: 60 }} />
  </Site>)
}
