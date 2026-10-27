// olexweb.com/tools/<slug>: one directory page (cached; refreshed when published or rewritten)
import { notFound } from 'next/navigation'
import DirEntry from '@/components/DirEntry'
import { entryBySlug, SITE } from '@/lib/site/directory'
export const revalidate = 3600
export const dynamicParams = true
export async function generateStaticParams() { return [] }
export async function generateMetadata({ params }) {
  const e = await entryBySlug(params.slug).catch(() => null); if (!e) return { title: 'Not found' }
  const c = e.content
  return { title: c.title, description: c.metaDescription, alternates: { canonical: '/tools/' + e.slug },
    openGraph: { title: c.title, description: c.metaDescription, url: '/tools/' + e.slug, type: 'article', ...(e.video ? { images: [{ url: `https://i.ytimg.com/vi/${e.video}/hqdefault.jpg` }] } : {}) },
    twitter: { card: 'summary_large_image', title: c.title, description: c.metaDescription } }
}
export default async function Page({ params }) {
  const e = await entryBySlug(params.slug).catch(() => null); if (!e) notFound()
  const c = e.content, ld = [
    { '@context': 'https://schema.org', '@type': 'WebPage', name: c.title, description: c.metaDescription, url: SITE + '/tools/' + e.slug, datePublished: e.published_at, dateModified: e.updated_at,
      author: { '@type': 'Person', name: 'Olaitan Adebayo', url: SITE + '/about' }, publisher: { '@type': 'Organization', name: 'Olexweb', url: SITE },
      about: { '@type': 'SoftwareApplication', name: e.name, url: e.url, applicationCategory: e.category || 'WebApplication', operatingSystem: 'Web' } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Directory', item: SITE + '/tools' }, { '@type': 'ListItem', position: 2, name: e.name, item: SITE + '/tools/' + e.slug }] },
    ...((c.faq || []).length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: c.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }] : [])]
  return (<><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} /><DirEntry e={JSON.parse(JSON.stringify(e))} /></>)
}
