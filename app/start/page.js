// Start your project: a short form for people who prefer it to WhatsApp. Enquiries go to the admin's Leads inbox.
import V2Shell from '@/components/V2Shell'
import StartForm from '@/components/site/StartForm'
import { leadStamp } from '@/lib/site/leads'
import { SITE } from '@/lib/seo'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Start your project | Olexweb', description: 'Tell Olaitan Adebayo about your website or app project. You’ll get a reply within a day, on WhatsApp or by email.',
  alternates: { canonical: SITE + '/start' }, robots: { index: true, follow: true } }
export default function Start() {
  return (<V2Shell kind="blog"><article className="art-page"><div className="art"><StartForm stamp={leadStamp()} /></div></article></V2Shell>)
}
