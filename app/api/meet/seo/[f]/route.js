// meet.olexweb.com/robots.txt and /sitemap.xml (next.config.js rewrites them here: /api/meet/seo/robots, /api/meet/seo/sitemap).
// Google may read the homepage; meeting rooms (/abc-defg-hij) are marked noindex on the page itself; the API is off limits.
import { homeUrl } from '@/lib/meet/seo'
export const dynamic = 'force-dynamic'
export async function GET(request, { params }) {
  const f = params.f, home = homeUrl()
  if (f === 'sitemap') {
    // Install 58d: the public pages people can find (home, Find a mentor, leaderboard, policies, public profiles); rooms stay private
    const base = home.replace(/\/$/, ''), mp = base.endsWith('/meet') ? base : base + '/meet'
    const { q } = await import('@/lib/meet/db')
    const people = await q("select handle, last_seen from meet_users where public and handle is not null and banned_at is null order by last_seen desc limit 500").then((r) => r.rows).catch(() => [])
    const { siteUrl } = await import('@/lib/meet/site')               // Install 58g: the website's pages
    const urls = [[home, 'weekly', '1.0'], ...[['/features', 0.9], ['/pricing', 0.9], ['/earn', 0.9], ['/for', 0.8], ['/help', 0.7], ['/about', 0.5]].map(([x, pr]) => [siteUrl(x), 'monthly', String(pr)]), [siteUrl('/mentors'), 'daily', '0.8'], [siteUrl('/leaders'), 'daily', '0.6'], ...['earnings', 'refunds', 'community'].map((x) => [mp + '/legal/' + x, 'monthly', '0.3']),
      ...people.map((p) => [mp + '/h/' + encodeURIComponent(p.handle), 'weekly', '0.5'])]
    return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u, c, pr]) => `  <url><loc>${u}</loc><changefreq>${c}</changefreq><priority>${pr}</priority></url>`).join('\n')}\n</urlset>\n`,
      { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } })
  }
  return new Response(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${home}sitemap.xml\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } })
}
