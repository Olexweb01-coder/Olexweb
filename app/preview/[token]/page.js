// olexweb.com/preview/<token>: the mock-up homepage the sales agent made for one business (lib/sales/preview.js).
// A private link: never indexed, never in the sitemap.
import { notFound } from 'next/navigation'
import { previewByToken } from '@/lib/sales/preview'
import PreviewSite from '@/components/sales/PreviewSite'
import '../preview.css'
export const dynamic = 'force-dynamic'
export async function generateMetadata({ params }) {
  const d = await previewByToken(params.token).catch(() => null)
  return { title: d ? `${d.name}: a new homepage (mock-up by Olexweb)` : 'Olexweb', robots: { index: false, follow: false, nocache: true }, referrer: 'no-referrer' }
}
export default async function Page({ params }) {
  const d = await previewByToken(params.token).catch(() => null); if (!d) notFound()
  return <PreviewSite d={JSON.parse(JSON.stringify(d))} />
}
