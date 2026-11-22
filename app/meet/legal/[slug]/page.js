// Olexweb Meet's policies (Install 58): /meet/legal/earnings, /refunds, /community. Plain English, numbers from the app.
import { notFound } from 'next/navigation'
import { POLICIES, UPDATED, VERSION, SUPPORT } from '@/lib/meet/policies'
import PubTop from '@/components/meet/PubTop'
export const dynamic = 'force-static'
export function generateStaticParams() { return Object.keys(POLICIES).map((slug) => ({ slug })) }
export function generateMetadata({ params }) {
  const p = POLICIES[params.slug]
  return p ? { title: { absolute: `${p.title} | Olexweb Meet` }, description: p.lead } : { title: 'Policy', robots: { index: false } }
}
const id = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
export default function Policy({ params }) {
  const p = POLICIES[params.slug]; if (!p) notFound()
  const date = new Date(UPDATED + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  return (<div className="pb"><PubTop />
    <main className="pb-main pb-narrow pb-stack pol">
      <div><span className="pb-pill">Olexweb Meet · Policy</span><h1 className="pb-h1" style={{ marginTop: 10 }}>{p.title}</h1><p className="pb-dim" style={{ margin: '8px 0 0', fontSize: 17 }}>{p.lead}</p>
        <p className="pb-faint" style={{ margin: '8px 0 0' }}>Version {VERSION} · Updated {date}</p></div>
      <nav className="pb-card" aria-label="On this page"><b>On this page</b><ol className="pol-toc">{p.sections.map(([t]) => <li key={t}><a href={'#' + id(t)}>{t}</a></li>)}</ol></nav>
      {p.sections.map(([t, paras], i) => <section key={t} id={id(t)} className="pb-stack"><h2 className="pb-h2" style={{ margin: 0 }}><span className="pol-n">{i + 1}</span>{t}</h2>{paras.map((x, j) => <p key={j} style={{ margin: 0 }}>{x}</p>)}</section>)}
      <div className="pb-card pb-stack"><p style={{ margin: 0 }}>Olexweb’s general <a href="https://olexweb.com/terms">Terms</a> and <a href="https://olexweb.com/privacy">Privacy policy</a> also apply. Questions: <a href={'mailto:' + SUPPORT}>{SUPPORT}</a>.</p>
        <p className="pb-row" style={{ margin: 0 }}>Read also: {Object.entries(POLICIES).filter(([k]) => k !== params.slug).map(([k, v]) => <a key={k} className="pb-pill" href={`/meet/legal/${k}`}>{v.title}</a>)}</p></div>
    </main></div>)
}
