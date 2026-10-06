import Page from '@/components/Page'
import Link from 'next/link'
import { work } from '@/content/site'
export const metadata = { title: 'Selected web work', description: 'Websites, platforms and admin systems built by Olexweb: Viverst Global, Mojatech Electrical, Leathrock, Edithe Lekwachi, Ayodele Daniel, Tolu Afilaka Live.', alternates: { canonical: '/work' } }
export default function Work() {
  return (<Page wide>
    <p className="eyebrow">Olexweb · Work</p>
    <h1>Selected web work.</h1>
    <p className="lead">Complete systems, not landing pages: the website, the platform behind it, and the admin that runs it.</p>
    <div className="grid">{work.map(w => <Link className="card" href={'/work/' + w.slug} key={w.slug}><img className="shot" src={'/studio/sites/' + w.key + '.jpg'} alt={w.name + ' website'} style={{ aspectRatio: '16/10', objectFit: 'cover', objectPosition: 'top', margin: '0 0 12px' }} /><h3>{w.name}</h3><p>{w.role} · {w.built.join(', ')}</p></Link>)}</div>
  </Page>)
}
