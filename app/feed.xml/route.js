// olexweb.com/feed.xml (Install 16): the newest Directory posts as RSS, so readers like Feedly and Flipboard, news apps and
// aggregators pick them up by themselves.
import { liveEntries, SITE } from '@/lib/site/directory'
export const revalidate = 600
const KP = { tool: 'tools', update: 'updates', guide: 'guides', alert: 'alerts' }
const KN = { tool: 'Tool', update: 'Tech update', guide: 'How-to', alert: 'Safety alert' }
const x = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
export async function GET() {
  const items = (await liveEntries().catch(() => [])).slice(0, 50)
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>Olexweb: tools, tech updates, how-tos and safety alerts</title><link>${SITE}/tools</link>
<description>Useful websites and AI tools, tech updates that matter, how-tos and scam alerts. Every fact checked against its source.</description>
<language>en</language><atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
${items.map((e) => { const url = `${SITE}/${KP[e.kind] || 'tools'}/${e.slug}`
    return `<item><title>${x(e.name)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><category>${KN[e.kind] || 'Tool'}</category>${e.published_at ? `<pubDate>${new Date(e.published_at).toUTCString()}</pubDate>` : ''}<description>${x(e.one)}</description></item>` }).join('\n')}
</channel></rss>`
  return new Response(body, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=600' } })
}
