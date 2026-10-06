// Ventures: the cards come from the database (refreshed on publish).
import V2Html from '@/components/V2Html'
import JsonLd from '@/components/JsonLd'
import parts from '@/v2/live/ventures'
import { getVentures } from '@/lib/site/data'
import { renderVentureCards, domain } from '@/lib/site/render'
import { pageMetadata, pageJsonLd, SITE } from '@/lib/seo'
export const revalidate = 3600
export const metadata = pageMetadata('ventures')
export default async function Ventures() {
  const vs = await getVentures()
  const ld = pageJsonLd('ventures', [{ '@type': 'ItemList', name: 'Ventures by Olexweb', itemListElement: vs.map((v, i) => ({ '@type': 'ListItem', position: i + 1, item: { '@type': 'Organization', name: v.name, url: v.url || undefined, founder: { '@id': SITE + '/#olaitan' }, description: v.line } })) }])
  return (<><JsonLd data={ld} /><V2Html html={parts[0] + renderVentureCards(vs) + parts[1]} /></>)
}
