// Install 29: olexweb.com/services/<search>: one page per real search (lib/site/landings.js)
import { notFound } from 'next/navigation'
import Landing from '@/components/site/Landing'
import JsonLd from '@/components/JsonLd'
import { LANDINGS } from '@/lib/site/landings'
import { getProjects } from '@/lib/site/data'
import { pageMetadata, pageJsonLd, SITE } from '@/lib/seo'
export const revalidate = 3600
export const dynamicParams = false
const KEYS = Object.keys(LANDINGS).filter((k) => LANDINGS[k].path.startsWith('/services/'))
export function generateStaticParams() { return KEYS.map((slug) => ({ slug })) }
export function generateMetadata({ params }) { return KEYS.includes(params.slug) ? pageMetadata('land:' + params.slug) : {} }
function landingGraph(key) {
  const L = LANDINGS[key], url = SITE + L.path
  return pageJsonLd('land:' + key, [
    { '@type': 'Service', name: L.h1, serviceType: L.kicker, provider: { '@id': SITE + '/#org' }, areaServed: { '@type': 'Country', name: 'Nigeria' }, url, description: L.description },
    { '@type': 'FAQPage', mainEntity: L.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Olexweb', item: SITE + '/' }, { '@type': 'ListItem', position: 2, name: L.kicker, item: url }] },
  ])
}
export default async function Page({ params }) {
  if (!KEYS.includes(params.slug)) notFound()
  const projects = await getProjects().catch(() => [])
  return (<><JsonLd data={landingGraph(params.slug)} /><Landing L={LANDINGS[params.slug]} projects={JSON.parse(JSON.stringify(projects))} /></>)
}
