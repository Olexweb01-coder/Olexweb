import Page from '@/components/Page'
import Link from 'next/link'
import { teaching } from '@/content/site'
export const metadata = { title: 'Learn with Olexweb', description: teaching.line, alternates: { canonical: '/teaching' } }
export default function Teaching() {
  return (<Page>
    <p className="eyebrow">Olexweb · Teaching</p>
    <h1>{teaching.title}</h1>
    <p className="lead">{teaching.line}</p>
    <div className="grid">{teaching.topics.map(t => <div className="card" key={t.title}><h3>{t.title}</h3><p>{t.text}</p></div>)}</div>
    <p className="muted">Lessons are being prepared. <Link href="/contact">Ask to be told when the first one is out.</Link></p>
  </Page>)
}
