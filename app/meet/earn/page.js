// Earn (Install 58g): the ways hosts get paid, how money reaches the bank, and the "what you keep" calculator.
// Olexweb's own share is not listed here; the calculator shows the total of fees, and the earnings policy has the detail.
import Site, { Section, Head, Final, PageHero, startHref, at } from '@/components/meet/site/Site'
import { Calc } from '@/components/meet/site/Bits'
import { I } from '@/components/meet/app/icons'
import { siteBase, pageMeta } from '@/lib/meet/site'
import { one } from '@/lib/meet/db'
import { AMBASSADOR, INVITE_PCT, INVITE_MONTHS, HOLD_DAYS } from '@/lib/meet/money'
export const dynamic = 'force-dynamic'
export const generateMetadata = () => pageMeta('/earn', 'Earn', 'Get paid for what you teach on Olexweb Meet: tickets, course bundles, memberships, one-on-one sessions, certificates and invites. Every fee shown before you sell; paid to your bank every week.')

const WAYS = [
  ['video', 'bg-g', 'Paid meetings', 'Set a ticket price when you schedule. Nobody gets in without one. See who opened your link, started paying and paid.'],
  ['gift', 'bg-o', 'Course bundles', 'Several sessions as one ticket. Early-bird prices until a date, and group prices with one link per person.'],
  ['users', 'bg-y', 'Memberships', 'People pay you monthly for members-only meetings. If you hold none in a month, members are not charged for the next one.'],
  ['mic', 'bg-b', 'One-on-one sessions', 'Open your booking page with your hours and price. List yourself in Find a mentor to be discovered.'],
  ['cert', 'bg-y', 'Certificates', 'Charge for certificates in five designs, with your academy’s name, your signature and a code anyone can check.'],
]
export default async function Earn() {
  const base = siteBase('/earn')
  const s = await one('select ambassador_prize from meet_settings where id = 1').catch(() => null)
  const prize = s && s.ambassador_prize != null ? Number(s.ambassador_prize) : AMBASSADOR.prizeNaira
  return (<Site base={base} active="/earn">
    <header className="hero"><div className="glow" style={{ width: 520, height: 520, background: '#c9a44a', right: -160, top: -140, opacity: 0.28 }} /><div className="glow" style={{ width: 420, height: 420, background: '#2f7d3a', left: -160, top: 220 }} />
      <div className="wrap hgrid">
        <div><span className="pill"><i />Earn on Olexweb Meet</span>
          <h1><span className="w1" style={{ animationDelay: '.05s' }}>Teach.</span> <span className="w1" style={{ animationDelay: '.15s' }}>Mentor.</span> <span className="w1 grad" style={{ animationDelay: '.28s' }}>Get paid.</span></h1>
          <p className="lede">Turn what you know into income. You set the price. You see every fee before you sell. Your money goes to your bank every week.</p>
          <div className="cta"><a className="btn go" href={startHref(base)}>Start earning, free</a><a className="btn" href="#calc">Work out what you keep</a></div></div>
        <div id="calc" style={{ scrollMarginTop: 90 }}><Calc price={10000} title="What you keep, to the kobo" style={{ background: 'var(--card)' }} /></div>
      </div></header>

    <Section tight>
      <Head eyebrow="Ways to earn" title="Pick one. Or all of them." />
      <div className="ways">
        {WAYS.map(([icon, bg, title, text], i) => <div key={title} className={'way rv' + (i % 3 ? ' d' + (i % 3) : '')}><span className={'ni ' + bg}><I n={icon} className="ico" /></span><h3>{title}</h3><p>{text}</p></div>)}
        <div className="way rv d2"><span className="ni bg-g"><I n="coin" className="ico" /></span><h3>Invite and earn</h3><p>Get {INVITE_PCT}% of every Pro payment from people you invite, for their first {INVITE_MONTHS} months. Five invites in 15 days earns a week of Pro.</p><span className="k">Paid every Monday</span></div>
      </div>
    </Section>

    <Section alt>
      <Head eyebrow="How you get paid" title="From sale to bank, clearly" center />
      <div className="timeline"><div className="rv"><span>1</span><b>Add your bank</b><p>Once. Paystack checks the name on the account.</p></div><div className="rv d1"><span>2</span><b>Someone pays</b><p>The payment is split at that moment, so your part is never mixed with anyone else’s.</p></div><div className="rv d2"><span>3</span><b>You see it</b><p>Every sale shows in Earn with exactly what you keep.</p></div><div className="rv d3"><span>4</span><b>Paid weekly</b><p>Paystack sends your sales to your bank every week.</p></div></div>
    </Section>

    <Section>
      <div className="lv">
        <div className="rv"><span className="eyebrow" style={{ color: 'var(--gold)' }}>Ambassador of the month</span><h2 style={{ fontSize: 'clamp(32px,4.4vw,54px)', margin: '12px 0 14px' }}>Bring people. Win up to ₦{prize.toLocaleString('en-NG')}.</h2>
          <p style={{ color: 'var(--dim)', fontSize: 18, margin: 0 }}>Every month, whoever invites the most new hosts (at least {AMBASSADOR.minInvites}) is Ambassador of the month. When the people they invited paid for Pro that month, the prize is cash, on top of their {INVITE_PCT}% share; otherwise it is a free week of Pro. Invite earnings are ready {HOLD_DAYS} days after each payment and paid every Monday.</p>
          <div className="cta"><a className="btn go" href={startHref(base)}>Get your invite link</a><a className="btn" href="/meet/legal/earnings">Read the earnings policy</a></div></div>
        <div className="acards rv d1" aria-hidden="true"><div className="ac a1"><span className="m"><I n="gift" className="ico" /></span><div><b>{INVITE_PCT}%</b><br /><small>of their Pro payments</small></div></div><div className="ac a2"><span className="m"><I n="cal" className="ico" /></span><div><b>{INVITE_MONTHS} months</b><br /><small>for every person you invite</small></div></div><div className="ac a3"><span className="m"><I n="trophy" className="ico" /></span><div><b>₦{prize.toLocaleString('en-NG')}</b><br /><small>Ambassador of the month</small></div></div></div>
      </div>
    </Section>

    <Section tight>
      <div className="soon rv"><b style={{ color: 'var(--fg)' }}>No surprises, ever.</b> Before you set a price, the app shows every fee and exactly what reaches your bank, to the kobo. <a href="/meet/legal/earnings" style={{ textDecoration: 'underline' }}>How fees and payouts work</a></div>
    </Section>
    <Final base={base} title="Start earning this week." text="Create your free account, add your bank, and set your first price." second={<a className="btn" href={at(base, '/mentors')}>Find a mentor</a>} />
    <div style={{ height: 60 }} />
  </Site>)
}
