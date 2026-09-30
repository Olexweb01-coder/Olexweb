import Page from '@/components/Page'
import { vision } from '@/content/site'
export const metadata = { title: 'Vision and mission', description: vision.vision, alternates: { canonical: '/vision' } }
export default function Vision() {
  return (<Page>
    <p className="eyebrow">Olexweb · Vision</p>
    <h1>Where this is going.</h1>
    <h2>Vision</h2><p className="lead">{vision.vision}</p>
    <h2>Mission</h2><p className="lead">{vision.mission}</p>
    <h2>Now building</h2><ul>{vision.now.map((n, i) => <li key={i}>{n}</li>)}</ul>
  </Page>)
}
