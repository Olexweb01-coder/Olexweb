// olexweb.com/doc/<token>: an official Olexweb rate card or invoice (Install 18). Private link, never indexed; prints as a PDF.
import { notFound } from 'next/navigation'
import { docByToken } from '@/lib/sales/docs'
import DocPage from '@/components/DocPage'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Olexweb', robots: { index: false, follow: false } }
export default async function Page({ params }) {
  const d = await docByToken(params.token).catch(() => null); if (!d) notFound()
  return <DocPage d={JSON.parse(JSON.stringify(d))} />
}
