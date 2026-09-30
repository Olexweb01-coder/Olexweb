import Studio from '@/components/Studio'
import Link from 'next/link'
import { site, person, work, insights } from '@/content/site'

export const metadata = { title: 'Olexweb — Digital experiences that matter', description: site.description, alternates: { canonical: '/' } }

export default function Home() {
  return (
    <>
      <Studio />
      {/* Real content underneath the room, for search engines and for anyone without WebGL */}
      <section className="seo" aria-label="About Olexweb" style={{ position: 'absolute', left: -9999, top: 0, width: 1, height: 1, overflow: 'hidden' }}>
        <h1>Olexweb — Digital experiences that matter</h1>
        <p>{site.description}</p>
        <p>{person.key}</p>
        <nav><Link href="/olexweb">What Olexweb builds</Link> <Link href="/work">Selected web work</Link> <Link href="/olaitan">Olaitan Adebayo</Link> <Link href="/ventures">Ventures</Link> <Link href="/insights">Insights</Link> <Link href="/contact">Start a project</Link></nav>
        <ul>{work.map(w => <li key={w.slug}><Link href={'/work/' + w.slug}>{w.name}</Link>: {w.text}</li>)}</ul>
        <ul>{insights.map(a => <li key={a.slug}><Link href={'/insights/' + a.slug}>{a.title}</Link></li>)}</ul>
      </section>
    </>
  )
}
