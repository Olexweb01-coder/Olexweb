// meet.olexweb.com/robots.txt and /sitemap.xml (next.config.js rewrites them here: /api/meet/seo/robots, /api/meet/seo/sitemap).
// Google may read the homepage; meeting rooms (/abc-defg-hij) are marked noindex on the page itself; the API is off limits.
import { homeUrl } from '@/lib/meet/seo'
export const dynamic = 'force-dynamic'
export async function GET(request, { params }) {
  const f = params.f, home = homeUrl()
  if (f === 'sitemap') return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${home}</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } })
  return new Response(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${home}sitemap.xml\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } })
}
