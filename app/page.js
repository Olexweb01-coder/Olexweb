// The homepage, exactly as approved, with "What clients say" just above the footer (approved reviews only).
import V2Html from '@/components/V2Html'
import parts from '@/v2/live/home'
import HomeReviews from '@/components/site/HomeReviews'
import { getTestimonials } from '@/lib/site/data'
import { renderHomeReviews } from '@/lib/site/render'
import { pageMetadata } from '@/lib/seo'
export const revalidate = 3600
export const metadata = pageMetadata('home')
export default async function Home() {
  const quotes = await getTestimonials()
  return (<><V2Html html={parts[0] + renderHomeReviews(quotes) + parts[1]} />{quotes.length > 1 ? <HomeReviews /> : null}</>)
}
