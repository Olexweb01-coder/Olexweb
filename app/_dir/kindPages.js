// The news side of the Directory (Install 16): one post page and one list page per kind (updates, guides, alerts).
import { notFound } from 'next/navigation'
import DirPost from '@/components/DirPost'
import DirLibrary from '@/components/DirLibrary'
import { entryBySlug, liveEntries, SITE } from '@/lib/site/directory'

const PATH = { update: 'updates', guide: 'guides', alert: 'alerts' }
const LIST = {
  update: ['Tech updates that matter to you', 'What changed in the apps and services you use, and what to do about it. Checked against the source.'],
  guide: ['How-tos you can follow today', 'Clear, step-by-step help for your phone, computer and online life.'],
  alert: ['Scam and safety alerts', 'The scams and security problems going round now, how to spot them, and how to protect yourself.'],
}
export const postMeta = (kind) => async function generateMetadata({ params }) {
  const e = await entryBySlug(params.slug, kind).catch(() => null); if (!e) return { title: 'Not found' }
  const c = e.content, url = '/' + PATH[kind] + '/' + e.slug
  return { title: c.title, description: c.metaDescription, alternates: { canonical: url },
    openGraph: { title: c.title, description: c.metaDescription, url, type: 'article', publishedTime: e.published_at }, twitter: { card: 'summary_large_image', title: c.title, description: c.metaDescription } }
}
export const postPage = (kind) => async function Page({ params }) {
  const e = await entryBySlug(params.slug, kind).catch(() => null); if (!e) notFound()
  const c = e.content, url = SITE + '/' + PATH[kind] + '/' + e.slug
  const ld = [
    kind === 'guide'
      ? { '@context': 'https://schema.org', '@type': 'HowTo', name: c.title, description: c.metaDescription, url, step: (c.whatToDo || []).map((x, i) => ({ '@type': 'HowToStep', position: i + 1, text: x })) }
      : { '@context': 'https://schema.org', '@type': 'NewsArticle', headline: c.title, description: c.metaDescription, url, datePublished: e.published_at, dateModified: e.updated_at, image: [url + '/opengraph-image'],
        author: { '@type': 'Person', name: 'Olaitan Adebayo', url: SITE + '/about' }, publisher: { '@type': 'Organization', name: 'Olexweb', url: SITE }, isBasedOn: e.url },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Directory', item: SITE + '/tools' }, { '@type': 'ListItem', position: 2, name: LIST[kind][0], item: SITE + '/' + PATH[kind] }, { '@type': 'ListItem', position: 3, name: c.title, item: url }] },
    ...((c.faq || []).length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: c.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }] : [])]
  return (<><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} /><DirPost e={JSON.parse(JSON.stringify(e))} /></>)
}
export const listMeta = (kind) => ({ title: LIST[kind][0] + ' | Olexweb', description: LIST[kind][1], alternates: { canonical: '/' + PATH[kind], types: { 'application/rss+xml': '/feed.xml' } }, openGraph: { title: LIST[kind][0], description: LIST[kind][1], url: '/' + PATH[kind], type: 'website' } })
export const listPage = (kind) => async function Page() {
  const entries = await liveEntries(kind).catch(() => [])
  return <DirLibrary entries={JSON.parse(JSON.stringify(entries))} kind={kind} heading={LIST[kind]} />
}
