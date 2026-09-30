import Page from '@/components/Page'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { insights, person, site } from '@/content/site'
export function generateStaticParams() { return insights.map(a => ({ slug: a.slug })) }
export function generateMetadata({ params }) { const a = insights.find(x => x.slug === params.slug); if (!a) return {}; return { title: a.title, description: a.summary, keywords: a.keywords, alternates: { canonical: '/insights/' + a.slug }, openGraph: { type: 'article', title: a.title, description: a.summary, publishedTime: a.date } } }
export default function Article({ params }) {
  const a = insights.find(x => x.slug === params.slug); if (!a) notFound()
  const ld = { '@context': 'https://schema.org', '@type': 'Article', headline: a.title, description: a.summary, datePublished: a.date, author: { '@type': 'Person', name: person.name, url: site.domain + '/olaitan' }, publisher: { '@type': 'Organization', name: 'Olexweb', url: site.domain } }
  return (<Page>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
    <p className="eyebrow">Insights</p>
    <h1>{a.title}</h1>
    <p className="muted">{a.date} · {a.minutes} min read · by <Link href="/olaitan">Olaitan Adebayo</Link></p>
    <div className="article">{a.body.map((t, i) => t.startsWith('## ') ? <h2 key={i}>{t.slice(3)}</h2> : <p key={i}>{t}</p>)}</div>
    <p className="muted"><Link href="/insights">All insights</Link> · <Link href="/#shelf">Open it as a book in the studio</Link></p>
  </Page>)
}
