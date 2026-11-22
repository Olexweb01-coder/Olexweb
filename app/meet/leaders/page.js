// The public leaderboard (Install 58d: the new design): this month's leaders on each board, and last month's winners.
import { leaderboard, spotlight } from '@/lib/meet/community'
import PubTop from '@/components/meet/PubTop'
export const dynamic = 'force-dynamic'
export const metadata = { title: { absolute: 'Leaderboard | Olexweb Meet' }, description: 'Top hosts on Olexweb Meet this month. Counted by Olexweb Meet from real meetings.' }
const BOARDS = [['hours', 'Most hours', ' h'], ['biggest', 'Biggest meeting', ' people'], ['rated', 'Best rated', '★'], ['loved', 'Most 5-star reviews', '']]
const month = (m) => new Date(m + '-15T12:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
export default async function Leaders() {
  const [lb, spot] = await Promise.all([leaderboard(undefined, 10).catch(() => null), spotlight().catch(() => null)])
  return (<div className="pb"><PubTop />
    <main className="pb-main pb-stack">
      <div><span className="pb-pill pb-gold">🏆 {lb ? month(lb.month) : 'This month'}</span><h1 className="pb-h1" style={{ marginTop: 10 }}>Leaderboard</h1>
        <p className="pb-dim" style={{ margin: '6px 0 0' }}>Top hosts this month. Winners on the 1st get a month of Pro and the spotlight. Only public profiles appear; every number is counted by Olexweb Meet.</p></div>
      {spot ? <section className="pb-card pb-stack"><h2 className="pb-h2" style={{ margin: 0 }}>{month(spot.month)} winners</h2><div className="pb-grid">{Object.values(spot.winners).map((w) => <a key={w.label} className="pb-row" style={{ textDecoration: 'none', flexWrap: 'nowrap' }} href={'/meet/h/' + w.handle}>
        <span className="pb-av" style={{ background: '#e9c46a', color: '#2a1f00' }}>{(w.name || '?').slice(0, 1)}</span><span><b>{w.name}</b><br /><small className="pb-faint">{w.label}</small></span></a>)}</div></section> : null}
      <div className="pb-grid">{BOARDS.map(([k, label, unit]) => <section key={k} className="pb-card pb-stack"><b>{label}</b>
        {lb && lb[k].length ? <ol className="lb-ol">{lb[k].map((x, i) => <li key={x.handle}><span className={'lb-n' + (i < 3 ? ' top' : '')}>{i + 1}</span><a href={'/meet/h/' + x.handle}>{x.name}</a><b>{x.value}{unit}</b></li>)}</ol>
          : <p className="pb-faint" style={{ margin: 0 }}>No one yet this month. Host a meeting to be first.</p>}</section>)}</div>
    </main></div>)
}
