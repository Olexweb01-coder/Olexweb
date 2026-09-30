import Page from '@/components/Page'
import Link from 'next/link'
import { person, ventures } from '@/content/site'
export const metadata = { title: 'Olaitan Adebayo — the person behind Olexweb', description: person.key, alternates: { canonical: '/olaitan' }, keywords: ['Olaitan Adebayo', 'Adebayo Olaitan', 'creative ideator', 'web developer', 'Olexweb'] }
export default function Olaitan() {
  return (<Page>
    <p className="eyebrow">Olaitan Adebayo</p>
    <h1>{person.role}</h1>
    <p className="lead">{person.key}</p>
    <p className="lead">{person.line}</p>
    <div className="photos">{person.photos.map((p, i) => <img key={p} src={p} alt={'Olaitan Adebayo ' + (i + 1)} loading={i < 2 ? 'eager' : 'lazy'} />)}</div>
    <h2>The story</h2>
    {person.story.map((t, i) => <p key={i}>{t}</p>)}
    <h2>What I think about</h2>
    <ul className="tags">{person.interests.map(t => <li key={t}>{t}</li>)}</ul>
    <h2>Things I originated</h2>
    <div className="grid">{ventures.map(v => <Link className="card" href={'/ventures/' + v.slug} key={v.slug}><h3>{v.name}</h3><p>{v.line}</p></Link>)}</div>
    <p><Link className="btn ghost" href="/thinking">How I think</Link><Link className="btn ghost" href="/lab">The lab</Link><Link className="btn" href="/olexweb">Olexweb, the workspace</Link></p>
  </Page>)
}
