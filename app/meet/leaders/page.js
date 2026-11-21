// This month's leaderboard (only hosts who turned "Show me publicly" on), and last month's winners.
import { leaderboard, spotlight, BOARDS } from '@/lib/meet/community'
import { meetBase } from '@/lib/site/meet'
export const dynamic = 'force-dynamic'
export const metadata = { title: { absolute: 'Leaderboard | Olexweb Meet' }, description: 'This month’s top hosts on Olexweb Meet.' }
export default async function Leaders() {
  const [lb, spot] = await Promise.all([leaderboard(undefined, 10).catch(() => null), spotlight().catch(() => null)])
  const home = meetBase() ? '/' : '/meet', unit = { hours: ' h', biggest: ' people', rated: ' ★', loved: '' }
  const month = (k) => new Date(k + '-01T12:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  return (<div className="mh">
    <header className="mh-top"><a className="mh-brand" href={home}><img src="/meet/logo-96.png" alt="" width="40" height="40" /><span>Olexweb <b>Meet</b></span></a></header>
    <main className="pf">
      <h1 className="pf-h1">Leaderboard · {lb ? month(lb.month) : ''}</h1>
      <p className="md-dim">Top hosts this month. Winners get a month of Pro and the spotlight. Only hosts who chose to be shown publicly appear here.</p>
      {spot ? <section className="pf-spot"><h2>🏆 {month(spot.month)} winners</h2><ul className="pf-list">{Object.values(spot.winners).map((w) => <li key={w.label}><b>{w.label}</b><span><a href={'/meet/h/' + w.handle}>{w.name}</a></span></li>)}</ul></section> : null}
      <div className="pf-boards">{BOARDS.map(([k, label]) => <section key={k} className="md-card"><span className="md-lab">{label}</span>
        {lb && lb[k].length ? <ol className="pf-ol">{lb[k].map((x, i) => <li key={x.handle}><a href={'/meet/h/' + x.handle}>{x.name}</a><b>{x.value}{unit[k]}</b></li>)}</ol> : <small>No one yet this month. Host a meeting and you could be first.</small>}</section>)}</div>
    </main>
  </div>)
}
