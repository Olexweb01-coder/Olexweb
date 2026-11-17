// Install 29: olexweb.com/olex-ai: what Olex AI is, publicly, so "Olex AI" has a page to find
import Landing from '@/components/site/Landing'
import JsonLd from '@/components/JsonLd'
import { LANDINGS } from '@/lib/site/landings'
import { getProjects } from '@/lib/site/data'
import { pageMetadata, pageJsonLd, SITE } from '@/lib/seo'
export const revalidate = 3600
export const metadata = pageMetadata('land:olex-ai')
export default async function Page() {
  const L = LANDINGS['olex-ai'], projects = await getProjects().catch(() => [])
  const ld = pageJsonLd('land:olex-ai', [
    { '@type': 'SoftwareApplication', name: 'Olex AI', alternateName: 'Olexweb AI', applicationCategory: 'BusinessApplication', operatingSystem: 'Web', creator: { '@id': SITE + '/#org' }, url: SITE + L.path, description: L.description },
    { '@type': 'FAQPage', mainEntity: L.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ])
  return (<><JsonLd data={ld} /><Landing L={L} projects={JSON.parse(JSON.stringify(projects))} /></>)
}
