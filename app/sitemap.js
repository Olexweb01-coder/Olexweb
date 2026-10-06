// app/sitemap.js: every page, including each article from content/site.js (new articles appear automatically).
import { insights } from '@/content/site';
import { SITE, PAGES } from '@/lib/seo';
const PRIORITY = { home: 1, about: 0.9, portfolio: 0.9, workWithMe: 0.9, blog: 0.8, elvanex: 0.7, needar: 0.7, aviirel: 0.7, studio: 0.6, privacy: 0.2, terms: 0.2, cookies: 0.2 };
export default function sitemap() {
  const now = new Date();
  const pages = Object.entries(PAGES).map(([k, p]) => ({ url: SITE + p.path, lastModified: now, changeFrequency: k === 'blog' ? 'weekly' : 'monthly', priority: PRIORITY[k] }));
  const articles = insights.map((a) => ({ url: SITE + '/insights/' + a.slug, lastModified: new Date(a.date), changeFrequency: 'yearly', priority: 0.7 }));
  return [...pages, ...articles];
}
