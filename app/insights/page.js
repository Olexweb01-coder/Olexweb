// Blog: the article list comes from the database (refreshed on publish).
import V2Html from '@/components/V2Html'
import JsonLd from '@/components/JsonLd'
import parts from '@/v2/live/blog'
import { getPosts } from '@/lib/site/data'
import { renderBlogList } from '@/lib/site/render'
import { pageMetadata, pageJsonLd, SITE } from '@/lib/seo'
import BlogTools from '@/components/site/BlogTools'
export const revalidate = 3600
export const metadata = pageMetadata('blog')
export default async function Blog() {
  const posts = await getPosts()
  const ld = pageJsonLd('blog', [{ '@type': 'Blog', name: 'Olexweb Blog', url: SITE + '/insights', publisher: { '@id': SITE + '/#org' },
    blogPost: posts.map((a) => ({ '@type': 'BlogPosting', headline: a.title, description: a.summary, datePublished: a.published_on, url: SITE + '/insights/' + a.slug, author: { '@id': SITE + '/#olaitan' } })) }])
  return (<><JsonLd data={ld} /><V2Html html={parts[0] + renderBlogList(posts) + parts[1]} /><BlogTools /></>)
}
