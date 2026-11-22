// Who Meet is for (Install 58g): schools, churches, coaches and mentors, teams, communities and events.
import Site, { Section, Final, PageHero, startHref, at } from '@/components/meet/site/Site'
import { Check } from '@/components/meet/site/Bits'
import { I } from '@/components/meet/app/icons'
import { siteBase, pageMeta } from '@/lib/meet/site'
export const dynamic = 'force-dynamic'
export const generateMetadata = () => pageMeta('/for', 'Who it’s for', 'Olexweb Meet for schools and teachers, churches, coaches and mentors, teams, and communities: free meetings that work on mobile data.')

const WHO = [
  ['school', 'Schools and teachers', 'cert', '', 'Classes that feel like a classroom.', 'Teach live to a class of 100 for free, see who came, and give certificates people can check.', ['Attendance and sign-up details, collected for you', 'Polls, quizzes and Q&A', 'Breakout rooms for group work', 'Free MP3 recordings for students who missed it', 'Sell course bundles with early-bird prices']],
  ['church', 'Churches and fellowships', 'users', 'gold', 'Fellowship from anywhere.', 'Bible study, prayer meetings and services that work on any phone and any network.', ['Audio meetings that are light on data', 'Only the people you allow can speak', 'Your own room link for every week', 'Free MP3 recordings to share after', 'Members-only meetings for your community']],
  ['coach', 'Coaches and mentors', 'star', '', 'Coaching that pays.', 'Take bookings, sell sessions and build a community that pays you every month.', ['Your own booking page with your hours and price', 'Get found in Find a mentor', 'Monthly memberships for members-only meetings', 'Certificates with your name and signature', 'Paid to your bank every week']],
  ['team', 'Teams and businesses', 'rocket', 'gold', 'Teams that move faster.', 'Stand-ups, reviews, interviews and client calls without the friction.', ['A room link that never changes', 'AI notes with decisions and next steps', 'Screen sharing and end-to-end encryption', 'Schedule with calendar invites', 'No time limit, ever']],
  ['community', 'Communities and events', 'spark', '', 'Gatherings people come back to.', 'Webinars, meetups and online events, with tickets if you want them.', ['Sell tickets: nobody gets in without one', 'Track who opened your link and who paid', 'Up to 500 people for big meetings', 'Reactions, chat and hands up', 'A leaderboard that celebrates your best hosts']],
]
export default function ForYou() {
  const base = siteBase('/for')
  return (<Site base={base} active="/for">
    <PageHero pill="Made for you" title="Whoever you gather," accent="Meet fits." text="The same simple meeting, shaped for the way you teach, worship, coach or work.">
      <nav className="jump" aria-label="Jump to">{WHO.map(([id, label]) => <a key={id} href={'#' + id}>{label}</a>)}</nav></PageHero>
    <Section tight>{WHO.map(([id, label, icon, tone, title, text, list], i) => (<article key={id} id={id} className="aud rv">
      <div><span className="tag">{label}</span><h3 style={{ margin: '14px 0 10px' }}>{title}</h3><p style={{ margin: '0 0 18px' }}>{text}</p><ul className="checks">{list.map((x) => <Check key={x}>{x}</Check>)}</ul>
        <div className="cta"><a className="btn go" href={startHref(base)}>Start free</a>{id === 'coach' ? <a className="btn" href={at(base, '/earn')}>How earning works</a> : null}</div></div>
      <div className={'art' + (tone ? ' ' + tone : '')} style={i % 2 ? { order: -1 } : undefined} aria-hidden="true"><I n={icon} className="ico" /></div></article>))}</Section>
    <Final base={base} second={<a className="btn" href={at(base, '/features')}>See every feature</a>} />
    <div style={{ height: 60 }} />
  </Site>)
}
