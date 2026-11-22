// About (Install 58g): why Meet exists and what it promises.
import Site, { Section, Head, Final, PageHero, at } from '@/components/meet/site/Site'
import { I } from '@/components/meet/app/icons'
import { siteBase, pageMeta } from '@/lib/meet/site'
export const dynamic = 'force-dynamic'
export const generateMetadata = () => pageMeta('/about', 'About', 'Why Olexweb Meet exists: meetings that work on everyday phones and networks, honest fees, and real ways for teachers and mentors to earn.')

export default function About() {
  const base = siteBase('/about')
  return (<Site base={base} active="/about">
    <PageHero pill="About Olexweb Meet" title="Meetings that work" accent="where you are." text="Olexweb Meet is built for the phones and networks people actually use, so a class, a prayer meeting or a coaching call never depends on perfect Wi-Fi." />
    <Section tight><div className="prose rv">
      <p>Most meeting apps are made for fast office internet. Many of the people we meet join on mobile data, on a busy network, from a phone. When the signal drops, the meeting shouldn’t.</p>
      <p>So Meet protects <b>voice first</b>, lowers video on its own, and lets anyone switch cameras off to save data. Guests join with <b>one tap</b>, with no app and no account. Free meetings have <b>no time limit</b>.</p>
      <p>We also believe the people who teach and mentor should be able to <b>earn from it</b>, simply and fairly. That is why selling on Meet shows every fee before you set a price, and pays you every week.</p>
      <p>Olexweb Meet is part of <a href="https://olexweb.com" style={{ textDecoration: 'underline', color: 'var(--fg)' }}>Olexweb</a>.</p>
    </div></Section>
    <Section alt>
      <Head eyebrow="What we promise" title="Built on trust" center />
      <div className="vals">
        <div className="val rv"><span className="ni bg-g"><I n="check" className="ico" /></span><h3>Honest money</h3><p>Every fee shown before you sell, to the kobo. Every number on a profile or leaderboard is counted by Meet, never typed in.</p></div>
        <div className="val rv d1"><span className="ni bg-y"><I n="users" className="ico" /></span><h3>Easy for everyone</h3><p>If your guest can open a link, they can join. No downloads, no sign-ups, no confusing steps.</p></div>
        <div className="val rv d2"><span className="ni bg-b"><I n="lock" className="ico" /></span><h3>Private by choice</h3><p>Recordings stay on your device. Turn on encryption and only the people in the meeting can see and hear it.</p></div>
      </div>
    </Section>
    <Final base={base} second={<a className="btn" href={at(base, '/help')}>Get help</a>} />
    <div style={{ height: 60 }} />
  </Site>)
}
