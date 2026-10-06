import Studio from '@/components/Studio'
import Link from 'next/link'
import { site, person, work, insights } from '@/content/site'
import { pageMetadata } from '@/lib/seo'

// the studio is indexed (its inner pages are not); its tags come from lib/seo.js
export const metadata = pageMetadata('studio')

export default function Home() {
  return (
    <>
      <Studio />
      {/* Real content underneath the room, for search engines and for anyone without WebGL */}
      <section className="seo" aria-label="About Olexweb" style={{ position: 'absolute', left: -9999, top: 0, width: 1, height: 1, overflow: 'hidden' }}>
        <h1>The Olexweb 3D studio</h1>
        <p>{site.description}</p>
        <p>{person.key}</p>
        <nav><Link href="/olexweb">What Olexweb builds</Link> <Link href="/work">Selected web work</Link> <Link href="/about">Olaitan Adebayo</Link> <Link href="/ventures">Ventures</Link> <Link href="/insights">Insights</Link> <Link href="/contact">Start a project</Link> <Link href="/">The main site</Link></nav>
        <ul>{work.map(w => <li key={w.slug}><Link href={'/work/' + w.slug}>{w.name}</Link>: {w.text}</li>)}</ul>
        <ul>{insights.map(a => <li key={a.slug}><Link href={'/insights/' + a.slug}>{a.title}</Link></li>)}</ul>
      </section>
    </>
  )
}
