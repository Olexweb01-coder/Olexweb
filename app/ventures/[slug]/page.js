// A venture's story page, from the database. New ventures get a page automatically.
import { notFound } from 'next/navigation'
import V2Html from '@/components/V2Html'
import JsonLd from '@/components/JsonLd'
import shell from '@/v2/live/venture-shell'
import { getVentures, getVenture } from '@/lib/site/data'
import { renderVentureMain } from '@/lib/site/render'
import { pageMetadata, pageJsonLd, SITE } from '@/lib/seo'
export const revalidate = 3600
export const dynamicParams = true
export async function generateStaticParams() { return (await getVentures()).map((v) => ({ slug: v.slug })) }
const cap = (s, n) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1)) + '\u2026')
export async function generateMetadata({ params }) {
  const v = await getVenture(params.slug); if (!v) return {}
  return pageMetadata('ventures', { path: '/ventures/' + v.slug, title: cap(`${v.name} | ${v.line || 'A venture by Olexweb'}`, 60), description: cap(((v.text || [])[0] || v.summary || v.line || '').trim(), 158), keywords: [v.name, 'Olexweb ventures', 'Olaitan Adebayo'] })
}
export default async function Venture({ params }) {
  const all = await getVentures(), v = all.find((x) => x.slug === params.slug); if (!v) notFound()
  const others = all.filter((x) => x.slug !== v.slug).slice(0, 2)
  const ld = pageJsonLd('ventures', [{ '@type': 'Organization', name: v.name, url: v.url || undefined, description: v.line, founder: { '@id': SITE + '/#olaitan' } }], { path: '/ventures/' + v.slug, title: v.name, description: v.line })
  return (<><JsonLd data={ld} /><V2Html html={shell[0] + renderVentureMain(v, others) + shell[1]} /></>)
}
