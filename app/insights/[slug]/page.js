import { notFound } from 'next/navigation'
import { insights } from '@/content/site'
import { articleMetadata, articleJsonLd } from '@/lib/seo'
import JsonLd from '@/components/JsonLd'
import V2Shell from '@/components/V2Shell'

export const dynamicParams = false
export function generateStaticParams() { return insights.map((a) => ({ slug: a.slug })) }
export function generateMetadata({ params }) { const a = insights.find((x) => x.slug === params.slug); return a ? articleMetadata(a) : {} }
const fmt = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

export default function Article({ params }) {
  const i = insights.findIndex((x) => x.slug === params.slug); if (i < 0) notFound()
  const a = insights[i], next = insights[(i + 1) % insights.length]
  return (
    <V2Shell kind="blog">
      <JsonLd data={articleJsonLd(a)} />
      <article className="art-page"><div className="art">
        <p className="art-back"><a href="/insights">Back to the Blog</a></p>
        <h1>{a.title}</h1>
        <p className="art-meta">{fmt(a.date)}. A {a.minutes}-minute read.</p>
        {a.body.map((p, k) => p.startsWith('## ') ? <h2 key={k}>{p.slice(3)}</h2> : <p key={k}>{p}</p>)}
        <div className="art-next"><small>Next article</small><a href={'/insights/' + next.slug}>{next.title}</a></div>
      </div></article>
    </V2Shell>
  )
}
