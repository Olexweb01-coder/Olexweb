import Page from '@/components/Page'
import Link from 'next/link'
import { ventures } from '@/content/site'
export const metadata = { title: 'Ventures and products by Olaitan Adebayo', description: 'Elvanex Digital, Needar and Aviirel: companies and products originated by Olaitan Adebayo.', alternates: { canonical: '/ventures' } }
export default function Ventures() {
  return (<Page>
    <p className="eyebrow">Olaitan · Ventures and products</p>
    <h1>Things I originated.</h1>
    <p className="lead">Not websites for clients. Companies and products that started as a problem worth solving.</p>
    <div className="grid">{ventures.map(v => <Link className="card" href={'/ventures/' + v.slug} key={v.slug}><h3>{v.name}</h3><p>{v.line}</p></Link>)}</div>
  </Page>)
}
