// Portfolio: projects and client testimonials come from the database (refreshed on publish).
import V2Html from '@/components/V2Html'
import JsonLd from '@/components/JsonLd'
import parts from '@/v2/live/portfolio'
import { getProjects, getTestimonials } from '@/lib/site/data'
import { renderCases, renderTestimonials } from '@/lib/site/render'
import { pageMetadata, pageJsonLd, SITE } from '@/lib/seo'
export const revalidate = 3600
export const metadata = pageMetadata('portfolio')
export default async function Portfolio() {
  const [projects, quotes] = await Promise.all([getProjects(), getTestimonials()])
  const ld = pageJsonLd('portfolio', [{ '@type': 'ItemList', name: 'Selected projects by Olexweb', itemListElement: projects.map((p, i) => ({ '@type': 'ListItem', position: i + 1, item: { '@type': 'CreativeWork', name: p.name, url: p.url || undefined, creator: { '@id': SITE + '/#org' }, description: p.text } })) }])
  return (<><JsonLd data={ld} /><V2Html html={parts[0] + renderCases(projects) + parts[1] + '\n' + renderTestimonials(quotes) + parts[2]} /></>)
}
