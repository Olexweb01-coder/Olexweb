import { site, work, ventures, insights } from '@/content/site'
export default function sitemap() {
  const base = site.domain, now = new Date()
  const fixed = ['', '/olexweb', '/work', '/olaitan', '/ventures', '/lab', '/thinking', '/teaching', '/events', '/vision', '/insights', '/contact'].map(p => ({ url: base + p, lastModified: now, changeFrequency: 'weekly', priority: p === '' ? 1 : 0.7 }))
  return fixed.concat(work.map(w => ({ url: base + '/work/' + w.slug, lastModified: now, priority: 0.6 })), ventures.map(v => ({ url: base + '/ventures/' + v.slug, lastModified: now, priority: 0.5 })), insights.map(a => ({ url: base + '/insights/' + a.slug, lastModified: new Date(a.date), priority: 0.5 })))
}
