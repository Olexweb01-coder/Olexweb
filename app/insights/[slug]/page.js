// An article page, from the database. New articles get a page automatically the first time someone opens them.
import { notFound } from 'next/navigation'
import { getPosts, getPost, getSocials } from '@/lib/site/data'
import { fmtDate } from '@/lib/site/render'
import { pageMetadata, pageJsonLd, SITE, OG_IMAGE } from '@/lib/seo'
import JsonLd from '@/components/JsonLd'
import V2Shell from '@/components/V2Shell'

export const revalidate = 3600
export const dynamicParams = true
export async function generateStaticParams() { return (await getPosts()).map((a) => ({ slug: a.slug })) }
const cap = (s, n) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1)) + '\u2026')
// Text may contain [words](address). Only the site's own pages and this article's sources become links; anything else stays plain words.
const LINK = /\[([^\]]{1,120})\]\(([^)\s]{1,400})\)/g
function rich(text, okUrls) {
  const out = []; let last = 0
  for (const m of text.matchAll(LINK)) {
    out.push(text.slice(last, m.index)); last = m.index + m[0].length
    const [, label, href] = m, internal = /^\/[a-z0-9\-\/]{0,120}$/.test(href)
    out.push(internal ? <a key={m.index} href={href}>{label}</a> : okUrls.has(href) ? <a key={m.index} href={href} target="_blank" rel="noopener">{label}</a> : label)
  }
  out.push(text.slice(last)); return out
}
const WA = 'https://wa.me/2347011726321?text=' + encodeURIComponent("Hi Olexweb, I have a project in mind and I'd like to talk about it.").replace(/'/g, '%27')

export async function generateMetadata({ params }) {
  const a = await getPost(params.slug); if (!a) return {}
  const seo = a.seo || {}
  return pageMetadata('blog', { path: '/insights/' + a.slug, ogType: 'article', publishedTime: a.published_on,
    title: seo.title ? seo.title : cap(a.title, 50) + ' | Olexweb', description: cap(seo.description || a.summary || a.title, 158),
    keywords: [seo.keyword, 'Olaitan Adebayo', 'Olexweb blog'].filter(Boolean) })
}

export default async function Article({ params }) {
  const a = await getPost(params.slug); if (!a) notFound()
  const SOCIAL = await getSocials(), okUrls = new Set((Array.isArray(a.sources) ? a.sources : []).map((s) => s && s.url))
  const all = await getPosts(), i = all.findIndex((x) => x.slug === a.slug), next = all.length > 1 ? all[(i + 1) % all.length] : null
  const url = SITE + '/insights/' + a.slug, seo = a.seo || {}
  const ld = pageJsonLd('blog', [{ '@type': 'BlogPosting', headline: a.title, description: seo.description || a.summary, datePublished: a.published_on, dateModified: (a.updated_at || a.published_on || '').slice(0, 10) || undefined,
    url, mainEntityOfPage: url, author: { '@id': SITE + '/#olaitan' }, publisher: { '@id': SITE + '/#org' }, image: SITE + OG_IMAGE.url, timeRequired: 'PT' + a.minutes + 'M', inLanguage: 'en', keywords: seo.keyword || undefined }],
    { path: '/insights/' + a.slug, title: a.title, description: a.summary })
  const share = [['WhatsApp', 'https://wa.me/?text=' + encodeURIComponent(a.title + ' ' + url)], ['LinkedIn', 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(url)],
    ['Facebook', 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url)], ['X', 'https://x.com/intent/post?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(a.title)]]
  const sources = Array.isArray(a.sources) ? a.sources.filter((s) => s && /^https?:\/\//.test(s.url || '')) : []
  return (
    <V2Shell kind="blog">
      <JsonLd data={ld} />
      <article className="art-page"><div className="art">
        <p className="art-back"><a href="/insights">Back to the Blog</a></p>
        <h1>{a.title}</h1>
        <p className="art-meta">By <a href="/about" className="art-by">Olaitan Adebayo</a>. {fmtDate(a.published_on)}. A {a.minutes}-minute read.</p>
        {(a.body || []).map((b, k) => (b.type === 'h' ? <h2 key={k}>{b.text.replace(LINK, '$1')}</h2> : <p key={k}>{rich(b.text, okUrls)}</p>))}
        {sources.length ? <div className="art-sources"><h2>Sources</h2><ol>{sources.map((s, k) => <li key={k}><a href={s.url} target="_blank" rel="noopener nofollow">{s.title || s.url}</a></li>)}</ol></div> : null}
        <div className="art-share"><b>Share this article</b><span>{share.map(([n, h]) => <a key={n} className="btn btn-line" href={h} target="_blank" rel="noopener noreferrer">{n}</a>)}</span></div>
        <aside className="art-author" aria-label="About the author">
          <img src="/v2/photos/p2.webp" alt="Olaitan Adebayo" width="72" height="72" />
          <div><b>Olaitan Adebayo</b><p>Founder of Olexweb. A web developer who builds websites, products and the systems behind them, and writes about what makes them work.</p>
            <p className="art-follow">Follow Olaitan: {[['LinkedIn', SOCIAL.linkedin], ['X', SOCIAL.x], ['Facebook', SOCIAL.facebook]].filter(([, h]) => /^https:\/\//.test(h || '')).map(([n, h]) => <a key={n} href={h} target="_blank" rel="noopener me">{n}</a>)}</p></div>
        </aside>
        <div className="art-cta"><p>Need a website that brings in work?</p><a className="btn btn-green" href={WA}>Start my project</a></div>
        {next ? <div className="art-next"><small>Next article</small><a href={'/insights/' + next.slug}>{next.title}</a></div> : null}
      </div></article>
    </V2Shell>
  )
}
