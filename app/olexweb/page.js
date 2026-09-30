import Page from '@/components/Page'
import Link from 'next/link'
import { site, services, process, work } from '@/content/site'
export const metadata = { title: 'What Olexweb builds', description: 'Websites, web applications, frontend engineering, UI/UX, interactive experiences, performance and SEO. Complete digital systems for real businesses.', alternates: { canonical: '/olexweb' } }
export default function Olexweb() {
  return (<Page>
    <p className="eyebrow">Olexweb</p>
    <h1>Complete digital systems for real businesses.</h1>
    <p className="lead">{site.description}</p>
    <h2>Services</h2>
    <div className="grid">{services.map(s => <div className="card" key={s.title}><h3>{s.title}</h3><p>{s.text}</p></div>)}</div>
    <h2>How the work gets made</h2>
    <ol>{process.map(p => <li key={p.title}><strong>{p.title}.</strong> {p.text}</li>)}</ol>
    <h2>Selected work</h2>
    <div className="grid">{work.map(w => <Link className="card" href={'/work/' + w.slug} key={w.slug}><h3>{w.name}</h3><p>{w.role}</p></Link>)}</div>
    <p><Link className="btn" href="/contact">Start a project</Link><Link className="btn ghost" href="/">Back to the studio</Link></p>
  </Page>)
}
