// Every page, plus every live article and venture from the database (refreshed on publish).
import { getPosts, getVentures } from '@/lib/site/data'
import { SITE, PAGES } from '@/lib/seo'
import { liveEntries } from '@/lib/site/directory'
// built fresh on each request (search engines fetch it only occasionally), so new articles are listed immediately
export const dynamic = 'force-dynamic'
const PRIORITY = { home: 1, about: 0.9, portfolio: 0.9, workWithMe: 0.9, blog: 0.8, ventures: 0.8, studio: 0.6, privacy: 0.2, terms: 0.2, cookies: 0.2 }
const KP = { tool: 'tools', update: 'updates', guide: 'guides', alert: 'alerts' }   // Install 16: every kind of Directory post
const VENTURE_KEYS = ['elvanex', 'needar', 'aviirel']
export default async function sitemap() {
  const now = new Date()
  const pages = Object.entries(PAGES).filter(([k]) => !VENTURE_KEYS.includes(k)).map(([k, p]) => ({ url: SITE + p.path, lastModified: now, changeFrequency: k === 'blog' ? 'weekly' : 'monthly', priority: PRIORITY[k] ?? 0.5 }))
  const [posts, ventures, tools] = await Promise.all([getPosts(), getVentures(), liveEntries().catch(() => [])])
  return [...pages,
    ...ventures.map((v) => ({ url: SITE + '/ventures/' + v.slug, lastModified: now, changeFrequency: 'monthly', priority: 0.7 })),
    ...posts.map((a) => ({ url: SITE + '/insights/' + a.slug, lastModified: new Date(a.updated_at || a.published_on), changeFrequency: 'yearly', priority: 0.7 })),
    { url: SITE + '/tools', lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    ...['updates', 'guides', 'alerts'].map((p) => ({ url: SITE + '/' + p, lastModified: now, changeFrequency: 'daily', priority: 0.8 })),
    ...tools.map((t) => ({ url: SITE + '/' + (KP[t.kind] || 'tools') + '/' + t.slug, lastModified: new Date(t.published_at || now), changeFrequency: t.kind === 'tool' ? 'monthly' : 'weekly', priority: t.kind === 'update' || t.kind === 'alert' ? 0.7 : 0.8 }))]
}
