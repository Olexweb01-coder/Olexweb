// olexweb.com/aoc: a standalone landing page for the free audio course, styled after the AOC flyer.
import AocCourse from '@/components/AocCourse'
import { publicCourse } from '@/lib/site/aoc'
export const dynamic = 'force-dynamic'
const D = 'How everything that exists was actually made, and how to make yours. A free audio course in 4 short parts by Olaitan Adebayo.'
export const metadata = {
  title: 'Anatomy of Creation | Free audio course by Olaitan Adebayo', description: D, robots: { index: false, follow: false },
  openGraph: { title: 'Anatomy of Creation: a free audio course', description: D, url: '/aoc', type: 'website', images: [{ url: '/aoc/og.jpg', width: 1200, height: 630, alt: 'Anatomy of Creation, a free audio course by Olaitan Adebayo' }] },
  twitter: { card: 'summary_large_image', title: 'Anatomy of Creation: a free audio course', description: D, images: ['/aoc/og.jpg'] },
}
export const viewport = { themeColor: '#EDF0E9', colorScheme: 'light' }
export default async function Page() {
  return <AocCourse data={JSON.parse(JSON.stringify(await publicCourse()))} />
}
