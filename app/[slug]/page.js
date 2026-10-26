// Any address created in the admin: olexweb.com/<slug> → a page (webinar, event, audio course) or a short link.
// Existing routes always win (Next.js matches them first), and the admin refuses reserved addresses anyway.
import { notFound } from 'next/navigation'
import PageView from '@/components/PageView'
import LinkHop from '@/components/LinkHop'
import { publicBySlug } from '@/lib/site/pages'
export const revalidate = 60
export const dynamicParams = true
export async function generateStaticParams() { return [] }          // nothing pre-built; each page is cached on its first visit
export async function generateMetadata({ params }) {
  const r = await publicBySlug(params.slug).catch(() => null)
  if (!r) return { title: 'Not found' }
  if (r.kind === 'link') return { title: 'Opening…', robots: { index: false } }
  const c = r.page.content, d = c.preview || c.tagline || ''
  return { title: `${c.title} | Olaitan Adebayo`, description: d, robots: { index: false, follow: false },
    openGraph: { title: c.title, description: d, type: 'website', url: '/' + r.page.slug, ...(c.photo ? { images: [{ url: c.photo }] } : {}) }, twitter: { card: 'summary_large_image', title: c.title, description: d } }
}
export const viewport = { themeColor: '#f2efe9', colorScheme: 'light' }
export default async function Page({ params }) {
  const r = await publicBySlug(params.slug).catch(() => null)
  if (!r) notFound()
  if (r.kind === 'link') return <LinkHop slug={r.slug} target={r.target} />
  return <PageView page={JSON.parse(JSON.stringify(r.page))} />
}
