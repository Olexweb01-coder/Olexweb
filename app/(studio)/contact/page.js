import Page from '@/components/Page'
import Script from 'next/script'
import { site } from '@/content/site'
export const metadata = { title: 'Start your next project', description: 'Tell Olexweb about your idea. WhatsApp, email or call.', alternates: { canonical: '/contact' } }
export default function Contact() {
  return (<Page>
    <p className="eyebrow">Let's create together</p>
    <h1>Start your next project.</h1>
    <p className="lead">Tell me about your idea and let's build something amazing together.</p>
    <p><a className="btn" href={site.whatsapp} target="_blank" rel="noopener">Chat on WhatsApp</a><a className="btn ghost" href={'mailto:' + site.email + '?subject=' + encodeURIComponent('New project for Olexweb')}>Email {site.email}</a></p>
    <p><a className="btn ghost" href={'tel:' + site.phone}>Call {site.phoneDisplay}</a><a className="btn ghost" href={'tel:' + site.phone2}>Other line {site.phone2Display}</a></p>
    <h2>Prefer to hire through a platform?</h2>
    <p>Olexweb is on Contra, where the agreement, milestones and payment are handled for you.</p>
    <div className="contra-hire-me-button" data-analyticsuserid="36cfd02b-8e58-4bdb-a4a0-11cea727bb1d" data-theme="light" data-username="olexweb01"></div>
    <p><a className="btn ghost" href="https://contra.com/olexweb01" target="_blank" rel="noopener">Open the Contra profile</a></p>
    <Script src="https://contra.com/static/embed/sdk.js" strategy="afterInteractive" charSet="utf-8" />
    <p className="muted">Ideas → Design → Code → Real impact.</p>
  </Page>)
}
