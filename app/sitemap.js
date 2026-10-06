// Every page, plus every live article and venture from the database (refreshed on publish).
import { getPosts, getVentures } from '@/lib/site/data'
import { SITE, PAGES } from '@/lib/seo'
// built fresh on each request (search engines fetch it only occasionally), so new articles are listed immediately
export const dynamic = 'force-dynamic'
const PRIORITY = { home: 1, about: 0.9, portfolio: 0.9, workWithMe: 0.9, blog: 0.8, ventures: 0.8, studio: 0.6, privacy: 0.2, terms: 0.2, cookies: 0.2 }
const VENTURE_KEYS = ['elvanex', 'needar', 'aviirel']
export default async function sitemap() {
  const now = new Date()
  const pages = Object.entries(PAGES).filter(([k]) => !VENTURE_KEYS.includes(k)).map(([k, p]) => ({ url: SITE + p.path, lastModified: now, changeFrequency: k === 'blog' ? 'weekly' : 'monthly', priority: PRIORITY[k] ?? 0.5 }))
  const [posts, ventures] = await Promise.all([getPosts(), getVentures()])
  return [...pages,
    ...ventures.map((v) => ({ url: SITE + '/ventures/' + v.slug, lastModified: now, changeFrequency: 'monthly', priority: 0.7 })),
    ...posts.map((a) => ({ url: SITE + '/insights/' + a.slug, lastModified: new Date(a.updated_at || a.published_on), changeFrequency: 'yearly', priority: 0.7 }))]
}
