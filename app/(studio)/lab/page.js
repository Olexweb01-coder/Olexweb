import Page from '@/components/Page'
import { lab } from '@/content/site'
export const metadata = { title: 'The lab — ideas and experiments', description: 'SaaS concepts, AI experiments, web and UI experiments, business ideas and prototypes by Olaitan Adebayo.', alternates: { canonical: '/lab' } }
export default function Lab() {
  return (<Page>
    <p className="eyebrow">Olaitan · The lab</p>
    <h1>Not every idea needs to become a company.</h1>
    <p className="lead">This is where the rest of them live.</p>
    <div className="grid">{lab.map(l => <div className="card" key={l.title}><h3>{l.title}</h3><p>{l.text}</p></div>)}</div>
  </Page>)
}
