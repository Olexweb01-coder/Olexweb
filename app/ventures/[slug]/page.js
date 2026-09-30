import Page from '@/components/Page'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ventures } from '@/content/site'
export function generateStaticParams() { return ventures.map(v => ({ slug: v.slug })) }
export function generateMetadata({ params }) { const v = ventures.find(x => x.slug === params.slug); if (!v) return {}; return { title: v.name, description: v.line, alternates: { canonical: '/ventures/' + v.slug } } }
export default function Venture({ params }) {
  const v = ventures.find(x => x.slug === params.slug); if (!v) notFound()
  return (<Page>
    <p className="eyebrow">Olaitan · Ventures</p>
    <h1>{v.name}</h1>
    <p className="lead">{v.line}</p>
    {v.text.map((t, i) => <p key={i}>{t}</p>)}
    <p className="muted"><Link href="/ventures">All ventures</Link> · <Link href="/olaitan">Olaitan Adebayo</Link></p>
  </Page>)
}
