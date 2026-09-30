import Page from '@/components/Page'
import Link from 'next/link'
import { thinking } from '@/content/site'
export const metadata = { title: 'Thinking and learning', description: thinking.line, alternates: { canonical: '/thinking' } }
export default function Thinking() {
  return (<Page>
    <p className="eyebrow">Olaitan · Thinking</p>
    <h1>{thinking.line}</h1>
    {thinking.areas.map(a => <section key={a.title}><h2>{a.title}</h2>{(a.body || [a.text]).map((t, i) => <p key={i}>{t}</p>)}</section>)}
    <p className="muted"><Link href="/#shelf">Read these as books on the shelf in the studio</Link></p>
  </Page>)
}
