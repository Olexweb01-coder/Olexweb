import Page from '@/components/Page'
import Link from 'next/link'
import { insights } from '@/content/site'
export const metadata = { title: 'Insights', description: 'Writing from the Olexweb studio on the web, products and thinking.', alternates: { canonical: '/insights' } }
export default function Insights() {
  return (<Page>
    <p className="eyebrow">Insights</p>
    <h1>From the shelf.</h1>
    <p className="lead">Writing on the web, products and thinking. Each of these is also a book on the shelf in the studio.</p>
    {insights.map(a => <article key={a.slug} style={{ margin: '26px 0' }}><h2 style={{ margin: '0 0 6px' }}><Link href={'/insights/' + a.slug} style={{ color: 'inherit', textDecoration: 'none' }}>{a.title}</Link></h2><p className="muted">{a.date} · {a.minutes} min read</p><p>{a.summary}</p></article>)}
  </Page>)
}
