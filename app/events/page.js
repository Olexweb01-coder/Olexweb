import Page from '@/components/Page'
import { events, site } from '@/content/site'
export const metadata = { title: 'Events', description: events[0].summary, alternates: { canonical: '/events' } }
export default function Events() {
  return (<Page>
    <p className="eyebrow">Events</p>
    {events.map(e => (
      <section key={e.slug}>
        <h1>{e.title}</h1>
        <p className="lead">{e.kicker}. {e.status}.</p>
        {e.about.map((t, i) => <p key={i}>{t}</p>)}
        <h2>What it covers</h2>
        <ul>{e.covers.map(c => <li key={c}>{c}</li>)}</ul>
        <p><a className="btn" href={site.whatsapp.replace(/text=.*$/, 'text=' + encodeURIComponent('Hi Olexweb, I want to register my interest in ' + e.title + '.'))} target="_blank" rel="noopener">Register interest on WhatsApp</a><a className="btn ghost" href={'mailto:' + site.email + '?subject=' + encodeURIComponent(e.title)}>Email</a></p>
      </section>
    ))}
  </Page>)
}
