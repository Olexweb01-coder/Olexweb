// The public leaderboard (Install 58d, restyled in 58g): this month's leaders on each board, and last month's winners.
import { leaderboard, spotlight } from '@/lib/meet/community'
import Site, { Section, PageHero, Final } from '@/components/meet/site/Site'
import { I } from '@/components/meet/app/icons'
import { siteBase, pageMeta } from '@/lib/meet/site'
export const dynamic = 'force-dynamic'
export const generateMetadata = () => pageMeta('/leaders', 'Leaderboard', 'Top hosts on Olexweb Meet this month. Counted by Olexweb Meet from real meetings.')
const BOARDS = [['hours', 'Most hours', ' h'], ['biggest', 'Biggest meeting', ' people'], ['rated', 'Best rated', '★'], ['loved', 'Most 5-star reviews', '']]
const month = (m) => new Date(m + '-15T12:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
export default async function Leaders() {
  const base = siteBase('/leaders')
  const [lb, spot] = await Promise.all([leaderboard(undefined, 10).catch(() => null), spotlight().catch(() => null)])
  return (<Site base={base} active="/leaders">
    <PageHero pill={lb ? month(lb.month) : 'This month'} title="Leaderboard" accent="" text="Top hosts this month. Winners on the 1st get 3 days of Pro and the spotlight. Only public profiles appear; every number is counted by Olexweb Meet." />
    <Section tight>
      {spot ? <div style={{ marginBottom: 18 }}><h2 style={{ fontSize: 26, marginBottom: 14 }}>{month(spot.month)} winners</h2><div className="ways">{Object.values(spot.winners).map((w) => <a key={w.label} className="way" href={'/meet/h/' + w.handle}><span className="ni bg-y"><I n="trophy" className="ico" /></span><h3>{w.name}</h3><p>{w.label}</p></a>)}</div></div> : null}
      <div className="lbgrid">{BOARDS.map(([k, label, unit]) => <section key={k} className="lbcard"><h3>{label}</h3>
        {lb && lb[k] && lb[k].length ? <ol>{lb[k].map((x, i) => <li key={x.handle}><span className={'n' + (i < 3 ? ' top' : '')}>{i + 1}</span><a href={'/meet/h/' + x.handle}>{x.name}</a><b className="num">{x.value}{unit}</b></li>)}</ol>
          : <p style={{ color: 'var(--faint)', margin: 0 }}>No one yet this month. Host a meeting to be first.</p>}</section>)}</div>
    </Section>
    <Final base={base} title="Your name could be here." text="Host meetings, earn XP and climb the board. It starts with one meeting." />
    <div style={{ height: 60 }} />
  </Site>)
}
