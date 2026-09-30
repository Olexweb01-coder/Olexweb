import Page from '@/components/Page'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { work } from '@/content/site'
export function generateStaticParams() { return work.map(w => ({ slug: w.slug })) }
export function generateMetadata({ params }) { const w = work.find(x => x.slug === params.slug); if (!w) return {}; return { title: w.name + ' — web work by Olexweb', description: w.text, alternates: { canonical: '/work/' + w.slug } } }
export default function Project({ params }) {
  const w = work.find(x => x.slug === params.slug); if (!w) notFound()
  return (<Page>
    <p className="eyebrow">Olexweb · Work</p>
    <h1>{w.name}</h1>
    <p className="lead">{w.text}</p>
    <img className="shot" src={'/studio/sites/' + w.key + '.jpg'} alt={w.name + ' website'} />
    <h2>What was built</h2>
    <ul className="tags">{w.built.map(b => <li key={b}>{b}</li>)}</ul>
    <p><strong>Role:</strong> {w.role}</p>
    {w.result && <p><strong>Result:</strong> {w.result}</p>}
    <p><a className="btn" href={w.url} target="_blank" rel="noopener">Visit {w.url.replace(/^https?:\/\//, '')}</a><Link className="btn ghost" href="/contact">Build something like this</Link></p>
    <p className="muted"><Link href="/work">All work</Link> · <Link href="/#monitors">See it on the monitor in the studio</Link></p>
  </Page>)
}
